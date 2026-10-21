import { useContext, useEffect, useRef } from "react";
import { CanvasContext } from "../context.js";
import { VoronoiContext } from "../VoronoiContext.js";
import {
  createVoronoiLabelLayer,
  VORONOI_LABEL_LAYER_DEFAULTS as D,
} from "../../core/voronoiLabelLayer.js";

/**
 * VoronoiLabelLayer — text labels at the voronoi centroids, repelled by
 * a force layout. Must be a child of `<VoronoiLayer>`.
 */
export function VoronoiLabelLayer({
  opacity         = D.opacity,
  opacityAccessor = D.opacityAccessor,
  text            = D.text,
  fontSize        = D.fontSize,
  fontFamily      = D.fontFamily,
  fontWeight      = D.fontWeight,
  textColor       = D.textColor,
  bgColor         = D.bgColor,
  bgOpacity       = D.bgOpacity,
  bgStroke        = D.bgStroke,
  bgStrokeWidth   = D.bgStrokeWidth,
  padding         = D.padding,
  cornerRadius    = D.cornerRadius,
  markerRadius    = D.markerRadius,
  separation      = D.separation,
  fixedSize       = D.fixedSize,
  radius          = D.radius,
  rScaleType      = D.rScaleType,
  dotSize         = D.dotSize,
  valueAccessor   = D.valueAccessor,
  radiusData      = null,
  bgColorAccessor = null,
  minCellArea     = D.minCellArea,
  suppressOverlap = D.suppressOverlap,
  forceLabel      = D.forceLabel,
  connector       = D.connector,
  connectorColor  = D.connectorColor,
  connectorWidth  = D.connectorWidth,
  visible         = true,
  order,
}) {
  const { draw, zoom, layerContainer } = useContext(CanvasContext);
  const { voronoiDraw, voronoiOrder, voronoiZoomMode, voronoiGestureBus } = useContext(VoronoiContext);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createVoronoiLabelLayer();
  const core = coreRef.current;

  const props = () => ({
    opacity, opacityAccessor, text,
    fontSize, fontFamily, fontWeight, textColor,
    bgColor, bgOpacity, bgStroke, bgStrokeWidth,
    padding, cornerRadius, markerRadius, separation, fixedSize,
    radius, rScaleType, dotSize, valueAccessor, radiusData, bgColorAccessor,
    minCellArea, suppressOverlap, forceLabel,
    connector, connectorColor, connectorWidth,
    visible, order,
    recomputeOnZoom: voronoiZoomMode ?? false,
    // When a MaskLayer wraps this label, render into its clipped <g>.
    layerContainer: layerContainer ?? null,
  });

  const effectiveOrder = order ?? voronoiOrder;

  useEffect(() => {
    if (draw) core.render(draw, props(), voronoiDraw);
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (zoom) core.onZoom(zoom); }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!voronoiGestureBus) return;
    return voronoiGestureBus.subscribe((g) => core.applyGestureTransform?.(g));
  }, [voronoiGestureBus]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { core.rerender(props(), voronoiDraw); }, [voronoiDraw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { core.rerender(props()); }, [ // eslint-disable-line react-hooks/exhaustive-deps
    opacity, opacityAccessor, text, fontSize, fontFamily, fontWeight, textColor,
    bgColor, bgOpacity, bgStroke, bgStrokeWidth, padding, cornerRadius,
    markerRadius, separation, fixedSize, radius, rScaleType, dotSize,
    valueAccessor, radiusData, bgColorAccessor,
    minCellArea, suppressOverlap, forceLabel,
    connector, connectorColor, connectorWidth,
  ]);

  useEffect(() => { core.setVisible(visible); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { core.setOrder(effectiveOrder); }, [effectiveOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default VoronoiLabelLayer;
