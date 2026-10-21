<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createRefLineLayer, REF_LINE_LAYER_DEFAULTS as D } from "../../core/refLineLayer.js";

const props = defineProps({
  /**
   * Array of reference-line specs.  Each must have a stable `id` — the
   * D3 join uses it as the key so a spec that changes (`{y:50}` → `{y:30}`)
   * animates instead of being replaced.
   *
   * Spec shapes:
   *   { id, y: <data y> }              horizontal
   *   { id, x: <data x> }              vertical
   *   { id, x1, y1, x2, y2 }           slanted (two endpoints)
   *   { id, rule: "medianY" | "medianX" | "meanY" | "meanX" |
   *               "regression" | (data, scales) => spec }
   *
   * Per-datum optional styling (overrides the layer-level defaults):
   *   color, dasharray, strokeWidth, opacity, label,
   *   labelColor, labelSize, labelDy, labelAlign
   */
  lines:        { type: Array,    default: () => [] },

  /**
   * Optional data array used to compute rule-based lines (median /
   * regression / custom).  When omitted, falls back to the parent
   * chart's `chartData` inject.
   */
  data:         { type: Array,    default: null },
  xAccessor:    { type: Function, default: D.xAccessor },
  yAccessor:    { type: Function, default: D.yAccessor },

  // margin / padding default to null — the core inherits payload.margin
  // (the canvas's margin) when no chart-level override is supplied.
  margin:       { type: Object,   default: null },
  padding:      { type: Object,   default: null },
  xScaleType:   { type: String,   default: null },
  yScaleType:   { type: String,   default: null },

  // Visual defaults — per-datum can override
  color:        { type: String,   default: D.color },
  dasharray:    { type: String,   default: D.dasharray },
  strokeWidth:  { type: Number,   default: D.strokeWidth },
  opacity:      { type: Number,   default: D.opacity },

  // Label defaults
  labelColor:   { type: String,   default: D.labelColor },
  labelSize:    { type: Number,   default: D.labelSize },
  labelDy:      { type: Number,   default: D.labelDy },
  labelAlign:   { type: String,   default: D.labelAlign },

  // Animation
  duration:     { type: Number,   default: null },
  ease:         { type: String,   default: null },

  order:        { type: Number,   default: undefined },
});

const draw           = inject("draw");
const zoom           = inject("zoom", null);
const layerContainer = inject("layerContainer", null);
// Layout inheritance — keeps ref lines aligned with the host chart's
// LineLayer when slotted.
const chartContext   = inject("chartContext", null);
// Narrow inject for the chart's data — used by rule-based lines
// (medianY / medianX / regression / fn).
const chartData      = inject("chartData", null);

const core = createRefLineLayer();

const getProps = () => {
  const ctx = chartContext?.value ?? {};
  return {
    ...props,
    layerContainer,
    data:       props.data ?? chartData?.value ?? [],
    margin:     props.margin   ?? ctx.margin  ?? null,
    padding:    props.padding  ?? ctx.padding ?? null,
    xScaleType: props.xScaleType ?? D.xScaleType,
    yScaleType: props.yScaleType ?? D.yScaleType,
    duration:   props.duration ?? null,
    ease:       props.ease     ?? null,
  };
};

// The canvas pre-computes zoom-aware xScale / yScale in every fireDraw payload,
// so no "catch-up" is needed when this layer mounts into an already-zoomed canvas.
// Token used to cancel a deferred rerender when a draw event arrives in the
// same tick (same fix as RefAreaLayer — see that file for the full rationale).
let _rerenderToken = 0;

watch(draw, (payload) => {
  if (!payload?.svgEl) return;
  ++_rerenderToken;
  core.render(payload, getProps());
}, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [
    () => props.lines,
    () => props.data,
    () => props.xAccessor,
    () => props.yAccessor,
    () => props.margin,
    () => props.padding,
    () => props.xScaleType,
    () => props.yScaleType,
    () => props.color,
    () => props.dasharray,
    () => props.strokeWidth,
    () => props.opacity,
    () => props.labelColor,
    () => props.labelSize,
    () => props.labelDy,
    () => props.labelAlign,
    () => props.duration,
    () => props.ease,
    () => chartData?.value,
  ],
  () => {
    const token = ++_rerenderToken;
    Promise.resolve().then(() => Promise.resolve().then(() => {
      if (_rerenderToken === token) core.rerender(getProps());
    }));
  },
  { deep: true },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
