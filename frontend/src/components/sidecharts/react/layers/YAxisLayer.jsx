import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { createYAxisLayer, YAXIS_LAYER_DEFAULTS as D } from "../../core/yAxisLayer.js";

/**
 * YAxisLayer — the Y axis for cartesian charts. Matches `vue/layers/YAxisLayer.vue`.
 */
export function YAxisLayer({
  side             = D.side,
  scale            = D.scale,
  scaleType        = D.scaleType,
  max              = D.max,
  min              = D.min,
  nice             = D.nice,
  data             = D.data,
  stacked          = D.stacked,
  margin           = D.margin,
  padding          = D.padding,
  showGrid         = D.showGrid,
  tickValues       = D.tickValues,
  tickFormat       = D.tickFormat,
  numTicks         = D.numTicks,
  tickSize         = D.tickSize,
  tickColor        = D.tickColor,
  tickTextColor    = D.tickTextColor,
  gridColor        = D.gridColor,
  gridDasharray    = D.gridDasharray,
  gridOpacity      = D.gridOpacity,
  ease             = D.ease,
  duration         = D.duration,
  textTicksInside  = D.textTicksInside,
  rtl              = D.rtl,
  order,
}) {
  const { draw, zoom } = useContext(CanvasContext);
  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createYAxisLayer();
  const core = coreRef.current;

  const props = () => ({
    side, scale, scaleType, max, min, nice, data, stacked, margin, padding,
    showGrid, tickValues, tickFormat, numTicks, tickSize, tickColor,
    tickTextColor, gridColor, gridDasharray, gridOpacity, ease, duration,
    textTicksInside, rtl,
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
    data, scale, scaleType, max, min, nice, stacked, padding, showGrid,
    tickValues, numTicks, tickFormat, tickSize, tickColor, tickTextColor,
    gridColor, gridDasharray, gridOpacity, duration, textTicksInside, rtl,
  ]);

  useEffect(() => { core.setOrder?.(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default YAxisLayer;
