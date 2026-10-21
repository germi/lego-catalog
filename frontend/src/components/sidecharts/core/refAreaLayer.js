/**
 * RefAreaLayer — filled reference regions drawn on top of a cartesian chart.
 *
 * Canvas-agnostic: reads x/y scales from `payload.projector` when the host
 * canvas exposes one (ScatterPlot's makeScaleProjector), or builds its own
 * scales from `props.data` + `props.yDomain` (LineChart / AreaChart slot).
 *
 * Each entry in `props.areas` must have a stable `id` — the D3 join uses
 * it as the key, so an area that changes its corners or sample points
 * (same id) animates its `d` attribute over `props.duration` instead of
 * being replaced.
 *
 * Spec shapes:
 *   { id, x1, y1, x2, y2 }                           rectangle (any corner can be
 *                                                    null/Infinity for "chart edge")
 *   { id, y: <data y>, side: "above" | "below" }     half-plane on a horizontal
 *   { id, x: <data x>, side: "left"  | "right" }     half-plane on a vertical
 *   { id, points: [{x, y0, y1}, …] }                 band between two curves
 *   { id, rule: "regressionCI" | fn, ci?: 0.95 }     computed each render
 *
 * Per-datum optional styling:
 *   fill, fillOpacity, stroke, strokeWidth, strokeDasharray
 */

import { createLayer } from "./layer.js";
import { buildScale } from "../utils/scale/buildScale.js";
import { resolveFill } from "../fill/resolveFill.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";
import { linearRegression } from "../utils/regression.js";
import { resolveEase } from "../utils/ease.js";

export const REF_AREA_LAYER_DEFAULTS = {
  areas:           [],
  data:            null,
  xAccessor:       (d) => d.x,
  yAccessor:       (d) => d.y,
  margin:          { top: 0, right: 0, bottom: 0, left: 0 },
  padding:         { top: 0, right: 0, bottom: 0, left: 0 },
  xScaleType:      "linear",
  yScaleType:      "linear",
  yDomain:         null,
  // Visual defaults — overridable per-datum
  fill:            "rgba(0,0,0,0.1)",
  fillOpacity:     1,
  stroke:          "none",
  strokeWidth:     0,
  strokeDasharray: null,
  // Animation
  duration:        GLOBAL_DEFAULTS.duration,
  ease:            GLOBAL_DEFAULTS.ease,
};

function buildScalesFromData(payload, props, m, p) {
  const innerWidth  = Math.max(0, payload.width  - m.left - m.right  - p.left - p.right);
  const innerHeight = Math.max(0, payload.height - m.top  - m.bottom - p.top  - p.bottom);

  const data = props.data ?? [];
  const xAcc = props.xAccessor;
  const yAcc = props.yAccessor;

  const xs = data.map((d) => +xAcc(d)).filter(Number.isFinite);
  const xDomain = xs.length ? [Math.min(...xs), Math.max(...xs)] : [0, 1];
  const xScale = buildScale({
    type: props.xScaleType ?? "linear",
    domain: xDomain,
    range: [0, innerWidth],
    nice: false,
  });

  let yDomain = props.yDomain;
  if (!yDomain) {
    const ys = data.map((d) => +yAcc(d)).filter(Number.isFinite);
    yDomain = ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 1];
  }
  const yScale = buildScale({
    type: props.yScaleType ?? "linear",
    domain: yDomain,
    range: [innerHeight, 0],
    nice: true,
  });

  return { xScale, yScale, innerWidth, innerHeight, fromProjector: false, clampY: clampYFor(payload) };
}

// Whether rectPath should clamp y to the plot area. We clamp ONLY when the
// canvas does NOT zoom y — that's the LineChart case (y is the static value
// axis; clamping keeps a fixed-y rect out of the x-axis label margin). When
// the canvas DOES zoom y (ScatterPlot, zoomAxes:"xy"|"y"), clamping would pin
// an off-screen rect to the chart edge instead of letting it slide off as the
// viewport pans — which breaks the exit transition (the rect can't animate to
// "where it would be in the future"). x is never clamped for the same reason.
function clampYFor(payload) {
  const zoomAxes = payload?.zoomAxes ?? "xy";
  const yZooms = zoomAxes === "xy" || zoomAxes === "y";
  return !yZooms;
}

