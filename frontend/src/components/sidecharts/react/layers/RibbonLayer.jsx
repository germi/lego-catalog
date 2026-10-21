import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { createRibbonLayer, RIBBON_LAYER_DEFAULTS } from "../../core/ribbonLayer.js";

export function RibbonLayer({
  data              = RIBBON_LAYER_DEFAULTS.data,
  color             = RIBBON_LAYER_DEFAULTS.color,
  rectStyle         = RIBBON_LAYER_DEFAULTS.rectStyle,
  margin            = RIBBON_LAYER_DEFAULTS.margin,
  padding           = RIBBON_LAYER_DEFAULTS.padding,
  max               = RIBBON_LAYER_DEFAULTS.max,
  duration          = RIBBON_LAYER_DEFAULTS.duration,
  ease              = RIBBON_LAYER_DEFAULTS.ease,
  paddingInner      = RIBBON_LAYER_DEFAULTS.paddingInner,
  paddingOuter      = RIBBON_LAYER_DEFAULTS.paddingOuter,
  bgColor           = RIBBON_LAYER_DEFAULTS.bgColor,
  format            = RIBBON_LAYER_DEFAULTS.format,
  stacked           = RIBBON_LAYER_DEFAULTS.stacked,
  scaleType         = RIBBON_LAYER_DEFAULTS.scaleType,
  keys              = RIBBON_LAYER_DEFAULTS.keys,
  showLinks         = RIBBON_LAYER_DEFAULTS.showLinks,
  useCurves         = RIBBON_LAYER_DEFAULTS.useCurves,
  useLines          = RIBBON_LAYER_DEFAULTS.useLines,
  linkOpacity       = RIBBON_LAYER_DEFAULTS.linkOpacity,
  linkDimOpacity    = RIBBON_LAYER_DEFAULTS.linkDimOpacity,
  highlighted            = RIBBON_LAYER_DEFAULTS.highlighted,
  highlightFill          = RIBBON_LAYER_DEFAULTS.highlightFill,
  highlightFillOpacity   = RIBBON_LAYER_DEFAULTS.highlightFillOpacity,
  highlightStrokeColor   = RIBBON_LAYER_DEFAULTS.highlightStrokeColor,
  highlightStrokeWidth   = RIBBON_LAYER_DEFAULTS.highlightStrokeWidth,
  highlightStrokeOpacity = RIBBON_LAYER_DEFAULTS.highlightStrokeOpacity,
  dimFill                = RIBBON_LAYER_DEFAULTS.dimFill,
  dimOpacity             = RIBBON_LAYER_DEFAULTS.dimOpacity,
  dimStrokeColor         = RIBBON_LAYER_DEFAULTS.dimStrokeColor,
  dimStrokeWidth         = RIBBON_LAYER_DEFAULTS.dimStrokeWidth,
  dimStrokeOpacity       = RIBBON_LAYER_DEFAULTS.dimStrokeOpacity,
  projector         = RIBBON_LAYER_DEFAULTS.projector,
  fixedBarWidth     = RIBBON_LAYER_DEFAULTS.fixedBarWidth,
  fixedMaxBarHeight = RIBBON_LAYER_DEFAULTS.fixedMaxBarHeight,
  getCoordinates    = RIBBON_LAYER_DEFAULTS.getCoordinates,
  ignoreProjection  = RIBBON_LAYER_DEFAULTS.ignoreProjection,
  onSelect,
  onHover,
}) {
  const { draw, zoom, controls, layerContainer } = useContext(CanvasContext);

  const onSelectRef = useRef(onSelect);
  const onHoverRef  = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current  = onHover;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createRibbonLayer({
      onSelect: (d) => onSelectRef.current?.(d),
      onHover:  (d) => onHoverRef.current?.(d),
    });
  }
  const core = coreRef.current;

  const props = () => ({
    data, color, rectStyle, margin, padding, max, duration, ease,
    paddingInner, paddingOuter, bgColor, format, stacked, scaleType, keys,
    showLinks, useCurves, useLines, linkOpacity, linkDimOpacity, highlighted, projector,
    highlightFill, highlightFillOpacity, highlightStrokeColor, highlightStrokeWidth,
    highlightStrokeOpacity, dimFill, dimOpacity, dimStrokeColor, dimStrokeWidth,
    dimStrokeOpacity,
    fixedBarWidth, fixedMaxBarHeight, getCoordinates, ignoreProjection,
    controls, layerContainer,
  });

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (draw) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Projector-driving props (data, stacked, max, scaleType, paddingInner,
  // paddingOuter) are EXCLUDED here — they flow through RibbonChart's projector
  // → one draw → the draw effect above renders once (mirrors Vue's single-render
  // contract). `data` is kept in the deps ONLY to detect "did data change this
  // tick" so we can skip a redundant rerender: when data AND a highlight/keys
  // prop change together (e.g. a page deriving `highlighted` from the active
  // dataset), the draw already re-renders with the live props (highlights ride
  // styleBars). A second render here would spawn new default d3 transitions on
  // the bars and interrupt the 3-phase enter/slide/exit choreography, collapsing
  // it into one tween. So skip whenever data also changed; the draw covers it.
  const lastSeenData = useRef(data);
  useEffect(() => {
    const dataChanged = data !== lastSeenData.current;
    lastSeenData.current = data;
    if (dataChanged) return;  // draw will (or did) re-render with current props
    core.rerender(duration, props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    data, keys,
    projector, fixedBarWidth, fixedMaxBarHeight, getCoordinates, ignoreProjection,
    // Highlight / dim — visual only, must trigger a rerender.
    highlighted, highlightFill, highlightFillOpacity, highlightStrokeColor,
    highlightStrokeWidth, highlightStrokeOpacity, dimFill, dimOpacity,
    dimStrokeColor, dimStrokeWidth, dimStrokeOpacity, linkDimOpacity,
  ]);

  return null;
}

export default RibbonLayer;
