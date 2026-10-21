import { useContext, useEffect, useRef } from "react";
import { CanvasContext } from "../context.js";
import { ChartContext }  from "../ChartContext.js";
import {
  createRefLineLayer,
  REF_LINE_LAYER_DEFAULTS as D,
} from "../../core/refLineLayer.js";

/**
 * RefLineLayer — straight reference lines (horizontal / vertical / slanted /
 * rule-derived) drawn on top of a cartesian chart.
 *
 * Spec shapes for `lines`:
 *   { id, y }                       horizontal
 *   { id, x }                       vertical
 *   { id, x1, y1, x2, y2 }          slanted (two endpoints)
 *   { id, rule: "medianY" | "medianX" | "meanY" | "meanX" | "regression" | fn }
 */
export function RefLineLayer({
  lines       = D.lines,
  data        = null,
  xAccessor   = D.xAccessor,
  yAccessor   = D.yAccessor,
  margin      = null,
  padding     = null,
  xScaleType  = null,
  yScaleType  = null,
  yDomain     = D.yDomain,
  color       = D.color,
  dasharray   = D.dasharray,
  strokeWidth = D.strokeWidth,
  opacity     = D.opacity,
  labelColor  = D.labelColor,
  labelSize   = D.labelSize,
  labelDy     = D.labelDy,
  labelAlign  = D.labelAlign,
  duration    = null,
  ease        = null,
  order,
}) {
  const { draw, zoom, layerContainer } = useContext(CanvasContext);
  const { chartContext, chartData }    = useContext(ChartContext);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createRefLineLayer();
  const core = coreRef.current;

  const props = () => ({
    lines,
    layerContainer,
    data:       data    ?? chartData          ?? [],
    xAccessor,
    yAccessor,
    margin:     margin  ?? chartContext?.margin  ?? null,
    padding:    padding ?? chartContext?.padding ?? null,
    xScaleType: xScaleType ?? D.xScaleType,
    yScaleType: yScaleType ?? D.yScaleType,
    yDomain,
    color,
    dasharray,
    strokeWidth,
    opacity,
    labelColor,
    labelSize,
    labelDy,
    labelAlign,
    duration: duration ?? null,
    ease:     ease     ?? null,
  });

  // Full re-render on canvas draw signal
  useEffect(() => {
    if (draw?.svgEl) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interactive zoom
  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightweight rerender on prop changes
  useEffect(() => {
    core.rerender(props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    lines, data, xAccessor, yAccessor, margin, padding,
    xScaleType, yScaleType, yDomain,
    color, dasharray, strokeWidth, opacity,
    labelColor, labelSize, labelDy, labelAlign,
    duration, ease,
  ]);

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default RefLineLayer;
