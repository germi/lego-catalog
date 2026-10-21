<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createLineLayer, LINE_LAYER_DEFAULTS as D } from "../../core/lineLayer.js";

const props = defineProps({
  data:            { type: Array,           default: () => D.data },
  keys:            { type: Array,           default: D.keys },
  color:           { type: Object,          default: () => ({ ...D.color }) },
  // margin / padding default to null — the core inherits payload.margin
  // when no explicit value is supplied by the parent chart.
  margin:          { type: Object,          default: null },
  padding:         { type: Object,          default: null },
  // The layer reads scales from `payload.projector`, but it still needs
  // `xScaleType` + `parseTime` to know how to extract each data point's
  // x-value (e.g. parse `d.name` as a Date when the projector's xScale is
  // a scaleTime).  Passed by the parent LineChart from `effective.*`.
  xScaleType:      { type: String,          default: D.xScaleType },
  parseTime:       { type: Function,        default: D.parseTime },
  max:             { type: Number,          default: D.max },
  forceValues:     { type: [Number, Array], default: D.forceValues },
  stacked:         { type: Boolean,         default: D.stacked },
  curve:           { type: [String, Function], default: D.curve },
  strokeWidth:      { type: [Number, Function], default: D.strokeWidth },
  strokeOpacity:    { type: Number,          default: D.strokeOpacity },
  strokeDasharray:  { type: [String, Function], default: D.strokeDasharray },
  strokeDashoffset: { type: [Number, String, Function, Object], default: D.strokeDashoffset },
  dotRadius:       { type: [Number, Function], default: D.dotRadius },
  dotColor:        { type: [Object, Function], default: D.dotColor },
  duration:        { type: Number,          default: D.duration },
  ease:            { type: String,          default: D.ease },
  highlighted:     { type: [String, Array], default: D.highlighted },
  dimOpacity:       { type: Number,         default: D.dimOpacity },
  highlightedColor: { type: Object,         default: D.highlightedColor },
  defaultColor:    { type: String,          default: D.defaultColor },
  // x-proximity hover.  `enableXHover` is consulted only at first render
  // (the overlay <rect> is created in initGroups, which runs once).
  enableXHover:       { type: Boolean, default: D.enableXHover },
  showHoverLine:      { type: Boolean, default: D.showHoverLine },
  hoverLineColor:     { type: String,  default: D.hoverLineColor },
  hoverLineWidth:     { type: Number,  default: D.hoverLineWidth },
  hoverLineDasharray: { type: String,  default: D.hoverLineDasharray },
  // External selection.  `selectedX` matches d.name; selection dots and
  // the persistent hover line snap to that x.
  selectedX:                  { type: [String, Number], default: D.selectedX },
  selectedKey:                { type: String,           default: D.selectedKey },
  selectedDotRadius:          { type: Number,           default: D.selectedDotRadius },
  selectedDotStroke:          { type: String,           default: D.selectedDotStroke },
  selectedDotStrokeWidth:     { type: Number,           default: D.selectedDotStrokeWidth },
  selectedDotStrokeDasharray: { type: String,           default: D.selectedDotStrokeDasharray },
  showLastPoint:     { type: Boolean,          default: D.showLastPoint },
  selectionDuration: { type: Number,           default: D.selectionDuration },
  // Debug: when false, the line clip-path is dropped so you can see
  // phase-A/B's off-range extrapolated tails as they slide in/out.
  debugClip:       { type: Boolean,         default: D.debugClip },
  order:          { type: Number,           default: undefined },
});

const emit           = defineEmits(["hover", "click"]);
const draw           = inject("draw");
const zoom           = inject("zoom", null);
const liveTransform  = inject("liveTransform", null);
const layerContainer = inject("layerContainer", null);
// Inherit margin / padding from the host chart so a slotted <LineLayer>
// (e.g. inside a <MaskLayer>) applies the same `translate(p.left, p.top)`
// to its contentG as the chart's built-in line layer would. Without this,
// slotted lines render p.left pixels to the left of the x-axis ticks.
const chartContext = inject("chartContext", null);

