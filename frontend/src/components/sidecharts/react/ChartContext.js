import { createContext } from "react";

/**
 * Chart-level context provided by preset components (`LineChart`, `AreaChart`, …)
 * so slotted layers (RefArea / RefLine / AreaLayer / LineLabel) can inherit
 * the chart's margin / padding / data without having to pass them as props.
 *
 * Mirrors Vue's `provide("chartContext", …)` / `provide("chartData", …)` /
 * `provide("lineLayerPaths", …)`.
 *
 *   chartContext   : { margin, padding } — layout offsets the preset is using
 *   chartData      : the preset's `data` array
 *   lineLayerPaths : { getPathId } — set by `LineLayer` on mount so a slotted
 *                    `LineLabelLayer` can resolve which <textPath href> to use.
 *                    Treat as a mutable container — consumers read the current
 *                    value via `lineLayerPaths.current`.
 */
export const ChartContext = createContext({
  chartContext:      null,  // { margin, padding } or null
  chartData:         null,  // the preset's `data` array, or null
  lineLayerPaths:    null,  // { getPathId } or null, set by LineLayer
  setLineLayerPaths: () => {}, // setter exposed for LineLayer
});
