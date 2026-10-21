import { createLayer } from "./layer.js";
import { safeId } from "../utils/safeId.js";
import { voronoiContentGroup, voronoiGestureTransform, recomputeStatic } from "./voronoiLayout.js";

export const VORONOI_HOVER_LAYER_DEFAULTS = {
  ghostRadius: 8,
};

export function createVoronoiHoverLayer({
  onHover             = null,
  onClick             = null,
  onVoronoiHoverChange = null,
} = {}) {
  const base           = createLayer({ className: "voronoi-hover-layer" });
  let lastPayload      = null;
  let lastVoronoiState = null;
  let lastGhostRadius  = 8;

  function renderLayer(g, state, ghostR) {
    if (!state?.cells?.length) {
      g.selectAll("circle.voronoi-ghost").remove();
      g.selectAll("path.voronoi-cell").remove();
      return;
    }

    const { cells, voronoi } = state;

    if (ghostR > 0) {
      g.selectAll("circle.voronoi-ghost")
        .data(cells, (c) => c.data.id)
        .join("circle")
        .attr("class", "voronoi-ghost")
        .attr("data-ghost-id", (c) => safeId(c.data.id))
        .attr("cx", (c) => c.data._x)
        .attr("cy", (c) => c.data._y)
        .attr("r", ghostR)
        .attr("fill", "transparent")
        .attr("stroke", "none")
        .attr("pointer-events", "none");
    } else {
      g.selectAll("circle.voronoi-ghost").remove();
    }

    // Helper: find the ghost circle for a datum. Both the attribute value and
    // the selector use safeId() so they always match, with no CSS escaping needed.
    const ghostFor = (c) => {
      if (ghostR <= 0) return null;
      const el = g.node()?.querySelector(`[data-ghost-id="${safeId(c.data.id)}"]`);
      return el ?? null;
    };

    g.selectAll("path.voronoi-cell")
      .data(cells, (c) => c.data.id)
      .join("path")
      .attr("class", "voronoi-cell")
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .attr("cursor", "pointer")
      .attr("d", (c) => voronoi.renderCell(c.index))
      .on("mouseenter", function (event, c) {
        onVoronoiHoverChange?.(c);
        onHover?.({
          target: ghostFor(c) ?? event.target,
          data:   c.data,
          orient: c.orient,
          x:      c.data._x,
          y:      c.data._y,
        });
      })
      .on("mouseleave", function () {
        onVoronoiHoverChange?.(null);
        onHover?.(null);
      })
      .on("click", function (event, c) {
        onClick?.({ target: ghostFor(c) ?? event.target, data: c.data });
      });
  }

  function render(payload, props, voronoiState) {
    if (!payload) return;
    base.setStaticGroup(recomputeStatic(props, payload));
    const g = base.ensureGroup(payload);
    lastPayload      = payload;
    lastVoronoiState = voronoiState;
    lastGhostRadius  = props.ghostRadius ?? 8;
    renderLayer(voronoiContentGroup(g, payload), voronoiState, lastGhostRadius);
  }

  function rerender(props, voronoiState) {
    lastGhostRadius = props.ghostRadius ?? 8;
    if (voronoiState !== undefined) lastVoronoiState = voronoiState;
    if (!lastPayload) return;
    base.setStaticGroup(recomputeStatic(props, lastPayload));
    // Re-run ensureGroup so the layer's data-order sort fires on every
    // rerender — otherwise sibling layers that re-render on data changes can
    // push this group out of position.
    const g = base.ensureGroup(lastPayload);
    renderLayer(voronoiContentGroup(g, lastPayload), lastVoronoiState, lastGhostRadius);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
  }

  function applyGestureTransform(gesture) {
    if (base.group) voronoiGestureTransform(base.group, lastPayload, gesture?.d ?? null);
  }

  function destroy() {
    base.destroy();
    lastPayload      = null;
    lastVoronoiState = null;
  }

  return { render, rerender, onZoom, applyGestureTransform, setOrder: (order) => base.setOrder(order), setVisible: (...a) => base.setVisible(...a), destroy };
}
