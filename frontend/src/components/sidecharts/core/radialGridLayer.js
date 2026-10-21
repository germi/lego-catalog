import * as d3 from "d3";
import { buildScale } from "../utils/scale/buildScale.js";
import { createLayer } from "./layer.js";

export const RADIAL_GRID_LAYER_DEFAULTS = {
  max:                  100,
  scaleType:            null,
  gridColor:            "gray",
  gridStrokeDasharray:  "4,4",
  tickColor:            "#6b7280",
  tickCount:            5,
  order:                undefined,
};

export function createRadialGridLayer() {
  const base = createLayer({ className: "radial-grid-layer" });

  let axisContainer  = null;
  let yAxisContainer = null;
  let lastProps      = null;

  function ensureGroups(props) {
    const rc = props.roseControls;
    if (!rc?.svgGroup || !rc?.svgEl) return false;
    if (axisContainer) return true;
    const g = base.ensureGroup({ svgEl: rc.svgEl }, rc.svgGroup.node());
    axisContainer = g
      .append("g")
      .attr("class", "pointer-events-none")
      .attr("text-anchor", "middle")
      .attr("font-family", "inherit")
      .attr("font-size", 10);
    yAxisContainer = g.append("g").attr("class", "ot-y-axis");
    return true;
  }

  function render(payload, props) {
    if (!ensureGroups(props)) return;
    lastProps = props;
    base.setOrder(props.order);

    const rc        = props.roseControls;
    const innerR    = rc.innerRadius * rc.radius;
    const scaleType = props.scaleType ?? rc.scaleType;
    const y = buildScale({
      type:   scaleType === "linear" ? "linear" : "sqrt",
      domain: [0, props.max],
      range:  [innerR, rc.radius],
    });

    axisContainer
      .selectAll("circle")
      .data(y.ticks(props.tickCount).reverse(), (d) => d)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("stroke", props.gridColor)
            .attr("stroke-width", 1)
            .attr("stroke-dasharray", props.gridStrokeDasharray)
            .attr("fill", "none")
            .attr("r", y)
            .call((e) => e.transition().duration(rc.duration).attr("r", y)),
        (update) => update.transition().duration(rc.duration).attr("r", y),
        (exit)   => exit.remove(),
      );

    yAxisContainer
      .transition()
      .duration(rc.duration)
      .call(d3.axisLeft(y).ticks(props.tickCount).tickPadding(0).tickSize(0));

    yAxisContainer
      .attr("color", props.tickColor)
      .attr("font-size", "12px")
      .attr("font-weight", 500)
      .attr("font-family", "inherit")
      .attr("pointer-events", "none");

    yAxisContainer.selectAll("rect").remove();
    yAxisContainer.select(".domain").remove();

    if (yAxisContainer.selectAll(".tick").nodes().length) {
      yAxisContainer
        .selectAll(".tick")
        .append("rect")
        .attr("x", -12).attr("y", -7).attr("width", 24).attr("height", 14)
        .attr("fill", (_, i) => (i ? "#fff" : "transparent"));
      yAxisContainer.selectAll(".tick text").attr("text-anchor", "middle").raise();
    }
  }

  function destroy() {
    if (!base.group) return;
    const duration = lastProps?.roseControls?.duration ?? 300;
    const g = base.group;
    base.detach();
    g.transition().duration(duration).attr("opacity", 0).remove();
    axisContainer  = null;
    yAxisContainer = null;
  }

  return {
    render(payload, props) { render(payload, props); },
    rerender(props) { if (lastProps) render(null, props); },
    setOrder: (order) => base.setOrder(order),
    destroy,
  };
}
