import { GLOBAL_DEFAULTS }        from "../defaults.js";
import { SEGMENT_LAYER_DEFAULTS } from "../core/segmentLayer.js";

export const ROSE_SEGMENT_CHART_DEFAULTS = {
  // forwarded from layer defaults
  duration:           GLOBAL_DEFAULTS.duration,
  padAngle:           SEGMENT_LAYER_DEFAULTS.padAngle,
  padRadius:          SEGMENT_LAYER_DEFAULTS.padRadius,
  cornerRadius:       3,

  // preset-owned
  bgColor:            "transparent",
  hoverBgColor:       "#f9fafb",
  showCursorPointer:  true,
  labelsOutside:      true,
  circularLabels:     false,
  showLabels:         true,
  margin:             5,
  startAngle:         0,
  endAngle:           360,
  innerRadius:        0,
  maxLabelWidth:      150,
  bandOpacity:        0.5,
  bandStrokeWidth:    4,
  mainLineStrokeWidth: 4,
  showGrid:           true,
  gridColor:          "gray",
  gridStrokeDasharray: "4,4",
  tickColor:          "#6b7280",
  textColor:          "#6b7280",
  minAngle:           0.3,
  stacked:            false,
  scaleType:          "linear",

  // null / passthrough
  max:                null,
  highlighted:        null,
};
