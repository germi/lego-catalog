import * as d3 from "d3";
import { GLOBAL_DEFAULTS } from "../defaults.js";

export const ROSE_CANVAS_DEFAULTS = {
  duration:    GLOBAL_DEFAULTS.duration,
  highlighted: null,
  margin:      5,
  startAngle:  0,
  endAngle:    360,
  innerRadius: 0,
  scaleType:   "linear",
};

/**
 * Manages the centered SVG group for a rose chart.
 * Returns the D3 selection for the center group on each draw.
 */
export function createRoseCanvas() {
  let svgGroup = null;

  return {
    onDraw({ svgEl, width, height }) {
      if (!svgEl) return null;
      const w = width  ?? 200;
      const h = height ?? 200;
      const svgSel = d3.select(svgEl);
      let g = svgSel.select("g.rose-center");
      if (g.empty()) g = svgSel.append("g").attr("class", "rose-center");
      g.attr("transform", `translate(${w / 2} ${h / 2})`);
      svgGroup = g;
      return g;
    },

    getSvgGroup() { return svgGroup; },

    destroy() {
      svgGroup?.remove();
      svgGroup = null;
    },
  };
}
