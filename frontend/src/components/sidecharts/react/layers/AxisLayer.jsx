import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { createAxisLayer, AXIS_LAYER_DEFAULTS as D } from "../../core/axisLayer.js";

/**
 * AxisLayer — the X axis for cartesian charts. Matches `vue/layers/AxisLayer.vue`.
 */
export function AxisLayer({
  side          = D.side,
  data          = D.data,
  margin        = D.margin,
  padding       = D.padding,
  scale         = D.scale,
  max           = D.max,
  stacked       = D.stacked,
  tickValues    = D.tickValues,
  tickFormat    = D.tickFormat,
  numTicks      = D.numTicks,
  paddingInner  = D.paddingInner,
  paddingOuter  = D.paddingOuter,
  ease          = D.ease,
  duration      = D.duration,
  tickColor     = D.tickColor,
  tickTextColor = D.tickTextColor,
  tickFontSize  = D.tickFontSize,
  tickAngle     = D.tickAngle,
  tickStagger   = D.tickStagger,
  showGrid      = D.showGrid,
  gridColor     = D.gridColor,
  gridDasharray = D.gridDasharray,
  gridOpacity   = D.gridOpacity,
  phased        = D.phased,
  order,
}) {
  const { draw, zoom } = useContext(CanvasContext);
  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createAxisLayer();
  const core = coreRef.current;

  const props = () => ({
    side, data, margin, padding, scale, max, stacked, tickValues, tickFormat,
    numTicks, paddingInner, paddingOuter, ease, duration,
    tickColor, tickTextColor, tickFontSize, tickAngle, tickStagger, showGrid, gridColor, gridDasharray, gridOpacity,
    phased,
  });

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draw) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interactive zoom — re-projects axis ticks with the current zoom transform.
  // Mirrors Vue's `watch(zoom, t => core.onZoom(t))`.
  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.rerender(duration, props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    data, scale, padding, max, stacked, paddingInner, paddingOuter,
    tickColor, tickTextColor, tickFontSize, tickAngle, tickStagger, tickValues, numTicks, tickFormat,
    duration, showGrid, gridColor, gridDasharray, gridOpacity,
  ]);

  useEffect(() => { core.setOrder?.(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default AxisLayer;
