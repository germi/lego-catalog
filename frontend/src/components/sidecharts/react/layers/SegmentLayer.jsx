import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { RoseContext } from "../RoseContext.js";
import { createSegmentLayer, SEGMENT_LAYER_DEFAULTS } from "../../core/segmentLayer.js";

export function SegmentLayer({
  data                 = SEGMENT_LAYER_DEFAULTS.data,
  max                  = SEGMENT_LAYER_DEFAULTS.max,
  scaleType            = SEGMENT_LAYER_DEFAULTS.scaleType,
  innerRadius          = SEGMENT_LAYER_DEFAULTS.innerRadius,
  innerRadiusFn        = SEGMENT_LAYER_DEFAULTS.innerRadiusFn,
  outerRadiusFn        = SEGMENT_LAYER_DEFAULTS.outerRadiusFn,
  cornerRadius         = SEGMENT_LAYER_DEFAULTS.cornerRadius,
  padAngle             = SEGMENT_LAYER_DEFAULTS.padAngle,
  padRadius            = SEGMENT_LAYER_DEFAULTS.padRadius,
  startAngle           = SEGMENT_LAYER_DEFAULTS.startAngle,
  endAngle             = SEGMENT_LAYER_DEFAULTS.endAngle,
  interactive          = SEGMENT_LAYER_DEFAULTS.interactive,
  showCursorPointer    = SEGMENT_LAYER_DEFAULTS.showCursorPointer,
  fillColor            = SEGMENT_LAYER_DEFAULTS.fillColor,
  hoverColor           = SEGMENT_LAYER_DEFAULTS.hoverColor,
  strokeColor          = SEGMENT_LAYER_DEFAULTS.strokeColor,
  strokeWidth          = SEGMENT_LAYER_DEFAULTS.strokeWidth,
  fillOpacity          = SEGMENT_LAYER_DEFAULTS.fillOpacity,
  strokeOpacity        = SEGMENT_LAYER_DEFAULTS.strokeOpacity,
  useDataColorAsStroke = SEGMENT_LAYER_DEFAULTS.useDataColorAsStroke,
  mode                 = SEGMENT_LAYER_DEFAULTS.mode,
  angleValue           = SEGMENT_LAYER_DEFAULTS.angleValue,
  precomputedAngles    = SEGMENT_LAYER_DEFAULTS.precomputedAngles,
  order                = SEGMENT_LAYER_DEFAULTS.order,
  layerId              = SEGMENT_LAYER_DEFAULTS.layerId,
  series               = SEGMENT_LAYER_DEFAULTS.series,
  stacked              = SEGMENT_LAYER_DEFAULTS.stacked,
  onSelect,
  onHover,
}) {
  const { draw } = useContext(CanvasContext);
  const { roseControls, roseHighlighted } = useContext(RoseContext);

  const onSelectRef = useRef(onSelect);
  const onHoverRef  = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current  = onHover;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createSegmentLayer({
      onSelect: (d) => onSelectRef.current?.(d),
      onHover:  (d) => onHoverRef.current?.(d),
    });
  }
  const core = coreRef.current;

  const props = () => ({
    data, max, scaleType, innerRadius, innerRadiusFn, outerRadiusFn,
    cornerRadius, padAngle, padRadius, startAngle, endAngle, interactive,
    showCursorPointer, fillColor, hoverColor, strokeColor, strokeWidth,
    fillOpacity, strokeOpacity, useDataColorAsStroke, mode, angleValue, precomputedAngles,
    order, layerId, series, stacked, roseControls,
  });

  // If [draw] and [data,...] fire in the same flush (e.g. data change coincides
  // with a resize), let render win and skip the rerender. Reset on a microtask
  // so the flag does not stay set across flushes and skip a later legit change.
  const justRenderedRef = useRef(false);

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!draw) return;
    justRenderedRef.current = true;
    core.render(draw, props());
    queueMicrotask(() => { justRenderedRef.current = false; });
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  // IMPORTANT: callers MUST pass stable references for innerRadiusFn /
  // outerRadiusFn (define them at module scope or via `useCallback`, NOT
  // inline). RoseChart already does this via `hitInnerRadiusFn` /
  // `segInnerRadiusFn` / `segOuterRadiusFn` at module scope. Inline closures
  // would get a fresh reference on every parent render — including the
  // re-renders triggered by hover (RoseChart's `hoveredId` state) — and
  // would fire a spurious rerender here, kicking off a new "arc" transition
  // that overwrites any hover/highlight fill via the chained `.attr("fill")`.
  // Visual props (fillOpacity, strokeWidth, colours, cornerRadius, padAngle,
  // padRadius, interactive) are tracked so live changes actually trigger a
  // rerender — the core transitions style attrs onto the arc transition on
  // the !structuralChange update branch so the change animates, not snaps.
  useEffect(() => {
    if (justRenderedRef.current) { justRenderedRef.current = false; return; }
    core.rerender(props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    data, series, stacked, scaleType, max,
    innerRadiusFn, outerRadiusFn,
    fillOpacity, strokeOpacity, strokeWidth, strokeColor, fillColor,
    cornerRadius, padAngle, padRadius, interactive,
  ]);

  const prevHighlightedRef = useRef(roseHighlighted);
  useEffect(() => {
    const prev = prevHighlightedRef.current;
    prevHighlightedRef.current = roseHighlighted;
    core.updateHighlight(roseHighlighted, prev, props());
  }, [roseHighlighted]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default SegmentLayer;
