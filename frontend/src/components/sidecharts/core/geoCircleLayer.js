import * as d3 from "d3";
import { createLayer } from "./layer.js";

export const GEO_CIRCLE_LAYER_DEFAULTS = {
  color:       "#3b82f6",
  radius:      5,
  fillOpacity: 0.15,
};

export function createGeoCircleLayer() {
  const base    = createLayer({ className: "geo-circle-layer" });
  let lastProps = null;
  let lastProj  = null;
  let circleEl  = null;
  let svgEl     = null;

  function renderCircle(center) {
    if (!circleEl || !lastProj) return;
    const { radius = GEO_CIRCLE_LAYER_DEFAULTS.radius } = lastProps ?? {};
    circleEl.attr("d", d3.geoPath(lastProj)(d3.geoCircle().center(center).radius(radius)()));
  }

  function renderAtViewportCenter() {
    if (!base.group || !lastProj) return;
    const svg = base.group.node().ownerSVGElement;
    const { width, height } = svg.getBoundingClientRect();
    const geo = lastProj.invert?.([width / 2, height / 2]);
    if (geo && isFinite(geo[0]) && isFinite(geo[1])) renderCircle(geo);
  }

  function onMouseMove(event) {
    if (!base.group || !lastProj || !circleEl) return;
    const [x, y] = d3.pointer(event, base.group.node());
    const geo = lastProj.invert?.([x, y]);
    if (!geo || !isFinite(geo[0]) || !isFinite(geo[1])) return;
    renderCircle(geo);
  }

  function onMouseLeave() {
    renderAtViewportCenter();
  }

  function attachListeners(el) {
    d3.select(el)
      .on("mousemove.geocircle",  onMouseMove)
      .on("mouseleave.geocircle", onMouseLeave);
  }

  function detachListeners(el) {
    if (!el) return;
    d3.select(el)
      .on("mousemove.geocircle",  null)
      .on("mouseleave.geocircle", null);
  }

  function render(payload, props) {
    if (!payload) return;
    const g = base.ensureGroup(payload, props.layerContainer?.value ?? null);
    lastProps = props;
    lastProj  = payload.projection;

    const {
      color       = GEO_CIRCLE_LAYER_DEFAULTS.color,
      fillOpacity = GEO_CIRCLE_LAYER_DEFAULTS.fillOpacity,
    } = props;

    circleEl = g
      .selectAll("path.geo-circle")
      .data([null])
      .join("path")
      .attr("class",          "geo-circle")
      .attr("fill",           color)
      .attr("fill-opacity",   fillOpacity)
      .attr("stroke",         color)
      .attr("stroke-width",   1.5)
      .attr("stroke-opacity", 0.8)
      .attr("pointer-events", "none");

    const newSvg = g.node().ownerSVGElement;
    if (svgEl !== newSvg) {
      detachListeners(svgEl);
      svgEl = newSvg;
      attachListeners(svgEl);
    }

    renderAtViewportCenter();
  }

  function rerender(props) {
    lastProps = props;
    if (!base.group || !lastProj) return;
    const {
      color       = GEO_CIRCLE_LAYER_DEFAULTS.color,
      fillOpacity = GEO_CIRCLE_LAYER_DEFAULTS.fillOpacity,
    } = props;
    circleEl
      ?.attr("fill",         color)
       .attr("fill-opacity", fillOpacity)
       .attr("stroke",       color);
    renderAtViewportCenter();
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
  }

  function destroy() {
    detachListeners(svgEl);
    svgEl    = null;
    circleEl = null;
    lastProj  = null;
    lastProps = null;
    base.destroy();
  }

  return { render, rerender, onZoom, setOrder: (order) => base.setOrder(order), setVisible: (...a) => base.setVisible(...a), destroy };
}
