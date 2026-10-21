import { useContext, useEffect, useRef } from "react";
import { CanvasContext } from "../context.js";
import { ChartContext }  from "../ChartContext.js";
import {
  createRefAreaLayer,
  REF_AREA_LAYER_DEFAULTS as D,
} from "../../core/refAreaLayer.js";

/**
 * RefAreaLayer — filled reference regions on a cartesian chart.
 *
 * Spec shapes for `areas`:
 *   { id, x1, y1, x2, y2 }                          rectangle (any corner ±Infinity → chart edge)
 *   { id, y, side: "above"|"below" }                horizontal half-plane
 *   { id, x, side: "left"|"right" }                 vertical half-plane
 *   { id, points: [{x, y0, y1}, …] }                band between two curves
 *   { id, rule: "regressionCI" | fn, ci?: 0.95 }    computed each render
 *
 * Per-datum optional styling: fill, fillOpacity, stroke, strokeWidth, strokeDasharray
 */

// Stable-by-content memo so an INLINE `areas={[{...}]}` prop doesn't trigger
// the rerender effect on every parent render (e.g. on every hover / tooltip
// state change). Mirrors Vue's `watch(..., { deep: true })` behaviour.
// Safe for small spec arrays — areas are always plain JSON-like objects.
function useStable(value) {
  const ref = useRef(value);
  if (JSON.stringify(ref.current) !== JSON.stringify(value)) {
    ref.current = value;
  }
  return ref.current;
}

export function RefAreaLayer({
  areas           = D.areas,
  data            = null,
  xAccessor       = D.xAccessor,
  yAccessor       = D.yAccessor,
  margin          = null,
  padding         = null,
  xScaleType      = null,
  yScaleType      = null,
  yDomain         = D.yDomain,
  fill            = D.fill,
  fillOpacity     = D.fillOpacity,
  stroke          = D.stroke,
  strokeWidth     = D.strokeWidth,
  strokeDasharray = D.strokeDasharray,
  // null defaults — the core falls back to `payload.duration` / `payload.ease`
  // (the host chart's values) so this layer animates IN LOCKSTEP with the
  // rest of the chart instead of overriding to GLOBAL_DEFAULTS. Mirrors Vue.
  duration        = null,
  ease            = null,
  order,
}) {
  const { draw, zoom, layerContainer } = useContext(CanvasContext);
  const { chartContext, chartData }    = useContext(ChartContext);

  // Stabilise inline array props by content.
  const stableAreas = useStable(areas);

  const coreRef = useRef(null);
  if (!coreRef.current) coreRef.current = createRefAreaLayer();
  const core = coreRef.current;

  const props = () => ({
    areas:      stableAreas,
    data:       data       ?? chartData             ?? [],
    xAccessor,
    yAccessor,
    margin:     margin     ?? chartContext?.margin  ?? null,
    padding:    padding    ?? chartContext?.padding ?? null,
    xScaleType: xScaleType ?? D.xScaleType,
    yScaleType: yScaleType ?? D.yScaleType,
    yDomain,
    fill,
    fillOpacity,
    stroke,
    strokeWidth,
    strokeDasharray,
    duration,
    ease,
    layerContainer,
  });

  // Full re-render on canvas draw signal
  useEffect(() => {
    if (draw?.svgEl) core.render(draw, props());
  }, [draw]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interactive zoom — cheap per-frame redraw (core overrides to duration:0)
  useEffect(() => {
    if (zoom) core.onZoom(zoom);
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightweight rerender on prop changes (no new draw payload).
  // Depends on `stableAreas` so a fresh-but-identical inline areas array
  // (common in JSX) does NOT re-trigger an animation on every parent render.
  useEffect(() => {
    core.rerender(props());
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    stableAreas, data, xAccessor, yAccessor, margin, padding,
    xScaleType, yScaleType, yDomain,
    fill, fillOpacity, stroke, strokeWidth, strokeDasharray,
    duration, ease,
  ]);

  useEffect(() => { core.setOrder(order); }, [order]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => core.destroy(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default RefAreaLayer;
