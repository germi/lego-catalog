const ZERO = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * Whether a voronoi sub-layer should use the STATIC (recompute-on-zoom) group
 * mode. `recomputeOnZoom` reprojects cells through the canvas's zoomed x/y
 * scales — which only exist on a SCALE canvas. On a GEO map there are no zoomed
 * scales, so the layer must fall back to LITERAL mode (ride the d3 zoom
 * transform on its `<g>`, like ScatterLayer/ArcLayer do) or it freezes on zoom.
 */
export function recomputeStatic(props, payload) {
  return !!(props?.recomputeOnZoom && payload?.projector?.type === "scale");
}

// Layout offset a voronoi sub-layer's content needs: `m + p − cm` (canvas
// margin is already on innerEl, so this reduces to the chart's padding).
function layoutOffset(payload) {
  const m = payload?.margin  ?? ZERO;
  const p = payload?.padding ?? ZERO;
  return {
    dx: (m.left ?? 0) + (p.left ?? 0) - (m.left ?? 0),
    dy: (m.top  ?? 0) + (p.top  ?? 0) - (m.top  ?? 0),
  };
}

/**
 * Returns a child `<g>` of a voronoi sub-layer's group, offset so the diagram
 * sits on the same plot area as projector-positioned points in ANY canvas.
 *
 * The canvas already offsets `innerEl` by margin (payload.margin); the chart's
 * own layers additionally self-translate by padding. A voronoi layer appends to
 * `innerEl` too, so the only residual offset it needs is that padding. We read
 * margin/padding straight from the PAYLOAD — prop-free, which is the whole
 * point: drop a voronoi into a ScatterPlot (padding 0 → translate 0), a
 * LineChart, or any future projector-driven canvas and it aligns with zero
 * per-chart wiring.
 *
 * Kept on a CHILD group so the outer group keeps carrying the zoom transform
 * (literal mode) independently of this static layout offset.
 */
export function voronoiContentGroup(g, payload) {
  const { dx, dy } = layoutOffset(payload);
  let cg = g.select("g.voronoi-content");
  if (cg.empty()) cg = g.append("g").attr("class", "voronoi-content");
  cg.attr("transform", (dx || dy) ? `translate(${dx},${dy})` : null);
  return cg;
}

/**
 * Apply an interactive-zoom "gesture delta" on top of the layout offset, in the
 * content group's own coordinate space, WITHOUT recomputing the diagram.
 *
 * In recompute mode the cells/labels/ghosts were last built at the baseline
 * zoom transform `T0`; during a live wheel/drag we make them track the dots
 * rigidly by composing the delta `D = T · T0⁻¹` after the padding — exactly the
 * space the chart's re-projected points live in — so a few-hundred-point
 * Delaunay is NOT rebuilt every frame (the fan). The provider clears this (and
 * re-tiles viewport-aware) once with a single recompute when the gesture
 * settles. `deltaStr` null restores the plain padding offset.
 */
export function voronoiGestureTransform(g, payload, deltaStr) {
  if (!g) return;
  const cg = g.select("g.voronoi-content");
  if (cg.empty()) return;
  const { dx, dy } = layoutOffset(payload);
  const pad = (dx || dy) ? `translate(${dx},${dy})` : "";
  cg.attr("transform", deltaStr ? `${pad} ${deltaStr}`.trim() : (pad || null));
}

/**
 * SVG transform string for the zoom delta `D = T · T0⁻¹` between a current and a
 * baseline d3 zoom transform. Applied to baseline-positioned (T0-zoomed) cells,
 * it maps them to the current (T-zoomed) positions — matching re-projected
 * points — for both continuous and band scales (band zoom is a linear range
 * stretch, which a scale+translate reproduces).
 */
export function zoomDeltaString(t, t0) {
  const k0 = t0?.k || 1;
  const dk = (t?.k ?? 1) / k0;
  const dx = (t?.x ?? 0) - dk * (t0?.x ?? 0);
  const dy = (t?.y ?? 0) - dk * (t0?.y ?? 0);
  return `translate(${dx},${dy}) scale(${dk})`;
}
