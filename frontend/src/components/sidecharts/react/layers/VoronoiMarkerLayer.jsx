import { useContext, useEffect, useRef } from "react";
import { CanvasContext } from "../context.js";
import { VoronoiContext } from "../VoronoiContext.js";
import {
  createVoronoiMarkerLayer,
  VORONOI_MARKER_LAYER_DEFAULTS as D,
} from "../../core/voronoiMarkerLayer.js";

/**
 * VoronoiMarkerLayer — markers (dots) at each voronoi centroid.
 * Must be a child of `<VoronoiLayer>`.
 */
export function VoronoiMarkerLayer({
  radius        = D.radius,
  color         = D.color,
  colorAccessor = D.colorAccessor,
  valueAccessor = D.valueAccessor,
  fixedSize     = D.fixedSize,
  strokeWidth   = D.strokeWidth,
  strokeColor   = D.strokeColor,
  opacity       = D.opacity,
  duration      = D.duration,
  visible       = true,
  order,
  onHover,
  onClick,
}) {
  const { draw, zoom } = useContext(CanvasContext);
  const { voronoiDraw, voronoiOrder, voronoiZoomMode, voronoiGestureBus } = useContext(VoronoiContext);

  const onHoverRef = useRef(onHover);
  const onClickRef = useRef(onClick);
  onHoverRef.current = onHover;
  onClickRef.current = onClick;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createVoronoiMarkerLayer({
      onHover: (e) => onHoverRef.current?.(e),
      onClick: (d) => onClickRef.current?.(d),
    });
  }
  const core = coreRef.current;

  const props = () => ({
    radius, color, colorAccessor, valueAccessor, fixedSize,
    strokeWidth, strokeColor, opacity, duration, visible, order,
    recomputeOnZoom: voronoiZoomMode ?? false,
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
    radius, color, colorAccessor, valueAccessor, fixedSize,
    strokeWidth, strokeColor, opacity, duration,
  ]);

  useEffect(() => { core.setVisible(visible); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { core.setOrder(effectiveOrder); }, [effectiveOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default VoronoiMarkerLayer;