// Resolves the scales we'll project data through.  The canvas does the
// rescale for us — payload.xScale / payload.yScale on a draw signal are
// already zoom-aware — so we take them as-is when the host canvas
// exposes a projector with raw scales.  Otherwise we fall back to
// building scales from data (only ever exercised when the layer is
// used outside a cartesian chart).
function resolveScales(payload, props, m, p) {
  if (payload.projector?.type === "scale" && payload.xScale && payload.yScale) {
    const xr = payload.xScale.range();
    const yr = payload.yScale.range();
    return {
      xScale: payload.xScale,
      yScale: payload.yScale,
      innerWidth:  Math.abs(xr[1] - xr[0]),
      innerHeight: Math.abs(yr[0] - yr[1]),
      fromProjector: true,
      clampY: clampYFor(payload),
    };
  }
  return buildScalesFromData(payload, props, m, p);
}

// Clamp ±Infinity / null to the scale's domain edges so half-plane and
// "edge-anchored" rectangles render correctly.
function clampToDomain(v, domain) {
  if (v == null) return null;
  if (v === Infinity)  return Math.max(domain[0], domain[1]);
  if (v === -Infinity) return Math.min(domain[0], domain[1]);
  return v;
}

function applyRule(spec, data, scales, xAcc, yAcc) {
  const rule = spec.rule;
  if (typeof rule === "function") return rule(data, scales);
  if (!data?.length) return null;

  if (rule === "regressionCI") {
    const r = linearRegression(data, {
      x: xAcc, y: yAcc, ci: spec.ci ?? 0.95,
      domain: scales.xScale.domain(),
    });
    if (!r.band?.length) return null;
    return { ...spec, points: r.band };
  }
  return null;
}

// Normalise a user spec into either:
//   { id, kind: "rect", x1, y1, x2, y2, ...style }   data-space coords
//   { id, kind: "band", points: [{x, y0, y1}], ...style }
function normalizeSpec(spec, scales, data, props) {
  if (!spec) return null;
  const r = spec.rule ? applyRule(spec, data, scales, props.xAccessor, props.yAccessor) : spec;
  if (!r) return null;

  const xDomain = scales.xScale.domain();
  const yDomain = scales.yScale.domain();
  const xMin = Math.min(xDomain[0], xDomain[1]);
  const xMax = Math.max(xDomain[0], xDomain[1]);
  const yMin = Math.min(yDomain[0], yDomain[1]);
  const yMax = Math.max(yDomain[0], yDomain[1]);

  const style = {
    fill:            r.fill            ?? props.fill,
    fillOpacity:     r.fillOpacity     ?? props.fillOpacity,
    stroke:          r.stroke          ?? props.stroke,
    strokeWidth:     r.strokeWidth     ?? props.strokeWidth,
    strokeDasharray: r.strokeDasharray ?? props.strokeDasharray,
  };

  // Band (sample points over x)
  if (Array.isArray(r.points) && r.points.length) {
    return { id: spec.id, kind: "band", points: r.points, ...style };
  }

  // Half-plane variations
  let x1, y1, x2, y2;
  if (r.y != null && r.side) {
    // Horizontal half-plane
    x1 = xMin; x2 = xMax;
    if (r.side === "above") { y1 = r.y; y2 = yMax; }
    else                    { y1 = yMin; y2 = r.y; }
  } else if (r.x != null && r.side) {
    // Vertical half-plane
    y1 = yMin; y2 = yMax;
    if (r.side === "right") { x1 = r.x; x2 = xMax; }
    else                    { x1 = xMin; x2 = r.x; }
  } else if (r.x1 != null || r.y1 != null) {
    // Rectangle (any corner ±Infinity → chart edge)
    x1 = clampToDomain(r.x1, [xMin, xMax]) ?? xMin;
    x2 = clampToDomain(r.x2, [xMin, xMax]) ?? xMax;
    y1 = clampToDomain(r.y1, [yMin, yMax]) ?? yMin;
    y2 = clampToDomain(r.y2, [yMin, yMax]) ?? yMax;
  } else {
    return null;
  }

  return { id: spec.id, kind: "rect", x1, y1, x2, y2, ...style };
}

