<template />

<script setup>
import { inject, watch, onBeforeUnmount, defineExpose } from "vue";
import { createScatterLayer, SCATTER_LAYER_DEFAULTS as D } from "../../core/scatterLayer.js";

const props = defineProps({
  data:             { type: Array,    default: () => [] },
  projector:        {                 default: null },
  coordAccessor:    { type: Function, default: D.coordAccessor },
  radius:           {                 default: D.radius },
  rScaleType:       { type: String,   default: D.rScaleType },
  dotSize:          { type: Array,    default: () => [...D.dotSize] },
  valueAccessor:    { type: Function, default: D.valueAccessor },
  color:            {                 default: D.color },
  colorAccessor:    { type: Function, default: null },
  dotOpacity:       { type: Number,   default: D.dotOpacity },
  hoverFill:        {                 default: D.hoverFill },
  strokeColor:      {                 default: D.strokeColor },
  strokeWidth:      { type: Number,   default: D.strokeWidth },
  strokeOpacity:    { type: Number,   default: D.strokeOpacity },
  hoverStrokeColor: {                 default: D.hoverStrokeColor },
  highlighted:      { type: [Array, String], default: () => [] },
  selected:         {                 default: null },
  hoverScale:       { type: Number,   default: D.hoverScale },
  fixedSize:        { type: Boolean,  default: D.fixedSize },
  sortByRadius:     { type: Boolean,  default: D.sortByRadius },
  duration:         { type: Number,   default: D.duration },
  // Highlight / dim
  highlightFill:          {                default: D.highlightFill },
  highlightFillOpacity:   { type: Number,  default: D.highlightFillOpacity },
  highlightStrokeColor:   {                default: D.highlightStrokeColor },
  highlightStrokeWidth:   { type: Number,  default: D.highlightStrokeWidth },
  highlightStrokeOpacity: { type: Number,  default: D.highlightStrokeOpacity },
  dimFill:          {                default: D.dimFill },
  dimOpacity:       { type: Number,  default: D.dimOpacity },
  dimStrokeColor:   {                default: D.dimStrokeColor },
  dimStrokeWidth:   { type: Number,  default: D.dimStrokeWidth },
  dimStrokeOpacity: { type: Number,  default: D.dimStrokeOpacity },
  order:            { type: Number,   default: undefined },
});

const emit = defineEmits(["hover", "click"]);

const draw           = inject("draw");
const zoom           = inject("zoom");
const layerContainer = inject("layerContainer", null);

const core = createScatterLayer({
  onHover: (e) => emit("hover", e),
  onClick: (e) => emit("click", e),
});

const getProps = () => ({ ...props, layerContainer });

watch(draw, (payload) => {
  if (payload?.svgEl) core.render(payload, getProps());
}, { immediate: true });
watch(zoom, (t) => { if (t) core.onZoom(t); });

// ── Structural props — change geometry / paint order / projection, so they
//    need a FULL re-render (re-project + re-sort). Rare during a story.
//    NOTE: `data` is intentionally excluded — data changes flow in through
//    the draw signal (BaseCanvas projector watcher → draw → drawSignal).
watch(
  [
    () => props.coordAccessor,  // re-projects every dot
    () => props.sortByRadius,   // re-sorts paint order (needs data re-bind)
    () => props.radius,         // radius function/number swap
    () => props.fixedSize,      // changes how radius scales with zoom
  ],
  () => { if (draw.value?.svgEl) core.render(draw.value, getProps()); },
);

// ── Style props — colour, stroke, opacity, selection, highlight/dim. ANY of
//    these animates the SAME way: a style-only update that transitions over
//    `duration` via a named transition, running concurrently with (never
//    interrupting) an in-flight position transition. This is what keeps a
//    scene transition smooth when data + zoom + colours + highlight all
//    change at once.
watch(
  [
    () => props.color,
    () => props.hoverFill,
    () => props.selected,
    () => props.dotOpacity,
    () => props.strokeColor,
    () => props.strokeWidth,
    () => props.strokeOpacity,
    () => props.hoverStrokeColor,
    () => props.highlighted,
    () => props.highlightFill,
    () => props.highlightFillOpacity,
    () => props.highlightStrokeColor,
    () => props.highlightStrokeWidth,
    () => props.highlightStrokeOpacity,
    () => props.dimFill,
    () => props.dimOpacity,
    () => props.dimStrokeColor,
    () => props.dimStrokeWidth,
    () => props.dimStrokeOpacity,
  ],
  () => { if (draw.value?.svgEl) core.updateStyle(getProps()); },
  { deep: true },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());

defineExpose({
  /** Returns the SVG circle element for the datum with the given id, or null. */
  getDotEl: (id) => core.getDotEl(id),
});
</script>
