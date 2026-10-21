import * as d3 from "d3";

export function createVoronoiCompute() {
  let lastProjectFn  = null;
  let lastSvgEl      = null;
  let lastInnerBounds = null;
  // Stored so the zoom path can pair the projector's own x/y accessors with the
  // LIVE zoomed scales from a zoom event (the same trick scatterLayer uses).
  let lastProjector  = null;

  // Build a project fn that positions through the given (zoomed) x/y scales plus
  // the projector's own value accessors — mirrors scatterLayer.buildProjectFn's
  // scale branch. Returns null for non-scale projectors (geo keeps its own path).
  function buildScaleFn(projector, xScale, yScale) {
    if (!projector || projector.type !== "scale" || !xScale || !yScale) return null;
    const xVal = projector.xAccessor ?? ((d) => d.x);
    const yVal = projector.yAccessor ?? ((d) => d.y);
    return (d) => {
      const x = xScale(xVal(d));
      const y = yScale(yVal(d));
      return isFinite(x) && isFinite(y) ? [x, y] : null;
    };
  }

  // Resolve a project function from either the rich projector object
  // (scatter / XY mode) or the legacy D3 geo projection (map mode).
  //
  // `zoomed` (recompute mode): project through the canvas's LIVE zoomed scales
  // (`payload.xScale` / `payload.yScale`) so cell positions follow zoom and the
  // diagram can be recomputed per zoom level. Falls back to the raw `projector.fn`
  // (literal mode — the default) when the zoomed scales aren't available.
  function resolveProjectFn(payload, zoomed = false) {
    if (zoomed) {
      const fn = buildScaleFn(
        payload.projector,
        payload.xScale ?? payload.projector?.raw?.xScale,
        payload.yScale ?? payload.projector?.raw?.yScale,
      );
      if (fn) return fn;
    }
    if (payload.projector?.fn) return payload.projector.fn;
    if (payload.projection)    return (d) => payload.projection([d.longitud, d.latitud]);
    return null;
  }

  function compute(data, projectFn, svgEl, innerBounds = null) {
    if (!data?.length || !projectFn) return null;

    const projected = data
      .map((d) => {
        const pt = projectFn(d);
        if (!pt || !isFinite(pt[0]) || !isFinite(pt[1])) return null;
        return { ...d, _x: pt[0], _y: pt[1] };
      })
      .filter(Boolean);

    if (projected.length < 2) return null;

    let svgWidth  = 960;
    let svgHeight = 500;
    if (svgEl) {
      const vb  = svgEl.viewBox?.baseVal;
      svgWidth  = vb?.width  || svgEl.clientWidth  || svgWidth;
      svgHeight = vb?.height || svgEl.clientHeight || svgHeight;
    }

    // When the projector outputs coordinates in an inner (margin-offset) space
    // — as the scatter scaleProjector does — the Voronoi bounds must match the
    // inner box, not the full SVG.  innerBounds is supplied by the payload.
    const bx0 = innerBounds?.x0 ?? 0;
    const by0 = innerBounds?.y0 ?? 0;
    const bx1 = innerBounds?.x1 ?? svgWidth;
    const by1 = innerBounds?.y1 ?? svgHeight;

    const delaunay = d3.Delaunay.from(projected, (d) => d._x, (d) => d._y);
    const voronoi  = delaunay.voronoi([bx0, by0, bx1, by1]);

    // Plot centre — used to orient labels for points that have no cell (their
    // pixel landed outside the bounds, e.g. zoomed off-viewport). We KEEP those
    // points so their labels never disappear; they just sit at their off-screen
    // position (clipped by the SVG) and point back toward the visible area.
    const cx = (bx0 + bx1) / 2;
    const cy = (by0 + by1) / 2;

    const cells = projected.map((d, i) => {
      const polygon = voronoi.cellPolygon(i);
      if (polygon) {
        const centroid = d3.polygonCentroid(polygon);
        const angle =
          (Math.round(
            (Math.atan2(centroid[1] - d._y, centroid[0] - d._x) / Math.PI) * 2,
          ) + 4) % 4;
        const orient = ["right", "bottom", "left", "top"][angle];
        // Expose the cell area so consumers (decluttering, biggest-cell label
        // anchoring) read it off the shared diagram instead of recomputing.
        return { data: d, index: i, polygon, centroid, orient, area: Math.abs(d3.polygonArea(polygon)) };
      }
      // No cell: orient toward the plot centre so a just-off-edge label points
      // back into view. centroid = centre so any cell-based consumer is sane.
      const angle =
        (Math.round((Math.atan2(cy - d._y, cx - d._x) / Math.PI) * 2) + 4) % 4;
      const orient = ["right", "bottom", "left", "top"][angle];
      return { data: d, index: i, polygon: null, centroid: [cx, cy], orient, area: 0 };
    });

    return { cells, voronoi, delaunay, projected, svgWidth, svgHeight };
  }

  // The Delaunay clip box = the plot rectangle in projector-output space.
  // Prefer the projector's scale RANGE: it is the true plot box (canvas minus
  // margin AND padding) and is identical across canvases, so cells clip to the
  // plotted area whether the host is a ScatterPlot (margin on canvas) or a
  // LineChart (margin+padding offset applied per layer). The range is the
  // UNZOOMED plot rect — correct and constant under zoom (zoom moves the points
  // within the fixed rect, not the rect). Falls back to the inner box for geo /
  // projectors without raw scales.
  function boundsFor(payload) {
    const raw = payload?.projector?.raw;
    if (raw?.xScale?.range && raw?.yScale?.range) {
      const xr = raw.xScale.range();
      const yr = raw.yScale.range();
      return {
        x0: Math.min(xr[0], xr[1]), y0: Math.min(yr[0], yr[1]),
        x1: Math.max(xr[0], xr[1]), y1: Math.max(yr[0], yr[1]),
      };
    }
    if (payload?.projector?.fn && payload.innerWidth != null && payload.innerHeight != null) {
      return { x0: 0, y0: 0, x1: payload.innerWidth, y1: payload.innerHeight };
    }
    return null;
  }

  function onDraw(payload, data, { zoomed = false } = {}) {
    lastProjector = payload.projector ?? null;
    lastProjectFn = resolveProjectFn(payload, zoomed);
    lastSvgEl     = payload.svgEl;
    lastInnerBounds = boundsFor(payload);
    return compute(data, lastProjectFn, payload.svgEl, lastInnerBounds);
  }

  function recompute(data) {
    if (!lastProjectFn) return null;
    return compute(data, lastProjectFn, lastSvgEl, lastInnerBounds);
  }

  // Recompute against a live zoom event `{ transform, xScale, yScale }` —
  // re-projects through the event's zoomed scales (paired with the projector
  // accessors stored on the last draw) and rebuilds the diagram. Reuses the
  // last svgEl + inner bounds. Returns null in literal mode / for non-scale
  // projectors, so callers can fall back to the group-transform zoom.
  function onZoom(zoomEvent, data) {
    const fn = buildScaleFn(lastProjector, zoomEvent?.xScale, zoomEvent?.yScale);
    if (!fn) return null;
    lastProjectFn = fn;
    return compute(data, fn, lastSvgEl, lastInnerBounds);
  }

  return { onDraw, recompute, onZoom };
}
