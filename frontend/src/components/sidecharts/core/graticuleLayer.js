import * as d3 from "d3";
import { createLayer } from "./layer.js";

export const GRATICULE_LAYER_DEFAULTS = {
  step:         [10, 10],
  color:        "#94a3b8",
  width:        0.5,
  opacity:      0.5,
  outline:      false,
  outlineColor: null,
  outlineWidth: null,
  fixedSize:    false,
};

export function createGraticuleLayer() {
  const base      = createLayer({ className: "graticule-layer" });
  let lastProps   = null;
  let lastPayload = null;
  let lastK       = 1;

  function render(payload, props) {
    if (!payload) return;
    const g = base.ensureGroup(payload, props.layerContainer?.value ?? null);
    lastPayload = payload;
    lastProps   = props;
    lastK       = base.transform.k;

    const {
      step         = [10, 10],
      color        = "#94a3b8",
      width        = 0.5,
      opacity      = 0.5,
      outline      = false,
      fixedSize    = false,
    } = props;
    const outlineColor = props.outlineColor ?? color;
    const outlineWidth = props.outlineWidth ?? width * 2;

    const sw  = width        / (fixedSize ? lastK : 1);
    const osw = outlineWidth / (fixedSize ? lastK : 1);

    const graticule = d3.geoGraticule().step(step);
    const path      = d3.geoPath(payload.projection);

    g.selectAll("path.graticule-lines")
      .data([graticule()])
      .join("path")
      .attr("class", "graticule-lines")
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", sw)
      .attr("opacity", opacity)
      .attr("d", path);

    g.selectAll("path.graticule-outline")
      .data(outline ? [{ type: "Sphere" }] : [])
      .join("path")
      .attr("class", "graticule-outline")
      .attr("fill", "none")
      .attr("stroke", outlineColor)
      .attr("stroke-width", osw)
      .attr("opacity", opacity)
      .attr("d", path);
  }

  function rerender(props) {
    if (!base.group || !lastPayload) return;
    render(lastPayload, props);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
    lastK = transform.k;
    if (!lastProps?.fixedSize || !base.group) return;
    const { width = 0.5 } = lastProps;
    const outlineWidth = lastProps.outlineWidth ?? width * 2;
    base.group.selectAll("path.graticule-lines").attr("stroke-width",   width        / lastK);
    base.group.selectAll("path.graticule-outline").attr("stroke-width", outlineWidth / lastK);
  }

  function destroy() {
    base.destroy();
    lastProps   = null;
    lastPayload = null;
  }

  return { render, rerender, onZoom, setOrder: (order) => base.setOrder(order), destroy };
}
