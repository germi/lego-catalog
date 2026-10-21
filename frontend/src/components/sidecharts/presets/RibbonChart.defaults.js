import { GLOBAL_DEFAULTS }       from "../defaults.js";
import { RIBBON_LAYER_DEFAULTS } from "../core/ribbonLayer.js";
import { YAXIS_LAYER_DEFAULTS }  from "../core/yAxisLayer.js";

export const RIBBON_CHART_DEFAULTS = {
  // sample data
  data: [
    { id: "data-1", name: "Data 1", values: { val1: { id: "val1", name: "Val 1", value: 30, order: 1 }, val2: { id: "val2", name: "Val 2", value: 10, order: 2 } } },
    { id: "data-2", name: "Data 2", values: { val1: { id: "val1", name: "Val 1", value: 20, order: 2 }, val2: { id: "val2", name: "Val 2", value: 40, order: 1 } } },
    { id: "data-3", name: "Data 3", values: { val1: { id: "val1", name: "Val 1", value: 50, order: 1 }, val2: { id: "val2", name: "Val 2", value: 15, order: 2 } } },
  ],

  // preset-owned
  color:          { val1: "#eee", val2: "#ccc" },
  margin:         { top: 12, end: 1, bottom: 20, start: 7 },
  padding:        { top: 0, end: 0, bottom: 0, start: 40 },
  showXAxis:      true,
  showYAxis:      true,
  yGridColor:     "#e5e7eb",
  yTickSize:      6,
  yGridOpacity:   1,

  // forwarded from layer defaults
  duration:       GLOBAL_DEFAULTS.duration,
  ease:           RIBBON_LAYER_DEFAULTS.ease,
  rectStyle:      RIBBON_LAYER_DEFAULTS.rectStyle,
  max:            RIBBON_LAYER_DEFAULTS.max,
  scaleType:      RIBBON_LAYER_DEFAULTS.scaleType,
  paddingInner:   RIBBON_LAYER_DEFAULTS.paddingInner,
  paddingOuter:   RIBBON_LAYER_DEFAULTS.paddingOuter,
  bgColor:        RIBBON_LAYER_DEFAULTS.bgColor,
  format:         RIBBON_LAYER_DEFAULTS.format,
  stacked:        RIBBON_LAYER_DEFAULTS.stacked,
  keys:           RIBBON_LAYER_DEFAULTS.keys,
  useCurves:      RIBBON_LAYER_DEFAULTS.useCurves,
  useLines:       RIBBON_LAYER_DEFAULTS.useLines,
  linkOpacity:    RIBBON_LAYER_DEFAULTS.linkOpacity,
  linkDimOpacity: RIBBON_LAYER_DEFAULTS.linkDimOpacity,
  showLinks:      RIBBON_LAYER_DEFAULTS.showLinks,
  highlighted:            RIBBON_LAYER_DEFAULTS.highlighted,
  highlightFill:          RIBBON_LAYER_DEFAULTS.highlightFill,
  highlightFillOpacity:   RIBBON_LAYER_DEFAULTS.highlightFillOpacity,
  highlightStrokeColor:   RIBBON_LAYER_DEFAULTS.highlightStrokeColor,
  highlightStrokeWidth:   RIBBON_LAYER_DEFAULTS.highlightStrokeWidth,
  highlightStrokeOpacity: RIBBON_LAYER_DEFAULTS.highlightStrokeOpacity,
  dimFill:                RIBBON_LAYER_DEFAULTS.dimFill,
  dimOpacity:             RIBBON_LAYER_DEFAULTS.dimOpacity,
  dimStrokeColor:         RIBBON_LAYER_DEFAULTS.dimStrokeColor,
  dimStrokeWidth:         RIBBON_LAYER_DEFAULTS.dimStrokeWidth,
  dimStrokeOpacity:       RIBBON_LAYER_DEFAULTS.dimStrokeOpacity,
  yNumTicks:      YAXIS_LAYER_DEFAULTS.numTicks,

  // RTL
  rtl:            false,
  yAxisSide:      "start",

  // zoom
  allowZoom:      false,
  maxZoom:        8,
  // Ribbon zoom is x-only (categories on x, values on y) — like LineChart.
  // Keeps the y-axis + y-reading slotted layers (ref lines) stable on zoom;
  // the bars already zoom x-only internally.
  zoomAxes:       "x",

  // null / passthrough
  yTickValues:    null,
  xTickValues:    null,
  xTickAngle:     0,     // incline x tick labels (deg); >0 ends / <0 starts at tick
  xTickFontSize:  null,  // px; null = inherit from CSS
  xTickStagger:   1,     // stagger horizontal x labels across N rows (1 = off)
  xTickColor:     null,  // x-axis tick LINE color (null = inherit)
  xTickTextColor: null,  // x-axis tick LABEL color (null = inherit)
  yTickColor:     null,
  yTickTextColor: null,
  yGridDasharray: null,
};

export const RIBBON_CHART_META = {
  sections: {
    animation:   ["duration", "ease"],
    layout:      ["paddingInner", "paddingOuter"],
    scale:       ["scaleType", "stacked", "max"],
    axes:        ["showXAxis", "showYAxis", "yGridColor", "yGridOpacity", "yGridDasharray", "yTickSize", "yTickColor", "yTickTextColor", "yNumTicks"],
    links:       ["showLinks", "useCurves", "useLines", "linkOpacity", "linkDimOpacity"],
    visuals:     ["color", "bgColor"],
    interaction: ["allowZoom", "maxZoom"],
  },
  props: {
    duration:     { min: 0, max: 2000, step: 50, unit: "ms" },
    paddingInner: { min: 0, max: 1,    step: 0.01 },
    paddingOuter: { min: 0, max: 1,    step: 0.01 },
    linkOpacity:    { min: 0, max: 1,  step: 0.05 },
    linkDimOpacity: { min: 0, max: 1,  step: 0.05 },
    yGridOpacity: { min: 0, max: 1,    step: 0.05 },
    yTickSize:    { min: 0, max: 20,   step: 1 },
    yNumTicks:    { min: 0, max: 20,   step: 1 },
    max:          { min: 0, max: 200,  step: 1 },
    ease:         { options: ["easeLinear", "easeCubic", "easeQuad", "easeBackOut", "easeSinInOut", "easeBounceOut"] },
    scaleType:    { options: ["linear", "log", "sqrt", "pow"] },
    yGridColor:   { type: "color" },
    yTickColor:   { type: "color" },
    yTickTextColor: { type: "color" },
    bgColor:      { type: "color" },
    color:        { type: "color-map" },
    maxZoom:      { min: 1, max: 20, step: 1 },
    margin:       { skip: true },
    padding:      { skip: true },
    rectStyle:    { skip: true },
    format:       { skip: true },
    keys:         { skip: true },
    data:         { skip: true },
    highlighted:            { skip: true },
    highlightFill:          { skip: true },
    highlightFillOpacity:   { skip: true },
    highlightStrokeColor:   { skip: true },
    highlightStrokeWidth:   { skip: true },
    highlightStrokeOpacity: { skip: true },
    dimFill:                { skip: true },
    dimOpacity:             { skip: true },
    dimStrokeColor:         { skip: true },
    dimStrokeWidth:         { skip: true },
    dimStrokeOpacity:       { skip: true },
    yTickValues:  { skip: true },
    xTickValues:  { skip: true },
    yGridDasharray: { skip: true },
  },
};