function rectPath(d, scales) {
  const sx1 = scales.xScale(d.x1);
  const sx2 = scales.xScale(d.x2);
  const sy1 = scales.yScale(d.y1);
  const sy2 = scales.yScale(d.y2);
  // x is NOT clamped — rects outside the visible x-domain slide off-canvas as
  // an update transition (preserving the D3 element) instead of exiting.
  // y is clamped ONLY when the canvas doesn't zoom y (LineChart): keeps a
  // fixed-y rect out of the x-axis label margin. When y zooms (ScatterPlot),
  // y is left unclamped too, so a rect whose y has scrolled off-screen slides
  // off rather than pinning to the edge — which is what makes the exit
  // transition animate to its future position instead of snapping.
  const h = scales.innerHeight;
  const xa = Math.min(sx1, sx2);
  const xb = Math.max(sx1, sx2);
  let ya = Math.min(sy1, sy2);
  let yb = Math.max(sy1, sy2);
  if (scales.clampY !== false) {
    ya = Math.max(0, Math.min(h, ya));
    yb = Math.max(0, Math.min(h, yb));
  }
  return `M${xa},${ya} L${xb},${ya} L${xb},${yb} L${xa},${yb} Z`;
}

function bandPath(d, scales) {
  // Path: trace upper boundary left→right, then lower boundary right→left.
  const pts = d.points;
  if (!pts?.length) return "";
  const sx = (p) => scales.xScale(p.x);
  const upper = pts.map((p) => `${sx(p)},${scales.yScale(p.y1)}`);
  const lower = pts.slice().reverse().map((p) => `${sx(p)},${scales.yScale(p.y0)}`);
  return `M${upper.join(" L")} L${lower.join(" L")} Z`;
}

function pathFor(d, scales) {
  return d.kind === "rect" ? rectPath(d, scales) : bandPath(d, scales);
}

