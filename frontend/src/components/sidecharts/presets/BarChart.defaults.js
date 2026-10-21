// BarChart is a GSAP/HTML component — duration is in seconds (not ms).
// GLOBAL_DEFAULTS.duration does not apply here.

export const BAR_CHART_DEFAULTS = {
  data:           [
    { id: "1", name: "Data 1", value: 60 },
    { id: "2", name: "Data 2", value: 40 },
  ],
  duration:       0.5,
  color:          "#eee",
  compareColor:   "#00000099",
  small:          false,
  compact:        false,
  showName:       true,
  showNumber:     true,
  numberEnd:      false,
  numberOuter:    false,
  nameStart:      false,
  nameWidth:      null,
  nameAlignEnd:   false,
  bgColor:        null,
  rounded:        true,
  itemClass:      "",
  format:         (d) => `${d.toFixed(0)}%`,
  highlightClass: "border border-black",

  // null / passthrough
  max:            null,
  min:            null,
  highlighted:    null,
};

export const BAR_CHART_ITEM_DEFAULTS = {
  duration:       BAR_CHART_DEFAULTS.duration,
  color:          BAR_CHART_DEFAULTS.color,
  compareColor:   BAR_CHART_DEFAULTS.compareColor,
  small:          BAR_CHART_DEFAULTS.small,
  compact:        BAR_CHART_DEFAULTS.compact,
  showName:       BAR_CHART_DEFAULTS.showName,
  showNumber:     BAR_CHART_DEFAULTS.showNumber,
  numberEnd:      BAR_CHART_DEFAULTS.numberEnd,
  numberOuter:    BAR_CHART_DEFAULTS.numberOuter,
  nameStart:      BAR_CHART_DEFAULTS.nameStart,
  nameWidth:      BAR_CHART_DEFAULTS.nameWidth,
  nameAlignEnd:   BAR_CHART_DEFAULTS.nameAlignEnd,
  bgColor:        BAR_CHART_DEFAULTS.bgColor,
  rounded:        BAR_CHART_DEFAULTS.rounded,
  itemClass:      BAR_CHART_DEFAULTS.itemClass,
  format:         BAR_CHART_DEFAULTS.format,
  highlightClass: "",  // BarChartItem default is empty — BarChart passes its own down

  // null / passthrough
  highlighted:    null,
  numWidth:       null,
  delayEnter:     0,
  max:            null,
  min:            0,
};
