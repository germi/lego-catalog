/**
 * Defaults for SuperScatterPlot — the controlled, scene-driven scatter chart.
 *
 * Mirrors the SuperLineChart.defaults.js pattern but for scatter scenes:
 * a scene picks an x/y/r metric, an optional year (the parent feeds the
 * appropriate year's rows in), highlighted ids, refAreas, refLines, zoom.
 */

/** Chart-level (global) defaults applied when a scene's `chart` omits them. */
export const SUPER_SCATTER_DEFAULTS = {
  duration: 700,
  ease: "easeCubic",
  // Reasonable defaults for the countries dataset (income / life_exp / population).
  xKey:      "income",
  yKey:      "life_exp",
  rKey:      "population",
  // Pulled from METRICS in the existing scatter page — agents can override
  // per scene (e.g. "log" for income / population, "linear" for life_exp).
  xScaleType: "log",
  yScaleType: "linear",
  rScaleType: "sqrt",
  dotSize:    [4, 44],
  dotOpacity: 0.78,
  showGrid:   true,
  showHover:  true,
  showLabels: false,
  // Default ON — the scene editor needs interactive zoom so the user can
  // frame the view and capture it via Save snapshot. Players that don't
  // want users zooming a final story can override via `chart.allowZoom`.
  allowZoom:  true,
  maxZoom:    50,
  margin:     { top: 16, right: 20, bottom: 48, left: 60 },
};

/**
 * Continent palette — matches the existing /scatter page so stories look
 * familiar regardless of which surface they're played on. Agents reference
 * keys from `enums.continents` in the agent context.
 */
export const SUPER_SCATTER_PALETTE = {
  africa:   "#F59E0B",
  asia:     "#3B82F6",
  europe:   "#10B981",
  americas: "#EF4444",
};

/**
 * Draw-order bands. RefArea sits behind the dots (CI band style),
 * dots in the middle, refLines on top (medians, regression, thresholds).
 */
export const SUPER_SCATTER_ORDERS = {
  refArea: 5,
  dots:    10,
  refLine: 40,
};
