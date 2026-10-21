import { createLayer } from "./layer.js";
import { resolveFill } from "../fill/resolveFill.js";
import { voronoiContentGroup, voronoiGestureTransform, recomputeStatic } from "./voronoiLayout.js";

export const VORONOI_MARKER_LAYER_DEFAULTS = {
  radius:        4,
  color:         "#3B82F6",
  colorAccessor: null,
  valueAccessor: null,
  fixedSize:     true,
  strokeWidth:   1,
  strokeColor:   "white",
  opacity:       1,
  duration:      300,
};

export function createVoronoiMarkerLayer({ onHover = null, onClick = null } = {}) {
  const base           = createLayer({ className: "voronoi-marker-layer" });
  let lastProps        = null;
  let lastPayload      = null;
  let lastK            = 1;
  let lastVoronoiState = null;

  function getRadius(c) {
    const { radius = 4, valueAccessor, fixedSize } = lastProps ?? {};
    const va    = valueAccessor ?? ((d) => d.value);
    const base_ = typeof radius === "function" ? radius(va(c.data)) : radius;
    return base_ / (fixedSize ? lastK : 1);
  }

  function getFill(c, svgEl) {
    const { color = "#3B82F6", colorAccessor, valueAccessor } = lastProps ?? {};
    const va = valueAccessor ?? ((d) => d.value);
    const ca = colorAccessor ?? va;
    if (typeof color === "function") return color(ca(c.data));
    return resolveFill(c.data.color, svgEl) ?? resolveFill(color, svgEl);
  }

  function renderMarkers(g, state, duration) {
    if (!state?.cells?.length) {
      g.selectAll("circle.voronoi-marker").remove();
      return;
    }

    const { cells } = state;
    const {
      strokeWidth = 1,
      strokeColor = "white",
      opacity     = 1,
      fixedSize   = true,
    } = lastProps ?? {};
    const svgEl = g.node().ownerSVGElement;
    const sw    = strokeWidth / (fixedSize ? lastK : 1);

    g.selectAll("circle.voronoi-marker")
      .data(cells, (c) => c.data.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "voronoi-marker")
            .attr("cx", (c) => c.data._x)
            .attr("cy", (c) => c.data._y)
            .attr("r", 0)
            .attr("fill", (c) => getFill(c, svgEl))
            .attr("stroke", strokeColor)
            .attr("stroke-width", sw)
            .attr("opacity", opacity)
            .attr("cursor", onHover || onClick ? "pointer" : null)
            .call((e) => e.transition().duration(duration).attr("r", (c) => getRadius(c))),
        (update) =>
          update.call((u) =>
            u.transition().duration(duration)
              .attr("cx", (c) => c.data._x)
              .attr("cy", (c) => c.data._y)
              .attr("r", (c) => getRadius(c))
              .attr("fill", (c) => getFill(c, svgEl))
              .attr("stroke-width", sw)
              .attr("opacity", opacity),
          ),
        (exit) =>
          exit.call((e) =>
            e.transition().duration(duration).attr("r", 0).attr("opacity", 0).remove(),
          ),
      )
      .on("mouseenter", onHover
        ? function (event, c) { onHover({ target: event.currentTarget, data: c.data }); }
        : null)
      .on("mouseleave", onHover ? () => onHover(null) : null)
      .on("click", onClick
        ? function (event, c) { onClick({ target: event.currentTarget, data: c.data }); }
        : null);
  }

  function render(payload, props, voronoiState) {
    if (!payload) return;
    base.setStaticGroup(recomputeStatic(props, payload));
    const g = base.ensureGroup(payload);
    lastPayload      = payload;
    lastProps        = props;
    // Recompute mode: no group scale → markers at natural size (kForFixed = 1).
    lastK            = base.staticGroup ? 1 : base.transform.k;
    lastVoronoiState = voronoiState;
    const duration   = payload.duration ?? props.duration ?? 300;
    renderMarkers(voronoiContentGroup(g, payload), voronoiState, duration);
  }

  function rerender(props, voronoiState) {
    lastProps = props;
    // Per-frame duration override carried on the state (renderDuration: 0 on
    // live interactive-zoom frames) so markers follow the cursor instead of
    // lagging behind a tween. See voronoiLabelLayer for the full rationale.
    let frameDuration;
    if (voronoiState !== undefined) {
      lastVoronoiState = voronoiState;
      frameDuration = voronoiState?.renderDuration;
    }
    if (!lastPayload) return;
    base.setStaticGroup(recomputeStatic(props, lastPayload));
    // Re-run ensureGroup so the layer's data-order sort fires on every
    // rerender — otherwise sibling layers that re-render on data changes can
    // push this group out of position.
    const g = base.ensureGroup(lastPayload);
    if (base.staticGroup) lastK = 1;
    renderMarkers(voronoiContentGroup(g, lastPayload), lastVoronoiState, frameDuration ?? props.duration ?? 300);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
    // Recompute mode: provider rebuilds + rerenders markers; nothing to scale here.
    if (base.staticGroup) { lastK = 1; return; }
    lastK = transform.k;
    if (!lastProps?.fixedSize || !base.group) return;
    const { strokeWidth = 1 } = lastProps;
    base.group.selectAll("circle.voronoi-marker")
      .attr("r", (c) => getRadius(c))
      .attr("stroke-width", strokeWidth / lastK);
  }

  function applyGestureTransform(gesture) {
    if (!base.group) return;
    voronoiGestureTransform(base.group, lastPayload, gesture?.d ?? null);
    // Counter the gesture scale on fixed-size markers so their radius stays
    // constant on screen during the drag (mirrors the static onZoom path).
    if (!lastProps?.fixedSize) return;
    const dk = gesture?.k ?? 1;
    const { strokeWidth = 1 } = lastProps;
    base.group.selectAll("circle.voronoi-marker")
      .attr("r", (c) => getRadius(c) / dk)
      .attr("stroke-width", strokeWidth / ((lastK || 1) * dk));
  }

  function destroy() {
    base.destroy();
    lastProps        = null;
    lastPayload      = null;
    lastVoronoiState = null;
  }

  return { render, rerender, onZoom, applyGestureTransform, setOrder: (order) => base.setOrder(order), setVisible: (...a) => base.setVisible(...a), destroy };
}
