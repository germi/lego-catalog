import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { ChartContext }  from "../ChartContext.js";
import { createLineLayer, LINE_LAYER_DEFAULTS as D } from "../../core/lineLayer.js";

/**
 * LineLayer — one line per series. Matches `vue/layers/LineLayer.vue`.
 *
 * IMPORTANT — the visual-props effect deliberately omits `data`, `scaleType`,
 * `xScaleType`, `max`, `forceValues`, `margin`, `padding`. Those changes flow
 * through the host chart's projector → BaseCanvas → draw signal, so a fresh
 * draw fires automatically. Including them here would re-enter `render()`
 * with the STALE last-payload (old projector) BEFORE the new draw arrives,
 * corrupting the 3-phase choreography. Same rationale as Vue.
 *
 * When slotted inside a `<LineChart>`, this layer publishes its `getPathId` /
 * `computeAnchorOffset` to the parent's `ChartContext.lineLayerPaths` so a
 * sibling `<LineLabelLayer>` can resolve its `<textPath href>` without the
 * caller having to wire it explicitly.
 */
export function LineLayer({
  data               = D.data,
  keys               = D.keys,
  color              = D.color,
  margin             = null,
  padding            = null,
  scaleType          = D.scaleType,
  xScaleType         = D.xScaleType,
  parseTime          = D.parseTime,
  max                = D.max,
  forceValues        = D.forceValues,
  stacked            = D.stacked,
  curve              = D.curve,
  strokeWidth        = D.strokeWidth,
  strokeOpacity      = D.strokeOpacity,
  strokeDasharray    = D.strokeDasharray,
  strokeDashoffset   = D.strokeDashoffset,
  dotRadius          = D.dotRadius,
  dotColor           = D.dotColor,
  duration           = null,
  ease               = D.ease,
  highlighted        = D.highlighted,
  dimOpacity         = D.dimOpacity,
  highlightedColor   = D.highlightedColor,
  defaultColor       = D.defaultColor,
  enableXHover       = D.enableXHover,
  showHoverLine      = D.showHoverLine,
  hoverLineColor     = D.hoverLineColor,
  hoverLineWidth     = D.hoverLineWidth,
  hoverLineDasharray = D.hoverLineDasharray,
  selectedX          = D.selectedX,
  selectedDotRadius  = D.selectedDotRadius,
  showLastPoint      = D.showLastPoint,
  selectionDuration  = D.selectionDuration,
  debugClip          = D.debugClip,
  order,
  onHover,
  onClick,
}) {
  const { draw, zoom, liveTransform, layerContainer } = useContext(CanvasContext);
  const { chartContext, setLineLayerPaths }           = useContext(ChartContext);

  const onHoverRef = useRef(onHover);
  const onClickRef = useRef(onClick);
  onHoverRef.current = onHover;
  onClickRef.current = onClick;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createLineLayer({
      onHover: (d) => onHoverRef.current?.(d),
      onClick: (d) => onClickRef.current?.(d),
    });
  }
  const core = coreRef.current;

  // Match Vue's slot-inheritance fallback: own prop > chartContext > null.
  // For margin / padding, the core falls back to payload.margin / payload.padding
  // when both prop and chartContext are unset.
  const props = () => ({
    data, keys, color,
    margin:  margin  ?? chartContext?.margin  ?? null,
    padding: padding ?? chartContext?.padding ?? null,
    scaleType, xScaleType, parseTime,
    max, forceValues, stacked, curve, strokeWidth, strokeOpacity,
    strokeDasharray, strokeDashoffset, dotRadius, dotColor,
    duration: duration ?? null,
    ease, highlighted, dimOpacity, highlightedColor, defaultColor,
    enableXHover, showHoverLine, hoverLineColor, hoverLineWidth,
    hoverLineDasharray, selectedX, selectedDotRadius, showLastPoint,
    selectionDuration, debugClip,
    layerContainer,
  });

  // ── Publish line path helpers to the parent chart's ChartContext ──────────
  useEffect(() => {
    if (setLineLayerPaths) {
      setLineLayerPaths({
        getPathId:           core.getPathId,
        computeAnchorOffset: core.computeAnchorOffset,
        getSeriesEndPoint:   core.getSeriesEndPoint,
      });
    }
    return () => { setLineLayerPaths?.(null); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw signal — full render. With zoom catch-up (mirrors Vue) ───────────
  // When this layer mounts mid-zoom, the draw payload's `zoomTransform` may
  // be STALE (manual gestures don't fire draws). `liveTransform` (kept current
  // by BaseCanvas from both onZoom AND onDraw) always reflects the live d3
  // transform, so on the FIRST render we overlay it onto the payload when it
  // disagrees, and clear xScale/yScale so the core recomputes from raw scales
  // + the live transform.
  const zoomCaughtUpRef = useRef(false);
  useEffect(() => {
    if (!draw?.svgEl) return;
    let effective = draw;
    if (!zoomCaughtUpRef.current) {
      zoomCaughtUpRef.current = true;
      const live = liveTransform;
      const pt   = draw.zoomTransform;
      const alreadyCorrect = pt && live && pt.k === live.k && pt.x === live.x && pt.y === live.y;
      if (live && !alreadyCorrect && (live.k !== 1 || live.x !== 0 || live.y !== 0)) {
        effective = { ...draw, zoomTransform: live, xScale: undefined, yScale: undefined };
      }
    }
    core.render(effective, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visual-only props watcher ─────────────────────────────────────────────
  // Anything that affects the projector (data / scaleType / xScaleType / max
  // / forceValues / margin / padding / stacked / keys — via the parent's
  // yDomain memo) flows through projector → draw signal automatically.
  // Including them here would re-enter render() with a stale lastPayload
  // BEFORE the new draw arrives (React's child-before-parent effect order)
  // and interrupt the 3-phase choreography.
  useEffect(() => {
    core.rerender(props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    color, curve,
    strokeWidth, strokeOpacity, strokeDasharray, strokeDashoffset,
    dotRadius, dotColor,
    highlighted, dimOpacity, highlightedColor,
    showHoverLine, hoverLineColor, hoverLineWidth, hoverLineDasharray,
    selectedDotRadius, showLastPoint, debugClip,
  ]);

  // ── selectedX fast-path — instant snap, no animation ──────────────────────
  // Clicking to pin an x snaps the dots/line right away; animating over
  // `duration` would feel laggy for what is effectively a cursor move.
  useEffect(() => {
    core.refreshSelection?.(props());
  }, [selectedX]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default LineLayer;
