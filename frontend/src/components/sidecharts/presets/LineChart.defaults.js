import { GLOBAL_DEFAULTS } from "../defaults.js";
import { LINE_LAYER_DEFAULTS } from "../core/lineLayer.js";
import { YAXIS_LAYER_DEFAULTS } from "../core/yAxisLayer.js";

export const LINE_CHART_DEFAULTS = {
  // sample data
  data: [
    {
      id: "y-2000",
      name: "2000",
      values: {
        val1: { id: "val1", name: "Val 1", value: 20 },
        val2: { id: "val2", name: "Val 2", value: 10 },
      },
    },
    {
      id: "y-2001",
      name: "2001",
      values: {
        val1: { id: "val1", name: "Val 1", value: 20 },
        val2: { id: "val2", name: "Val 2", value: 50 },
      },
    },
    {
      id: "y-2002",
      name: "2002",
      values: {
        val1: { id: "val1", name: "Val 1", value: 30 },
        val2: { id: "val2", name: "Val 2", value: 50 },
      },
    },
    {
      id: "y-2003",
      name: "2003",
      values: {
        val1: { id: "val1", name: "Val 1", value: 34 },
        val2: { id: "val2", name: "Val 2", value: 12 },
      },
    },
    {
      id: "y-2004",
      name: "2004",
      values: {
        val1: { id: "val1", name: "Val 1", value: 60 },
        val2: { id: "val2", name: "Val 2", value: 20 },
      },
    },
  ],

  // preset-owned
  color: { val1: "#3b82f6", val2: "#f59e0b" },
  margin: { top: 12, end: 1, bottom: 20, start: 7 },
  padding: { top: 0, end: 16, bottom: 0, start: 32 },
  showXAxis: true,
  showYAxis: true,
  showYGrid: true,
  yGridColor: "#e5e7eb",
  yTickSize: 6,
  yGridOpacity: 1,
  showXGrid: false,
  xGridColor: "#e5e7eb",
  xGridOpacity: 1,

  // forwarded from layer defaults
  duration: GLOBAL_DEFAULTS.duration,
  ease: LINE_LAYER_DEFAULTS.ease,
  scaleType: LINE_LAYER_DEFAULTS.scaleType,
  xScaleType: LINE_LAYER_DEFAULTS.xScaleType,
  max: LINE_LAYER_DEFAULTS.max,
  forceValues: LINE_LAYER_DEFAULTS.forceValues,
  stacked: LINE_LAYER_DEFAULTS.stacked,
  keys: LINE_LAYER_DEFAULTS.keys,
  curve: LINE_LAYER_DEFAULTS.curve,
  strokeWidth: LINE_LAYER_DEFAULTS.strokeWidth,
  strokeOpacity: LINE_LAYER_DEFAULTS.strokeOpacity,
  strokeDasharray: LINE_LAYER_DEFAULTS.strokeDasharray,
  dotRadius: LINE_LAYER_DEFAULTS.dotRadius,
  dotColor:  LINE_LAYER_DEFAULTS.dotColor,
  highlighted: LINE_LAYER_DEFAULTS.highlighted,
  dimOpacity: LINE_LAYER_DEFAULTS.dimOpacity,
  highlightedColor: LINE_LAYER_DEFAULTS.highlightedColor,
  defaultColor: LINE_LAYER_DEFAULTS.defaultColor,
  yNumTicks: YAXIS_LAYER_DEFAULTS.numTicks,

  // hover events
  hoverMode: "x-proximity",                                     // "x-proximity" | null  (voronoi reserved)
  showHoverLine:      LINE_LAYER_DEFAULTS.showHoverLine,
  hoverLineColor:     LINE_LAYER_DEFAULTS.hoverLineColor,
  hoverLineWidth:     LINE_LAYER_DEFAULTS.hoverLineWidth,
  hoverLineDasharray: LINE_LAYER_DEFAULTS.hoverLineDasharray,

  // external selection
  selectedX:                  LINE_LAYER_DEFAULTS.selectedX,
  selectedKey:                LINE_LAYER_DEFAULTS.selectedKey,
  selectedDotRadius:          LINE_LAYER_DEFAULTS.selectedDotRadius,
  selectedDotStroke:          LINE_LAYER_DEFAULTS.selectedDotStroke,
  selectedDotStrokeWidth:     LINE_LAYER_DEFAULTS.selectedDotStrokeWidth,
  selectedDotStrokeDasharray: LINE_LAYER_DEFAULTS.selectedDotStrokeDasharray,
  showLastPoint:     LINE_LAYER_DEFAULTS.showLastPoint,
  selectionDuration: LINE_LAYER_DEFAULTS.selectionDuration,

  // zoom
  allowZoom: false,
  maxZoom: 8,
  zoomAxes: "x",          // layers rescale x only (user pans + programmatic)
  userZoomAxes: null,     // null = same as zoomAxes; set "x" to keep user x-only
                          // while programmatic zoomToDomain can still set y

  // RTL
  rtl:       false,
  yAxisSide: "start",

  // null / passthrough
  yTickValues: null,
  xTickValues: null,
  yTickColor: null,
  yTickTextColor: null,
  yGridDasharray: null,
  xGridDasharray: null,
  format: (d) => d,
};