const core = createLineLayer({
  onHover: (d) => emit("hover", d),
  onClick: (d) => emit("click", d),
});

// If a parent chart (LineChart, AreaChart) provided a `lineLayerPaths`
// holder, populate it with the helpers slotted siblings — most importantly
// <LineLabelLayer> — need.  A common-ancestor ref is required here because
// slot content is a sibling of this layer, not a descendant, so provide()
// from inside this layer wouldn't be visible to the slot.
//   getPathId         (key)             → SVG id of the label-rail path
//   computeAnchorOffset(key, dataId)    → length offset on that rail where
//                                         dataId sits (for `atId` labels)
const lineLayerPathsHolder = inject("lineLayerPaths", null);
if (lineLayerPathsHolder) {
  lineLayerPathsHolder.value = {
    getPathId:           core.getPathId,
    computeAnchorOffset: core.computeAnchorOffset,
    getSeriesEndPoint:   core.getSeriesEndPoint,
  };
}

const getProps = () => {
  const ctx = chartContext?.value ?? {};
  return {
    ...props,
    layerContainer,
    // margin / padding default to null — core falls back to payload.margin
    // when both prop and chartContext are unset.  Inheriting from
    // chartContext keeps slotted layers aligned with the chart's axis ticks.
    margin:   props.margin  ?? ctx.margin  ?? null,
    padding:  props.padding ?? ctx.padding ?? null,
    // duration: prop wins; else core falls back to payload.duration.
    duration: props.duration ?? null,
  };
};

// First-render zoom catch-up — overlay the `liveTransform` (kept current by
// BaseCanvas from both onZoom AND onDraw) onto the payload before rendering,
// so a layer mounted mid-zoom lands at the current scale. See AreaLayer.vue
// for the full rationale.
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

// Visual-only props watcher.  Data / scale / margin / padding changes now
// flow through the projector → BaseCanvas → draw signal, so a redraw
// fires automatically when any of those change.  Visual props (color,
// curve, stroke, dot radius, highlight) don't change the projector, so
// we re-render on them explicitly.
//
// `deep: true` is critical: callers often pass `:color="{ key: gradient }"`
// inline, which produces a fresh object reference on every parent render
// even when the inner values are stable.  A shallow watch would fire on
// every swap and INTERRUPT the in-flight 3-phase choreography mid-frame,
// turning the slide animation into an instant snap.
watch(
  [
    () => props.keys,
    () => props.color,
    () => props.stacked,
    () => props.curve,
    () => props.strokeWidth,
    () => props.strokeOpacity,
    () => props.strokeDasharray,
    () => props.strokeDashoffset,
    () => props.dotRadius,
    () => props.dotColor,
    () => props.highlighted,
    () => props.dimOpacity,
    () => props.highlightedColor,
    () => props.showHoverLine,
    () => props.hoverLineColor,
    () => props.hoverLineWidth,
    () => props.hoverLineDasharray,
    () => props.selectedDotRadius,
    () => props.selectedDotStroke,
    () => props.selectedDotStrokeWidth,
    () => props.selectedDotStrokeDasharray,
    () => props.showLastPoint,
    () => props.debugClip,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

// `selectedX` gets its own fast-path watcher so clicking to pin a year
// snaps the dots/line instantly — animating through `duration` would
// feel laggy for what is effectively a cursor move.  Data changes still
// route through the full `rerender` watcher and animate normally.
//
// Pass a fresh `getProps()` snapshot: the core caches `lastProps` from
// the previous render, so a watcher that doesn't hand over the new
// value would leave `lastProps.selectedX` stale and the dots wouldn't
// move on a fresh pin.
watch([() => props.selectedX, () => props.selectedKey], () => core.refreshSelection(getProps()));

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
