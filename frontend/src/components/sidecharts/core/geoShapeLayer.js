import * as d3 from "d3";
import { createLayer } from "./layer.js";
import { resolveFill } from "../fill/resolveFill";

export const GEO_SHAPE_LAYER_DEFAULTS = {
  color:       "#3b82f6",
  fillOpacity: 0.2,
  stroke:      "white",
  strokeWidth: 1,
};

export function createGeoShapeLayer() {
  const base    = createLayer({ className: "geo-shape-layer" });
  let lastProps = null;
  let lastProj  = null;
  let shapeEl   = null;
  let svgEl     = null;
  let centroid  = null;

  function renderShape(target) {
    const feat = lastProps?.feature ?? null;
    if (!feat || !centroid || !lastProj || !shapeEl) return;

    const dLon = target[0] - centroid[0];
    const dLat = target[1] - centroid[1];

    const transform = d3.geoTransform({
      point(lon, lat) {
        const pt = lastProj([lon + dLon, Math.max(-89, Math.min(89, lat + dLat))]);
        if (pt) this.stream.point(pt[0], pt[1]);
      },
    });

    shapeEl.attr("d", d3.geoPath(transform)(feat));
  }

  function renderAtViewportCenter() {
    if (!base.group || !lastProj) return;
    const svg = base.group.node().ownerSVGElement;
    const { width, height } = svg.getBoundingClientRect();
    const geo = lastProj.invert?.([width / 2, height / 2]);
    if (geo && isFinite(geo[0]) && isFinite(geo[1])) renderShape(geo);
  }

  function onMouseMove(event) {
    if (!base.group || !lastProj) return;
    const [x, y] = d3.pointer(event, base.group.node());
    const geo = lastProj.invert?.([x, y]);
    if (!geo || !isFinite(geo[0]) || !isFinite(geo[1])) return;
    renderShape(geo);
  }

  function onMouseLeave() {
    renderAtViewportCenter();
  }

  function attachListeners(el) {
    d3.select(el)
      .on("mousemove.geoshape",  onMouseMove)
      .on("mouseleave.geoshape", onMouseLeave);
  }

  function detachListeners(el) {
    if (!el) return;
    d3.select(el)
      .on("mousemove.geoshape",  null)
      .on("mouseleave.geoshape", null);
  }

  function applyShapeAttrs(g, props) {
    const {
      color       = GEO_SHAPE_LAYER_DEFAULTS.color,
      fillOpacity = GEO_SHAPE_LAYER_DEFAULTS.fillOpacity,
      stroke      = GEO_SHAPE_LAYER_DEFAULTS.stroke,
      strokeWidth = GEO_SHAPE_LAYER_DEFAULTS.strokeWidth,
    } = props;

    const resolvedColor = resolveFill(
      typeof color === "function" ? color() : color,
      g.node().ownerSVGElement,
    ) ?? "#3b82f6";

    return shapeEl
      .attr("fill",         resolvedColor)
      .attr("fill-opacity", fillOpacity)
      .attr("stroke",       stroke)
      .attr("stroke-width", strokeWidth);
  }

  function render(payload, props) {
    if (!payload) return;
    const g = base.ensureGroup(payload, props.layerContainer?.value ?? null);
    lastProps = props;
    lastProj  = payload.projection;

    shapeEl = g
      .selectAll("path.geo-shape")
      .data([null])
      .join("path")
      .attr("class",           "geo-shape")
      .attr("stroke-linejoin", "round")
      .attr("pointer-events",  "none");

    applyShapeAttrs(g, props);

    if (props.feature) centroid = d3.geoCentroid(props.feature);

    const newSvg = g.node().ownerSVGElement;
    if (svgEl !== newSvg) {
      detachListeners(svgEl);
      svgEl = newSvg;
      attachListeners(svgEl);
    }

    renderAtViewportCenter();
  }

  function rerender(props) {
    const featureChanged = props.feature !== lastProps?.feature;
    lastProps = props;
    if (!base.group || !lastProj) return;
    if (featureChanged && props.feature) centroid = d3.geoCentroid(props.feature);
    applyShapeAttrs(base.group, props);
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
    shapeEl  = null;
    centroid = null;
    lastProj  = null;
    lastProps = null;
    base.destroy();
  }

  return { render, rerender, onZoom, setOrder: (order) => base.setOrder(order), setVisible: (...a) => base.setVisible(...a), destroy };
}