export const LINE_CHART_META = {
  sections: {
    animation: ["duration", "ease"],
    scale: ["scaleType", "xScaleType", "stacked", "max", "forceValues"],
    axes: [
      "showXAxis",
      "showYAxis",
      "showYGrid",
      "yGridColor",
      "yGridOpacity",
      "yGridDasharray",
      "showXGrid",
      "xGridColor",
      "xGridOpacity",
      "xGridDasharray",
      "yTickSize",
      "yTickColor",
      "yTickTextColor",
      "yNumTicks",
    ],
    line: ["curve", "strokeWidth", "strokeOpacity", "dotRadius"],
    highlight: ["highlighted", "dimOpacity", "highlightedColor"],
    selection: ["selectedX", "selectedDotRadius", "showLastPoint", "selectionDuration"],
    hover: ["showHoverLine", "hoverLineColor", "hoverLineWidth", "hoverLineDasharray"],
    visuals: ["color", "defaultColor"],
    interaction: ["allowZoom", "maxZoom"],
  },
  props: {
    duration: { min: 0, max: 2000, step: 50, unit: "ms" },
    strokeWidth: { min: 0, max: 10, step: 0.5 },
    strokeOpacity: { min: 0, max: 1, step: 0.05 },
    dotRadius: { min: 0, max: 10, step: 0.5 },
    max: { min: 0, max: 200, step: 1 },
    yGridOpacity: { min: 0, max: 1, step: 0.05 },
    xGridOpacity: { min: 0, max: 1, step: 0.05 },
    yTickSize: { min: 0, max: 20, step: 1 },
    yNumTicks: { min: 0, max: 20, step: 1 },
    ease: {
      options: [
        "easeLinear",
        "easeCubic",
        "easeQuad",
        "easeBackOut",
        "easeSinInOut",
        "easeBounceOut",
      ],
    },
    scaleType: { options: ["linear", "log", "sqrt", "pow"] },
    xScaleType: { options: ["linear", "time", "sqrt", "log", "pow"] },
    curve: {
      options: [
        "curveLinear",
        "curveMonotoneX",
        "curveBasis",
        "curveStep",
        "curveStepBefore",
        "curveStepAfter",
        "curveCardinal",
        "curveCatmullRom",
      ],
    },
    yGridColor: { type: "color" },
    xGridColor: { type: "color" },
    yTickColor: { type: "color" },
    yTickTextColor: { type: "color" },
    defaultColor: { type: "color" },
    hoverLineColor: { type: "color" },
    color: { type: "color-map" },
    maxZoom: { min: 1, max: 20, step: 1 },
    dimOpacity: { min: 0, max: 1, step: 0.05 },
    selectedDotRadius: { min: 0, max: 16, step: 0.5 },
    selectionDuration: { min: 0, max: 1500, step: 50, unit: "ms" },
    hoverLineWidth: { min: 0, max: 5, step: 0.5 },
    hoverMode: { skip: true },
    margin: { skip: true },
    padding: { skip: true },
    keys: { skip: true },
    data: { skip: true },
    highlighted: { skip: true },
    forceValues: { skip: true },
    strokeDasharray: { skip: true },
    yTickValues: { skip: true },
    xTickValues: { skip: true },
    yGridDasharray: { skip: true },
    xGridDasharray: { skip: true },
    hoverLineDasharray: { skip: true },
    highlightedColor: { skip: true },
    selectedX: { skip: true },
    dotColor: { skip: true },
    format: { skip: true },
  },
};
