<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createRefAreaLayer, REF_AREA_LAYER_DEFAULTS as D } from "../../core/refAreaLayer.js";

const props = defineProps({
  /**
   * Array of reference-area specs.  Each must have a stable `id` — the
   * D3 join uses it as the key so a spec that changes corners or sample
   * points (same id) animates instead of being replaced.
   *
   * Spec shapes:
   *   { id, x1, y1, x2, y2 }                       rectangle (any corner can be
   *                                                null/±Infinity for chart edge)
   *   { id, y: <data y>, side: "above"|"below" }   horizontal half-plane
   *   { id, x: <data x>, side: "left"|"right" }    vertical half-plane
   *   { id, points: [{x, y0, y1}, …] }             band between two curves
   *   { id, rule: "regressionCI" | fn, ci?: 0.95 } computed each render
   *
   * Per-datum optional styling (overrides layer-level defaults):
   *   fill, fillOpacity, stroke, strokeWidth, strokeDasharray
   */
  areas:           { type: Array,    default: () => [] },

  /**
   * Data array for rule-based areas (regression CI, custom rules).
   * Falls back to the parent chart's `chartData` inject when not provided.
   */
  data:            { type: Array,    default: null },
  xAccessor:       { type: Function, default: D.xAccessor },
  yAccessor:       { type: Function, default: D.yAccessor },

  margin:          { type: Object,   default: null },
  padding:         { type: Object,   default: null },
  xScaleType:      { type: String,   default: null },
  yScaleType:      { type: String,   default: null },

  fill:            { type: String,   default: D.fill },
  fillOpacity:     { type: Number,   default: D.fillOpacity },
  stroke:          { type: String,   default: D.stroke },
  strokeWidth:     { type: Number,   default: D.strokeWidth },
  strokeDasharray: { type: String,   default: D.strokeDasharray },

  duration:        { type: Number,   default: null },
  ease:            { type: String,   default: null },

  order:           { type: Number,   default: undefined },
});

const draw           = inject("draw");
const zoom           = inject("zoom", null);
const layerContainer = inject("layerContainer", null);
const chartContext   = inject("chartContext", null);
const chartData      = inject("chartData", null);

const core = createRefAreaLayer();

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
// The immediate watch fires with the most-recent payload which already carries
// the correct rescaled scales.
//
// Token used to cancel a pending areas-watcher rerender when a draw event
// arrives concurrently (e.g. a simultaneous zoomToDomain call).  The draw
// watcher increments the token so the deferred rerender self-cancels.
// Without this, a reactive `areas` change + `zoomToDomain` in the same click
// handler would trigger `rerender` in microtask A (stale pre-zoom scales),
// then the correct `render` in microtask C — but in the worst case the stale
// rerender resolves the area to `null` (outside old viewport), D3 exits the
// element, and microtask C re-creates it as an enter transition (opacity 0→1)
// that looks "late" instead of a smooth morph.
let _rerenderToken = 0;

watch(draw, (payload) => {
  if (!payload?.svgEl) return;
  ++_rerenderToken;           // cancel any pending areas-watcher rerender
  core.render(payload, getProps());
}, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [
    () => props.areas,
    () => props.data,
    () => props.xAccessor,
    () => props.yAccessor,
    () => props.margin,
    () => props.padding,
    () => props.xScaleType,
    () => props.yScaleType,
    () => props.fill,
    () => props.fillOpacity,
    () => props.stroke,
    () => props.strokeWidth,
    () => props.strokeDasharray,
    () => props.duration,
    () => props.ease,
    () => chartData?.value,
  ],
  () => {
    // Capture token for this specific change.  Defer TWO microtask hops so
    // any concurrent _applyPendingZoom (microtask B) → drawSignal update
    // (microtask C) can arrive first.  If it does, the draw watcher above
    // increments _rerenderToken, making `token` stale and this rerender a
    // no-op (the draw watcher's core.render already handled everything with
    // the correct zoom-adjusted scales).
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
