import { useContext, useRef, useEffect } from "react";
import { CanvasContext } from "../context.js";
import { ChartContext }  from "../ChartContext.js";
import { createAreaLayer, AREA_LAYER_DEFAULTS as D } from "../../core/areaLayer.js";

/**
 * AreaLayer — area chart / confidence band. Matches `vue/layers/AreaLayer.vue`.
 *
 * IMPORTANT — the visual-props effect deliberately omits `data`, `scaleType`,
 * `xScaleType`, `max`, `forceValues`, `margin`, `padding`, `upperKey`, `lowerKey`.
 * Those changes flow through the host chart's projector → BaseCanvas → draw
 * signal, so a fresh draw fires automatically. Including them would re-enter
 * `render()` with the STALE last-payload before the new draw arrives,
 * corrupting the 3-phase choreography. Same rationale as Vue.
 */
export function AreaLayer({
  data          = null,
  keys          = D.keys,
  color         = D.color,
  margin        = null,
  padding       = null,
  scaleType     = D.scaleType,
  xScaleType    = D.xScaleType,
  parseTime     = D.parseTime,
  max           = D.max,
  forceValues   = D.forceValues,
  stacked       = D.stacked,
  curve         = D.curve,
  opacity       = D.opacity,
  strokeWidth   = D.strokeWidth,
  strokeColor   = D.strokeColor,
  strokeOpacity = D.strokeOpacity,
  upperKey      = D.upperKey,
  lowerKey      = D.lowerKey,
  duration      = D.duration,
  ease          = D.ease,
  highlighted   = D.highlighted,
  defaultColor  = D.defaultColor,
  order,
  onHover,
  onClick,
}) {
  const { draw, zoom, liveTransform, layerContainer } = useContext(CanvasContext);
  const { chartContext, chartData }                   = useContext(ChartContext);

  const onHoverRef = useRef(onHover);
  const onClickRef = useRef(onClick);
  onHoverRef.current = onHover;
  onClickRef.current = onClick;

  const coreRef = useRef(null);
  if (!coreRef.current) {
    coreRef.current = createAreaLayer({
      onHover: (d) => onHoverRef.current?.(d),
      onClick: (d) => onClickRef.current?.(d),
    });
  }
  const core = coreRef.current;

  // Match Vue's slot-inheritance fallback: own prop > chartContext > default.
  const props = () => ({
    data:    data    ?? chartData          ?? D.data,
    margin:  margin  ?? chartContext?.margin  ?? D.margin,
    padding: padding ?? chartContext?.padding ?? D.padding,
    keys, color, scaleType, xScaleType, parseTime,
    max, forceValues, stacked, curve, opacity, strokeWidth, strokeColor,
    strokeOpacity, upperKey, lowerKey, duration, ease, highlighted,
    defaultColor, layerContainer,
  });

  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Draw signal — full render with zoom catch-up (mirrors Vue) ────────────
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
  // Anything that affects the projector (data / scale / margin / padding /
  // max / forceValues / stacked / keys — via the parent's yDomain memo)
  // flows through projector → draw signal automatically. Re-entering render()
  // here with a stale lastPayload would interrupt the 3-phase choreography.
  // upperKey / lowerKey ARE band-only, kept here. Same goes for curve / opacity.
  useEffect(() => {
    core.rerender(props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    color, curve, opacity,
    strokeWidth, strokeColor, strokeOpacity,
    upperKey, lowerKey, highlighted,
  ]);

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default AreaLayer;
