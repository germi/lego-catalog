import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { createLineAxisLayer, LINE_AXIS_LAYER_DEFAULTS as D } from "../../core/lineAxisLayer.js";

export function LineAxisLayer({
  data          = D.data,
  side          = D.side,
  margin        = D.margin,
  padding       = D.padding,
  xScaleType    = D.xScaleType,
  parseTime     = D.parseTime,
  paddingInner  = D.paddingInner,
  paddingOuter  = D.paddingOuter,
  tickValues    = D.tickValues,
  tickFormat    = D.tickFormat,
  tickSize      = D.tickSize,
  tickColor     = D.tickColor,
  tickTextColor = D.tickTextColor,
  fontSize      = D.fontSize,
  duration      = D.duration,
  ease          = D.ease,
  order,
}) {
  const { draw, zoom, layerContainer } = useContext(CanvasContext);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createLineAxisLayer();
  const core = coreRef.current;

  const props = () => ({
    data, side, margin, padding, xScaleType, parseTime, paddingInner,
    paddingOuter, tickValues, tickFormat, tickSize, tickColor, tickTextColor,
    fontSize, duration, ease, layerContainer,
  });

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draw?.svgEl) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    core.rerender(props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    data, side, xScaleType, tickValues, tickFormat, tickSize, tickColor,
    tickTextColor, fontSize,
  ]);

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default LineAxisLayer;
