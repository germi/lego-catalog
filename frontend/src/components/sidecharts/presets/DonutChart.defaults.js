import { GLOBAL_DEFAULTS }        from "../defaults.js";
import { SEGMENT_LAYER_DEFAULTS } from "../core/segmentLayer.js";

export const DONUT_CHART_DEFAULTS = {
  // forwarded from layer defaults
  duration:           GLOBAL_DEFAULTS.duration,
  padRadius:          SEGMENT_LAYER_DEFAULTS.padRadius,
  cornerRadius:       SEGMENT_LAYER_DEFAULTS.cornerRadius,
  strokeColor:        SEGMENT_LAYER_DEFAULTS.strokeColor,
  strokeWidth:        SEGMENT_LAYER_DEFAULTS.strokeWidth,
  fillOpacity:        SEGMENT_LAYER_DEFAULTS.fillOpacity,

  // preset-owned
  padAngle:           0,
  bgColor:            "transparent",
  hoverBgColor:       "#f9fafb",
  showCursorPointer:  true,
  labelsOutside:      true,
  circularLabels:     false,
  showLabels:         true,
  showValues:         false,
  margin:             5,
  startAngle:         0,
  endAngle:           360,
  innerRadius:        0.4,
  maxLabelWidth:      150,
  format:             (d) => (+d).toFixed(0),
  valueLabelColor:    "#6b7280",
  textColor:          "#6b7280",
  ringGap:            2,
  groupBy:            "series",
  scaleType:          "linear",

  // null / passthrough
  max:                null,
  highlighted:        null,
};
