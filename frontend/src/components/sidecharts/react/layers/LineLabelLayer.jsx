import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { ChartContext }  from "../ChartContext.js";
import { createLineLabelLayer, LINE_LABEL_LAYER_DEFAULTS as D } from "../../core/lineLabelLayer.js";

export function LineLabelLayer({
  labels     = [],
  data       = null,
  margin     = null,
  padding    = null,
  fontSize   = D.fontSize,
  fontFamily = D.fontFamily,
  fill       = D.fill,
  bgColor    = D.bgColor,
  bgWidth    = D.bgWidth,
  dy         = D.dy,
  duration   = D.duration,
  ease       = D.ease,
  // anchor="lineEnd": force-relaxed horizontal labels at the plot's end edge.
  anchor          = D.anchor,
  direction       = D.direction,
  gap             = D.gap,
  relaxRadius     = D.relaxRadius,
  relaxIterations = D.relaxIterations,
  order,
  /**
   * Optional explicit override. If omitted, the value is inherited from the
   * parent chart via `ChartContext` (LineChart publishes it when its
   * LineLayer mounts).
   */
  getPathId,
}) {
  const { draw, zoom, layerContainer } = useContext(CanvasContext);
  const { chartContext, chartData, lineLayerPaths } = useContext(ChartContext);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createLineLabelLayer();
  const core = coreRef.current;

  // Inherit helpers from the parent chart's LineLayer when not passed explicitly.
  const effectiveGetPathId = getPathId ?? lineLayerPaths?.getPathId ?? null;

  const props = () => ({
    labels, fontSize, fontFamily, fill, bgColor, bgWidth, dy,
    duration, ease, layerContainer,
    anchor, direction, gap, relaxRadius, relaxIterations,
    data:           data    ?? chartData          ?? null,
    margin:         margin  ?? chartContext?.margin  ?? D.margin,
    padding:        padding ?? chartContext?.padding ?? D.padding,
    getPathId:           effectiveGetPathId,
    computeAnchorOffset: lineLayerPaths?.computeAnchorOffset ?? null,
    getSeriesEndPoint:   lineLayerPaths?.getSeriesEndPoint   ?? null,
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
    labels, data, fontSize, fontFamily, fill, bgColor, bgWidth, dy,
    anchor, direction, gap, relaxRadius, relaxIterations,
    chartData, chartContext, lineLayerPaths, effectiveGetPathId,
  ]);

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default LineLabelLayer;
