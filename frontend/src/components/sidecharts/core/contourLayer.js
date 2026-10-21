import * as d3 from "d3";
import { createLayer } from "./layer.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";

export const CONTOUR_LAYER_DEFAULTS = {
  data:        null,
  thresholds:  8,
  colorScale:  null,
  fillOpacity: 0.65,
  stroke:      "white",
  strokeWidth: 0.5,
  smooth:      true,
  duration:    GLOBAL_DEFAULTS.duration,
};

export function createContourLayer({ onHover = null, onClick = null } = {}) {
  const base      = createLayer({ className: "contour-layer" });
  let lastProps   = null;
  let lastPayload = null;

  function resolveGrid(data) {
    if (!data) return null;
    if (data.lons && data.lats && data.values) {
      return { values: data.values, lons: data.lons, lats: data.lats, nx: data.lons.length, ny: data.lats.length };
    }
    if (Array.isArray(data) && data.length > 0) {
      const lons   = [...new Set(data.map((d) => d.lon))].sort((a, b) => a - b);
      const lats   = [...new Set(data.map((d) => d.lat))].sort((a, b) => b - a);
      const nx     = lons.length;
      const ny     = lats.length;
      const lonIdx = new Map(lons.map((l, i) => [l, i]));
      const latIdx = new Map(lats.map((l, i) => [l, i]));
      const values = new Float32Array(nx * ny);
      for (const d of data) values[latIdx.get(d.lat) * nx + lonIdx.get(d.lon)] = d.value;
      return { values, lons, lats, nx, ny };
    }
    return null;
  }

  function renderLayer(g, projection, duration) {
    const props = lastProps ?? {};
    const {
      data,
      thresholds  = CONTOUR_LAYER_DEFAULTS.thresholds,
      colorScale  = CONTOUR_LAYER_DEFAULTS.colorScale,
      fillOpacity = CONTOUR_LAYER_DEFAULTS.fillOpacity,
      stroke      = CONTOUR_LAYER_DEFAULTS.stroke,
      strokeWidth = CONTOUR_LAYER_DEFAULTS.strokeWidth,
      smooth      = CONTOUR_LAYER_DEFAULTS.smooth,
    } = props;

    const grid = resolveGrid(data);
    if (!grid) { g.selectAll("path.contour").remove(); return; }

    const { values, lons, lats, nx, ny } = grid;
    const min      = d3.min(values);
    const max      = d3.max(values);
    const getColor = colorScale ?? d3.scaleSequential(d3.interpolateRdYlBu).domain([max, min]);

    const features = d3.contours().size([nx, ny]).thresholds(thresholds).smooth(smooth)(values);

    const lonSpan = lons[nx - 1] - lons[0];
    const latSpan = lats[ny - 1] - lats[0];

    const toScreen = d3.geoTransform({
      point(cx, cy) {
        const pt = projection([lons[0] + (cx / nx) * lonSpan, lats[0] + (cy / ny) * latSpan]);
        if (pt) this.stream.point(pt[0], pt[1]);
      },
    });
    const path = d3.geoPath(toScreen);

    const sel = g
      .selectAll("path.contour")
      .data(features, (d) => d.value)
      .join(
        (enter) => enter
          .append("path")
          .attr("class", "contour")
          .attr("fill", (d) => getColor(d.value))
          .attr("stroke", stroke)
          .attr("stroke-width", strokeWidth)
          .attr("stroke-linejoin", "round")
          .attr("d", path)
          .attr("fill-opacity", 0)
          .call((e) => e.transition().duration(duration).attr("fill-opacity", fillOpacity)),
        (update) => update.call((u) =>
          u.transition().duration(duration)
            .attr("fill", (d) => getColor(d.value))
            .attr("fill-opacity", fillOpacity)
            .attr("d", path),
        ),
        (exit) => exit.call((e) =>
          e.transition().duration(duration).attr("fill-opacity", 0).remove(),
        ),
      );

    sel
      .on("mouseover", onHover
        ? function (event, d) {
            d3.select(this).raise().attr("fill-opacity", Math.min(fillOpacity + 0.2, 1));
            onHover({ target: event.currentTarget, data: d });
          }
        : null)
      .on("mouseout", onHover
        ? function () {
            d3.select(this).attr("fill-opacity", fillOpacity);
            onHover(null);
          }
        : null)
      .on("click", onClick ? (_, d) => onClick(d) : null);
  }

  function render(payload, props) {
    if (!payload) return;
    const g = base.ensureGroup(payload, props.layerContainer?.value ?? null);
    lastPayload = payload;
    lastProps   = props;
    renderLayer(g, payload.projection, payload.duration ?? props.duration ?? CONTOUR_LAYER_DEFAULTS.duration);
  }

  function rerender(props) {
    lastProps = props;
    if (!base.group || !lastPayload) return;
    renderLayer(base.group, lastPayload.projection, props.duration ?? CONTOUR_LAYER_DEFAULTS.duration);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
  }

  function destroy() {
    base.destroy();
    lastProps   = null;
    lastPayload = null;
  }

  return { render, rerender, onZoom, setOrder: (order) => base.setOrder(order), setVisible: (...a) => base.setVisible(...a), destroy };
}
