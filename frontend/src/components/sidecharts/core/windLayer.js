import * as d3 from "d3";
import { createLayer } from "./layer.js";

export const WIND_LAYER_DEFAULTS = {
  data:      [],
  color:     "#64748b",
  width:     1.5,
  maxLength: 24,
  minLength: 4,
  arrowSize: 5,
  maxSpeed:  null,
  opacity:   0.85,
  duration:  300,
};

export function createWindLayer({ onHover = null, onClick = null } = {}) {
  const base      = createLayer({ className: "wind-layer" });
  let lastProps   = null;
  let lastPayload = null;

  function arrowPath(d, projection, opts) {
    const { color, width, maxLength, minLength, arrowSize, domainMax } = opts;
    const tail = projection([d.lon, d.lat]);
    if (!tail) return "";

    const [x0, y0] = tail;
    const speed = Math.sqrt(d.u * d.u + d.v * d.v);
    if (speed === 0) return "";

    const uNorm = d.u / speed;
    const vNorm = d.v / speed;

    const tip = projection([d.lon + uNorm, Math.max(-89, Math.min(89, d.lat + vNorm))]);
    if (!tip) return "";

    const dx = tip[0] - x0;
    const dy = tip[1] - y0;
    const screenLen = Math.sqrt(dx * dx + dy * dy);
    if (screenLen === 0) return "";

    const dirX = dx / screenLen;
    const dirY = dy / screenLen;

    const shaftLen = minLength + (speed / domainMax) * (maxLength - minLength);
    const hx = x0 + dirX * shaftLen;
    const hy = y0 + dirY * shaftLen;

    const angle = Math.atan2(dirY, dirX);
    const WING  = (5 * Math.PI) / 6;
    const w1x = hx + Math.cos(angle + WING) * arrowSize;
    const w1y = hy + Math.sin(angle + WING) * arrowSize;
    const w2x = hx + Math.cos(angle - WING) * arrowSize;
    const w2y = hy + Math.sin(angle - WING) * arrowSize;

    return `M${x0},${y0}L${hx},${hy}L${w1x},${w1y}M${hx},${hy}L${w2x},${w2y}`;
  }

  function renderLayer(g, projection, duration) {
    const props = lastProps ?? {};
    const {
      data      = WIND_LAYER_DEFAULTS.data,
      color     = WIND_LAYER_DEFAULTS.color,
      width     = WIND_LAYER_DEFAULTS.width,
      maxLength = WIND_LAYER_DEFAULTS.maxLength,
      minLength = WIND_LAYER_DEFAULTS.minLength,
      arrowSize = WIND_LAYER_DEFAULTS.arrowSize,
      maxSpeed  = WIND_LAYER_DEFAULTS.maxSpeed,
      opacity   = WIND_LAYER_DEFAULTS.opacity,
    } = props;

    const domainMax = maxSpeed ?? d3.max(data, (d) => Math.sqrt(d.u * d.u + d.v * d.v)) ?? 1;
    const opts      = { color, width, maxLength, minLength, arrowSize, domainMax };

    const sel = g
      .selectAll("path.wind-arrow")
      .data(data, (d) => d._id ?? d.id)
      .join(
        (enter) => enter
          .append("path")
          .attr("class", "wind-arrow")
          .attr("fill", "none")
          .attr("stroke", (d) => d.color ?? color)
          .attr("stroke-width", width)
          .attr("stroke-linecap", "round")
          .attr("stroke-linejoin", "round")
          .attr("cursor", onHover || onClick ? "pointer" : null)
          .attr("d", (d) => arrowPath(d, projection, opts))
          .attr("opacity", 0)
          .call((e) => e.transition().duration(duration).attr("opacity", opacity)),
        (update) => update.call((u) =>
          u.transition().duration(duration)
            .attr("d", (d) => arrowPath(d, projection, opts))
            .attr("stroke", (d) => d.color ?? color),
        ),
        (exit) => exit.call((e) =>
          e.transition().duration(duration).attr("opacity", 0).remove(),
        ),
      );

    sel
      .on("mouseover", onHover
        ? function (event, d) {
            d3.select(this).raise().attr("opacity", 1);
            onHover({ target: event.currentTarget, data: d });
          }
        : null)
      .on("mouseout", onHover
        ? function () {
            d3.select(this).attr("opacity", opacity);
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
    renderLayer(g, payload.projection, payload.duration ?? props.duration ?? WIND_LAYER_DEFAULTS.duration);
  }

  function rerender(props) {
    lastProps = props;
    if (!base.group || !lastPayload) return;
    renderLayer(base.group, lastPayload.projection, props.duration ?? WIND_LAYER_DEFAULTS.duration);
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

export function windFromBearing(speed, bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { u: speed * Math.sin(rad), v: speed * Math.cos(rad) };
}

export function windFromMeteo(speed, fromDeg) {
  return windFromBearing(speed, (fromDeg + 180) % 360);
}
