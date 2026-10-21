import { useContext, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import { CanvasContext } from "../context.js";
import { createScatterLayer, SCATTER_LAYER_DEFAULTS as D } from "../../core/scatterLayer.js";

export const ScatterLayer = forwardRef(function ScatterLayer({
  data             = [],
  projector        = null,
  coordAccessor    = D.coordAccessor,
  radius           = D.radius,
  rScaleType       = D.rScaleType,
  dotSize          = D.dotSize,
  valueAccessor    = D.valueAccessor,
  color            = D.color,
  colorAccessor    = null,
  dotOpacity       = D.dotOpacity,
  hoverFill        = D.hoverFill,
  strokeColor      = D.strokeColor,
  strokeWidth      = D.strokeWidth,
  strokeOpacity    = D.strokeOpacity,
  hoverStrokeColor = D.hoverStrokeColor,
  highlighted      = D.highlighted,
  selected         = D.selected,
  hoverScale       = D.hoverScale,
  fixedSize        = D.fixedSize,
  sortByRadius     = D.sortByRadius,
  duration         = D.duration,
  order,
  onHover,
  onClick,
}, ref) {
  const { draw, zoom, layerContainer } = useContext(CanvasContext);

  const onHoverRef = useRef(onHover);
  const onClickRef = useRef(onClick);
  onHoverRef.current = onHover;
  onClickRef.current = onClick;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createScatterLayer({
      onHover: (e) => onHoverRef.current?.(e),
      onClick: (e) => onClickRef.current?.(e),
    });
  }
  const core = coreRef.current;

  const props = () => ({
    data, projector, coordAccessor, radius, rScaleType, dotSize, valueAccessor,
    color, colorAccessor, dotOpacity, hoverFill,
    strokeColor, strokeWidth, strokeOpacity, hoverStrokeColor,
    highlighted, selected, hoverScale, fixedSize, sortByRadius, duration,
    layerContainer,
  });

  // Skip render if there's nothing to project against — otherwise the core
  // places dots at (0,0) on this draw and the next render (with a real
  // projector) transitions them into place ("fly in from 0,0").
  // Happens on the very first commit because Vue's parent-before-child watcher
  // order replaces the null-projector payload before the layer reads it,
  // while React's child-before-parent effect order does NOT.
  const canRender = (d) =>
    !!d?.svgEl && (d.projector != null || d.projection != null || projector != null);

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canRender(draw)) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canRender(draw)) core.render(draw, props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    color, hoverFill, radius, highlighted, selected, dotOpacity,
    strokeColor, strokeWidth, strokeOpacity, hoverStrokeColor,
    fixedSize, sortByRadius, coordAccessor,
  ]);

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    getDotEl: (id) => core.getDotEl(id),
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
});

export default ScatterLayer;
