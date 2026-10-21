/**
 * Defaults for SuperLineChart — the controlled, scene-driven line chart.
 *
 * Kept deliberately small for Phase 1 (component skeleton). The richer
 * control META (for the visual editor in Phase 3) will grow alongside
 * `EditChartPropControl`, mirroring the shape of `LineChart.defaults.js`.
 */

/** Chart-level (global) defaults applied when a scene's `chart` omits them. */
export const SUPER_CHART_DEFAULTS = {
  duration: 700,
  ease: "easeCubic",
  curve: "curveLinear",
  // Opacity of the host LineChart's built-in line. 0 = hidden (each series is
  // drawn by its own masked LineLayer instead); raise it for a "ghost" base.
  ghostOpacity: 0,
};

/** Per-series stroke defaults (merged under a scene series' `stroke`). */
export const SUPER_SERIES_STROKE_DEFAULTS = {
  color: null, // null → assigned from the palette by index
  width: 2,
  opacity: 1,
  dasharray: null,
};

/** Per-series band defaults. */
export const SUPER_BAND_DEFAULTS = {
  opacity: 0.18,
};

/** Fallback colour cycle when a series declares no stroke colour. */
export const SUPER_PALETTE = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f97316", // orange
];

/**
 * Draw-order bands. RefArea sits at the back as a deep backdrop; standalone
 * AreaLayer specs (the `areas` prop) sit just above it as the next backdrop
 * tier so they can fill under the series lines; each series gets
 * `seriesBase + index`; reference lines render on top. Each `areas[i]`
 * gets `areaBase + i` so array order = visual order within that tier.
 */
export const SUPER_ORDERS = {
  refArea: 2,
  areaBase: 5,
  seriesBase: 10,
  refLine: 40,
};
