<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createAreaLayer, AREA_LAYER_DEFAULTS as D } from "../../core/areaLayer.js";

const props = defineProps({
  data:          { type: Array,           default: () => D.data },
  keys:          { type: Array,           default: D.keys },
  color:         { type: [Object, String], default: () => ({ ...D.color }) },
  // margin / padding default to null — the core inherits payload.margin
  // when no explicit value is supplied by the parent chart.
  margin:        { type: Object,          default: null },
  padding:       { type: Object,          default: null },
  // xScaleType / parseTime control how `d.name` is parsed into an x-value
  // — must match the host chart's projector configuration.
  xScaleType:    { type: String,          default: D.xScaleType },
  parseTime:     { type: Function,        default: D.parseTime },
  max:           { type: Number,          default: D.max },
  forceValues:   { type: [Number, Array], default: D.forceValues },
  stacked:       { type: Boolean,         default: D.stacked },
  curve:         { type: [String, Function], default: D.curve },
  opacity:       { type: Number,          default: D.opacity },
  strokeWidth:   { type: Number,          default: D.strokeWidth },
  strokeColor:   { type: String,          default: D.strokeColor },
  strokeOpacity: { type: Number,          default: D.strokeOpacity },
  upperKey:      { type: String,          default: D.upperKey },
  lowerKey:      { type: String,          default: D.lowerKey },
  duration:      { type: Number,          default: D.duration },
  ease:          { type: String,          default: D.ease },
  highlighted:   { type: [String, Array], default: D.highlighted },
  defaultColor:  { type: String,          default: D.defaultColor },
  order:          { type: Number,           default: undefined },
});

const emit           = defineEmits(["hover", "click"]);
const draw           = inject("draw");
const zoom           = inject("zoom", null);
const liveTransform  = inject("liveTransform", null);
const layerContainer = inject("layerContainer", null);
// Layout inheritance for slotted usage (e.g. <AreaLayer> in band mode
// inside a <LineChart>).  Provides margin / padding so the area aligns
// with the host chart's LineLayer.  Narrow by design.
const chartContext   = inject("chartContext", null);

const core = createAreaLayer({
  onHover: (d) => emit("hover", d),
  onClick: (d) => emit("click", d),
});

const getProps = () => {
  const ctx = chartContext?.value ?? {};
  return {
    ...props,
    layerContainer,
    // Slotted in a chart → inherit chart margin / padding.  Standalone →
    // fall through to null and the core inherits payload.margin.
    margin:   props.margin   ?? ctx.margin  ?? null,
    padding:  props.padding  ?? ctx.padding ?? null,
    duration: props.duration ?? null,
  };
};

// First-render zoom catch-up.
//
// When this layer mounts mid-zoom, the draw payload's `zoomTransform` can be
// STALE — manual gestures don't fire draws (they dispatch onZoom), so the
// latest drawSignal reflects whatever scale was active at the last draw.
// Naively rendering with a stale payload would set up the enter transition
// against the OLD scale; the band/line ends up "sliding" toward the stale
// target while a follow-up onZoom snap can't cancel the in-flight transition.
//
// `liveTransform` (provided by BaseCanvas) is updated from BOTH onZoom and
// onDraw, so it always reflects the current d3 transform — manual or
// programmatic, in any order. Overlay it onto the payload before rendering
// when it disagrees with the payload's snapshot. Clear payload xScale/yScale
// so downstream that reads them recomputes from raw + the live transform via
// applyZoomToScales (keeping everything self-consistent).
let zoomCaughtUp = false;
watch(draw, (payload) => {
  if (!payload?.svgEl) return;
  let effective = payload;
  if (!zoomCaughtUp) {
    zoomCaughtUp = true;
    const live = liveTransform?.value;
    const pt = payload.zoomTransform;
    const alreadyCorrect = pt && live && pt.k === live.k && pt.x === live.x && pt.y === live.y;
    if (live && !alreadyCorrect && (live.k !== 1 || live.x !== 0 || live.y !== 0)) {
      effective = { ...payload, zoomTransform: live, xScale: undefined, yScale: undefined };
    }
  }
  core.render(effective, getProps());
}, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

// Visual-only props.  Data / scale / margin / padding / upperKey /
// lowerKey changes flow through the projector → BaseCanvas → draw
// signal, so a redraw fires automatically when any of those change.
// `deep: true` — see LineLayer for rationale.  Inline `:color="{…}"` and
// `:keys="['…']"` props produce fresh outer references on every parent
// render even when content is stable; deep-compare avoids spurious
// rerenders that interrupt the 3-phase choreography mid-frame.
watch(
  [
    () => props.keys,
    () => props.color,
    () => props.stacked,
    () => props.curve,
    () => props.opacity,
    () => props.strokeWidth,
    () => props.strokeColor,
    () => props.strokeOpacity,
    () => props.upperKey,
    () => props.lowerKey,
    () => props.highlighted,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
