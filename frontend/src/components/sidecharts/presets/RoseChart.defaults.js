import { GLOBAL_DEFAULTS }        from "../defaults.js";
import { SEGMENT_LAYER_DEFAULTS } from "../core/segmentLayer.js";
import { RADIAL_LABEL_LAYER_DEFAULTS } from "../core/radialLabelLayer.js";

export const ROSE_CHART_DEFAULTS = {
  // forwarded from layer defaults
  duration:           GLOBAL_DEFAULTS.duration,
  padRadius:          SEGMENT_LAYER_DEFAULTS.padRadius,
  cornerRadius:       SEGMENT_LAYER_DEFAULTS.cornerRadius,
  strokeColor:        SEGMENT_LAYER_DEFAULTS.strokeColor,
  strokeWidth:        SEGMENT_LAYER_DEFAULTS.strokeWidth,
  fillOpacity:        SEGMENT_LAYER_DEFAULTS.fillOpacity,
  textColor:          RADIAL_LABEL_LAYER_DEFAULTS.textColor,
  fontSize:           RADIAL_LABEL_LAYER_DEFAULTS.fontSize,
  valueFontSize:      RADIAL_LABEL_LAYER_DEFAULTS.valueFontSize,
  fontWeight:         RADIAL_LABEL_LAYER_DEFAULTS.fontWeight,
  valueFontWeight:    RADIAL_LABEL_LAYER_DEFAULTS.valueFontWeight,

  // preset-owned
  padAngle:           0,
  bgColor:            "#f3f4f6",
  hoverBgColor:       "#f9fafb",
  // Stroke color of the interactive hit-area SegmentLayer (template #before).
  // Defaults to SegmentLayer's own default so this is a no-op unless overridden.
  bgStrokeColor:      SEGMENT_LAYER_DEFAULTS.strokeColor,
  showCursorPointer:  true,
  labelsOutside:      true,
  circularLabels:     false,
  showLabels:         true,
  showValues:         false,
  // Which series (key into a multi-value item's `values` object) the label's
  // value tspan shows when showValues is on. null = the first series key.
  valueSeries:        null,
  margin:             5,
  startAngle:         0,
  endAngle:           360,
  innerRadius:        0,
  maxLabelWidth:      150,
  format:             (d) => (+d).toFixed(0) + "%",
  lineLabelDistance:  20,
  paddingLineLabel:   40,
  valueLabelColor:    "#6b7280",
  scaleType:          "linear",
  stacked:            false,
  showGrid:           false,
  gridColor:          "gray",
  gridStrokeDasharray: "4,4",
  tickColor:          "#6b7280",

  // null / passthrough
  max:                null,
  highlighted:        null,
};