export function createRefAreaLayer() {
  const base = createLayer({ className: "ref-area-layer", prefer: "inner" });

  let contentG    = null;
  let areasG      = null;
  let lastPayload = null;
  let lastProps   = null;

  function initGroups(payload, layerContainer) {
    const outerG = base.ensureGroup(payload, layerContainer);
    if (contentG) return;
    contentG = outerG.append("g");
    areasG   = contentG.append("g").attr("class", "areas").style("pointer-events", "none");
  }

  // Classic d3 join.  When the host chart fires a draw with a new
  // projector (data change OR programmatic zoom — both arrive the same way
  // now), `pathFor(d, scales)` is the new target shape and d3 string-
  // interpolates `d` from current to target over `duration`.  When the
  // user pans/wheels interactively, `onZoom` calls render with
  // duration=0 and the `d` snaps each frame.  Same code path, two
  // durations, no per-tween bookkeeping.
  function drawAreas({ resolved, scales, payload, duration, ease }) {
    const svgEl = payload.svgEl;
    const fill   = (d) => resolveFill(d.fill,   svgEl) ?? "rgba(0,0,0,0.1)";
    const stroke = (d) => resolveFill(d.stroke, svgEl) ?? "none";
    const easeFn = resolveEase(ease);

    // Entering areas start at their previous-frame pixel position so they
    // slide in from the existing viewport rather than appearing in-place.
    const prevScales = payload.prevXScale && payload.prevYScale
      ? { ...scales, xScale: payload.prevXScale, yScale: payload.prevYScale }
      : null;

    const sel = areasG.selectAll("path.ref-area").data(resolved, (d) => d.id);

    const enter = sel.enter().append("path")
      .attr("class", "ref-area")
      .attr("fill",             fill)
      .attr("fill-opacity",     (d) => d.fillOpacity)
      .attr("stroke",           stroke)
      .attr("stroke-width",     (d) => d.strokeWidth)
      .attr("stroke-dasharray", (d) => d.strokeDasharray)
      .attr("d",                (d) => pathFor(d, prevScales ?? scales))
      .attr("opacity", 0);

    enter.call((e) => duration > 0
      ? e.transition().duration(duration).ease(easeFn)
          .attr("opacity", 1)
          .attr("d", (d) => pathFor(d, scales))
      : e.attr("opacity", 1).attr("d", (d) => pathFor(d, scales)));

    const update = sel;
    if (duration > 0) {
      update.transition().duration(duration).ease(easeFn)
        .attr("d",                (d) => pathFor(d, scales))
        .attr("fill",             fill)
        .attr("fill-opacity",     (d) => d.fillOpacity)
        .attr("stroke",           stroke)
        .attr("stroke-width",     (d) => d.strokeWidth)
        .attr("stroke-dasharray", (d) => d.strokeDasharray)
        .attr("opacity", 1);
    } else {
      update
        .attr("d",                (d) => pathFor(d, scales))
        .attr("fill",             fill)
        .attr("fill-opacity",     (d) => d.fillOpacity)
        .attr("stroke",           stroke)
        .attr("stroke-width",     (d) => d.strokeWidth)
        .attr("stroke-dasharray", (d) => d.strokeDasharray)
        .attr("opacity", 1);
    }

    sel.exit().call((e) => duration > 0
      ? e.transition().duration(duration).ease(easeFn)
          .attr("opacity", 0)
          .attr("d", (d) => pathFor(d, scales))
          .remove()
      : e.remove());
  }

  function render(payload, props) {
    if (!payload?.svgEl) return;
    lastPayload = payload;
    lastProps   = props;

    initGroups(payload, props.layerContainer?.value ?? props.layerContainer ?? null);
    // Ref layers always redraw on zoom via rescaled scales — they never
    // ride the canvas's group transform.
    base.group?.attr("transform", null);

    const cm = payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const m  = props.margin  ?? cm;
    const p  = props.padding ?? payload.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };

    const scales = resolveScales(payload, props, m, p);
    if (!scales.xScale || !scales.yScale) return;

    const duration = props.duration ?? payload.duration ?? 0;

    if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[refAreaLayer] render", {
        duration,
        xDomain: scales.xScale.domain?.(),
        areasCount: (props.areas ?? []).length,
      });
    }

    // contentG translate = chartM + chartP - canvasM.  Same convention as
    // refLineLayer — works for both LineChart-style and ScatterPlot-style.
    const dx = m.left + p.left - cm.left;
    const dy = m.top  + p.top  - cm.top;
    contentG.attr("transform", (dx || dy) ? `translate(${dx}, ${dy})` : null);

    const data = props.data ?? [];
    const resolved = (props.areas ?? [])
      .map((spec) => normalizeSpec(spec, scales, data, props))
      .filter(Boolean);

    drawAreas({ resolved, scales, payload, duration, ease: props.ease ?? payload.ease });
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    if (!lastPayload || !lastProps) return;
    base.onZoom(transform);
    base.group?.attr("transform", null);
    // Enrich the stashed payload with the fresh canvas-rescaled scales
    // for this zoom frame so render() doesn't have to compute them
    // itself.  Falls back to applying the transform manually if the
    // signal was legacy-shaped (raw d3.ZoomTransform).
    const xScale = zoomArg?.xScale
      ?? (transform && lastPayload.projector?.raw?.xScale ? transform.rescaleX(lastPayload.projector.raw.xScale) : null);
    const yScale = zoomArg?.yScale
      ?? (transform && lastPayload.projector?.raw?.yScale ? transform.rescaleY(lastPayload.projector.raw.yScale) : null);
    render({ ...lastPayload, xScale, yScale, zoomTransform: transform },
           { ...lastProps, duration: 0 });
  }

  function destroy() {
    const dur = lastPayload?.duration ?? lastProps?.duration ?? 0;
    if (dur > 0 && areasG) {
      const aG   = areasG;
      const ease = resolveEase(lastProps?.ease ?? lastPayload?.ease);
      const cm = lastPayload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const m  = lastProps.margin  ?? cm;
      const p  = lastProps.padding ?? lastPayload.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const scales = resolveScales(lastPayload, lastProps, m, p);
      const t = aG.selectAll("path.ref-area")
        .transition().duration(dur).ease(ease)
        .attr("opacity", 0);
      if (scales) t.attr("d", (d) => pathFor(d, scales));
      t.remove();
      base.detach();
    } else {
      base.destroy();
    }
    contentG = areasG = null;
    lastPayload = lastProps = null;
  }

  return {
    render,
    rerender(props) { if (lastPayload) render(lastPayload, props); },
    onZoom,
    setOrder: (o) => base.setOrder(o),
    destroy,
  };
}
