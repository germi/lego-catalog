import { GLOBAL_DEFAULTS }              from "../defaults.js";
import { SCATTER_LAYER_DEFAULTS }       from "../core/scatterLayer.js";
import { AXIS_LAYER_DEFAULTS }          from "../core/axisLayer.js";
import { YAXIS_LAYER_DEFAULTS }         from "../core/yAxisLayer.js";
import { VORONOI_LABEL_LAYER_DEFAULTS } from "../core/voronoiLabelLayer.js";
import { VORONOI_CELL_LAYER_DEFAULTS }  from "../core/voronoiCellLayer.js";

export const SCATTER_PLOT_DEFAULTS = {
  // preset-owned (multi-layer concerns or overrides)
  margin:           { top: 16, end: 16, bottom: 40, start: 48 },
  // Inner inset between the margin and the plotted data area (px). Folded into
  // the scale range (via projector rangePad) AND fed to the axes so ticks, grid,
  // dots and axis lines all agree. Logical start/end keys are RTL-resolved.
  padding:          { top: 0, end: 0, bottom: 0, start: 0 },
  xAccessor:        (d) => d.x,
  yAccessor:        (d) => d.y,
  xScaleType:       "linear",
  yScaleType:       "linear",
  nice:             true,
  showXAxis:        true,
  showYAxis:        true,
  xAxisSide:        AXIS_LAYER_DEFAULTS.side,
  yAxisSide:        "start",
  rtl:              false,
  showGrid:         false,
  gridColor:        "#e5e7eb",
  yTextTicksInside: YAXIS_LAYER_DEFAULTS.textTicksInside,
  showLabels:       false,
  showHover:        true,
  showCells:        false,
  cellStroke:       VORONOI_CELL_LAYER_DEFAULTS.cellStroke,
  cellStrokeWidth:  VORONOI_CELL_LAYER_DEFAULTS.cellStrokeWidth,
  labelAccessor:    (d) => d.label ?? d.id,
  useVoronoiHover:  true,
  recomputeOnZoom:  true,
  // Interactive-zoom strategy when recomputeOnZoom is on: "live" (A, default —
  // recompute every frame, rAF-coalesced) or "settle" (B — ride a zoom delta
  // during the gesture, recompute once on end; cheaper, cells re-tile on release).
  zoomRecomputeMode: "live",
  labelOpacity:         VORONOI_LABEL_LAYER_DEFAULTS.opacity,
  labelOpacityAccessor: VORONOI_LABEL_LAYER_DEFAULTS.opacityAccessor,
  labelBgColor:         VORONOI_LABEL_LAYER_DEFAULTS.bgColor,
  labelBgOpacity:    VORONOI_LABEL_LAYER_DEFAULTS.bgOpacity,
  labelBgStroke:     VORONOI_LABEL_LAYER_DEFAULTS.bgStroke,
  labelBgStrokeWidth: VORONOI_LABEL_LAYER_DEFAULTS.bgStrokeWidth,
  labelTextColor:   VORONOI_LABEL_LAYER_DEFAULTS.textColor,
  labelTextStroke:      VORONOI_LABEL_LAYER_DEFAULTS.textStroke,
  labelTextStrokeWidth: VORONOI_LABEL_LAYER_DEFAULTS.textStrokeWidth,
  labelFontSize:    VORONOI_LABEL_LAYER_DEFAULTS.fontSize,
  labelFontWeight:  VORONOI_LABEL_LAYER_DEFAULTS.fontWeight,
  labelFontFamily:  VORONOI_LABEL_LAYER_DEFAULTS.fontFamily,
  labelCornerRadius: VORONOI_LABEL_LAYER_DEFAULTS.cornerRadius,
  labelPadding:     VORONOI_LABEL_LAYER_DEFAULTS.padding,
  labelSeparation:  VORONOI_LABEL_LAYER_DEFAULTS.separation,
  labelMinCellArea:    VORONOI_LABEL_LAYER_DEFAULTS.minCellArea,
  labelSuppressOverlap: VORONOI_LABEL_LAYER_DEFAULTS.suppressOverlap,
  labelForce:          VORONOI_LABEL_LAYER_DEFAULTS.forceLabel,
  labelConnector:      VORONOI_LABEL_LAYER_DEFAULTS.connector,
  labelConnectorColor: VORONOI_LABEL_LAYER_DEFAULTS.connectorColor,
  labelConnectorWidth: VORONOI_LABEL_LAYER_DEFAULTS.connectorWidth,
  labelCentroidAnchor: VORONOI_LABEL_LAYER_DEFAULTS.centroidAnchor,
  labelCentroidGap:    VORONOI_LABEL_LAYER_DEFAULTS.centroidGap,
  allowZoom:        false,
  maxZoom:          8,
  zoomAxes:         "xy",  // both axes — scatter's natural default
  userZoomAxes:     null,
  clampPan:         false, // keep pan/zoom (incl. programmatic) inside data borders
  clampPanInset:    null,  // { x, y } px to shrink the clamp box to the data area

  // forwarded from layer defaults
  duration:         GLOBAL_DEFAULTS.duration,
  radius:           SCATTER_LAYER_DEFAULTS.radius,
  rScaleType:       SCATTER_LAYER_DEFAULTS.rScaleType,
  dotSize:          SCATTER_LAYER_DEFAULTS.dotSize,
  dotOpacity:       SCATTER_LAYER_DEFAULTS.dotOpacity,
  hoverScale:       SCATTER_LAYER_DEFAULTS.hoverScale,
  valueAccessor:    SCATTER_LAYER_DEFAULTS.valueAccessor,
  color:            SCATTER_LAYER_DEFAULTS.color,
  fixedSize:        SCATTER_LAYER_DEFAULTS.fixedSize,
  sortByRadius:     SCATTER_LAYER_DEFAULTS.sortByRadius,
  strokeWidth:      SCATTER_LAYER_DEFAULTS.strokeWidth,
  strokeOpacity:    SCATTER_LAYER_DEFAULTS.strokeOpacity,

  // highlight / dim
  highlightFill:          SCATTER_LAYER_DEFAULTS.highlightFill,
  highlightFillOpacity:   SCATTER_LAYER_DEFAULTS.highlightFillOpacity,
  highlightStrokeColor:   SCATTER_LAYER_DEFAULTS.highlightStrokeColor,
  highlightStrokeWidth:   SCATTER_LAYER_DEFAULTS.highlightStrokeWidth,
  highlightStrokeOpacity: SCATTER_LAYER_DEFAULTS.highlightStrokeOpacity,
  dimFill:          SCATTER_LAYER_DEFAULTS.dimFill,
  dimOpacity:       SCATTER_LAYER_DEFAULTS.dimOpacity,
  dimStrokeColor:   SCATTER_LAYER_DEFAULTS.dimStrokeColor,
  dimStrokeWidth:   SCATTER_LAYER_DEFAULTS.dimStrokeWidth,
  dimStrokeOpacity: SCATTER_LAYER_DEFAULTS.dimStrokeOpacity,

  // null / passthrough
  xDomain:          null,
  yDomain:          null,
  xScale:           null,
  yScale:           null,
  data:             [],
  colorAccessor:    null,
  strokeColor:      null,
  hoverStrokeColor: null,
  highlighted:      [],
  selected:         null,
  xTickFormat:      null,
  yTickFormat:      null,
  xTicks:           null,
  yTicks:           null,
  xTickAngle:       0,     // incline x tick labels (deg); >0 ends / <0 starts at tick
  xTickFontSize:    null,  // px; null = inherit from CSS
  xTickStagger:     1,     // stagger horizontal x labels across N rows (1 = off)
  tickColor:        null,
  tickTextColor:    null,

  // Clip the dots + voronoi labels to the plot box so they can't spill into the
  // axis / margin zones (useful when zooming/panning). `clipInset` dials the box
  // in from the axis edge: 0 = clip at the axis edge (padding is breathing room,
  // edge dots render whole); a number or {top,right,bottom,left|start,end} insets
  // further — pass the chart's padding to clip exactly at the data area.
  clipToPlot:       false,
  clipInset:        0,
};
