// Defaults for the BeeswarmChart preset. A beeswarm is a value axis + circles
// dodged perpendicular (via beeswarmLayout) so they don't overlap — rendered with
// the plain ScatterLayer + AxisLayer (no new visual layers).
export const BEESWARM_CHART_DEFAULTS = {
  data:            [],
  valueAccessor:   (d) => d.value,      // maps a datum to its axis value
  valueScaleType:  "linear",            // "linear" | "log"
  nice:            true,

  // Dot radius. A number = fixed; a `(d) => px` function = per-datum. When
  // `sizeAccessor` is set the preset builds a sqrt radius scale from it instead.
  radius:          4,
  sizeAccessor:    null,                // (d) => value driving a sqrt radius scale
  sizeRange:       [2, 12],             // [min, max] radius px for the size scale
  gap:             1,                   // extra px between circle edges

  // Dots (forwarded to ScatterLayer)
  dotOpacity:      0.85,
  color:           "#3B82F6",
  colorAccessor:   null,
  strokeColor:     "white",
  strokeWidth:     1,
  strokeOpacity:   0.7,
  hoverScale:      1.4,
  sortByRadius:    true,

  // Highlight / dim (forwarded to ScatterLayer)
  highlighted:     [],
  dimOpacity:      0.15,

  // Axis
  showValueAxis:   true,
  valueTicks:      null,
  valueTickFormat: null,
  showGrid:        false,
  gridColor:       "#e5e7eb",
  tickColor:       null,
  tickTextColor:   null,

  // Layout / zoom
  margin:          { top: 16, right: 16, bottom: 36, left: 16 },
  allowZoom:       false,
  maxZoom:         8,
  // Keep the pan/zoom inside the data borders (BaseCanvas). `clampPanInset`
  // ({ left, right, top, bottom } px) shrinks the clamp box; null = full inner box.
  clampPan:        false,
  clampPanInset:   null,
  duration:        400,
};
