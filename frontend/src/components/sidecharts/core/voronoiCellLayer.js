import { createLayer } from "./layer.js";
import { voronoiContentGroup, voronoiGestureTransform, recomputeStatic } from "./voronoiLayout.js";

export const VORONOI_CELL_LAYER_DEFAULTS = {
  showCells:       false,
  cellFill:        "transparent",
  cellFillOpacity: 0.05,
  cellStroke:      "#d1d5db",
  cellStrokeWidth: 0.5,
  showCentroids:   false,
  centroidColor:   "#9ca3af",
  centroidRadius:  2,
};

export function createVoronoiCellLayer() {
  const base      = createLayer({ className: "voronoi-cell-layer" });
  let lastPayload = null;
  let lastProps   = null;

  function draw(g, props, state) {
    const {
      showCells       = false,
      cellFill        = "transparent",
      cellFillOpacity = 0.05,
      cellStroke      = "#d1d5db",
      cellStrokeWidth = 0.5,
      showCentroids   = false,
      centroidColor   = "#9ca3af",
      centroidRadius  = 2,
    } = props ?? {};

    if (!showCells && !showCentroids) {
      g.selectAll(".voronoi-cell-bg").remove();
      g.selectAll(".voronoi-centroid-dot").remove();
      return;
    }

    if (!state?.cells?.length) return;
    const { cells, voronoi } = state;

    if (showCells) {
      g.selectAll("path.voronoi-cell-bg")
        .data(cells, (c) => c.data.id)
        .join("path")
        .attr("class", "voronoi-cell-bg")
        .attr("fill", cellFill)
        .attr("fill-opacity", cellFillOpacity)
        .attr("stroke", cellStroke)
        .attr("stroke-width", cellStrokeWidth)
        .attr("pointer-events", "none")
        .attr("d", (c) => voronoi.renderCell(c.index));
    } else {
      g.selectAll(".voronoi-cell-bg").remove();
    }

    if (showCentroids) {
      // Line from data point → voronoi centroid, showing the orient direction
      // that label layers use to decide where to place their label.
      g.selectAll("line.voronoi-centroid-line")
        .data(cells, (c) => c.data.id)
        .join("line")
        .attr("class", "voronoi-centroid-line")
        .attr("x1", (c) => c.data._x)
        .attr("y1", (c) => c.data._y)
        .attr("x2", (c) => c.centroid[0])
        .attr("y2", (c) => c.centroid[1])
        .attr("stroke", centroidColor)
        .attr("stroke-width", 0.75)
        .attr("stroke-dasharray", "3 2")
        .attr("pointer-events", "none");

      g.selectAll("circle.voronoi-centroid-dot")
        .data(cells, (c) => c.data.id)
        .join("circle")
        .attr("class", "voronoi-centroid-dot")
        .attr("cx", (c) => c.centroid[0])
        .attr("cy", (c) => c.centroid[1])
        .attr("r", centroidRadius)
        .attr("fill", centroidColor)
        .attr("pointer-events", "none");
    } else {
      g.selectAll(".voronoi-centroid-line").remove();
      g.selectAll(".voronoi-centroid-dot").remove();
    }
  }

  function render(payload, props, voronoiState) {
    if (!payload) return;
    // Recompute mode: cells are already in zoomed coordinates, so the group must
    // not also carry the transform. Set before ensureGroup so it applies cleanly.
    base.setStaticGroup(recomputeStatic(props, payload));
    // In scatter mode, append into the margin-offset inner group so cells share
    // the coordinate space of the dots.  Geo mode falls back to the SVG root.
    const g = base.ensureGroup(payload);
    lastPayload = payload;
    lastProps   = props;
    draw(voronoiContentGroup(g, payload), props, voronoiState);
  }

  function rerender(props, voronoiState) {
    lastProps = props;
    if (!lastPayload) return;
    base.setStaticGroup(recomputeStatic(props, lastPayload));
    // Re-run ensureGroup so the layer's data-order sort fires on every
    // rerender — otherwise sibling layers that re-render on data changes can
    // push this group out of position.
    const g = base.ensureGroup(lastPayload);
    draw(voronoiContentGroup(g, lastPayload), props, voronoiState);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
  }

  // Live-gesture path (option B): ride a zoom delta on the content group instead
  // of recomputing the Delaunay per frame. The provider drives this + re-tiles
  // once on settle.
  function applyGestureTransform(gesture) {
    if (base.group) voronoiGestureTransform(base.group, lastPayload, gesture?.d ?? null);
  }

  function destroy() {
    base.destroy();
    lastPayload = null;
    lastProps   = null;
  }

  return { render, rerender, onZoom, applyGestureTransform, setOrder: (order) => base.setOrder(order), destroy };
}
