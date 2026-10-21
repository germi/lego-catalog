<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createAxisLayer, AXIS_LAYER_DEFAULTS } from "../../core/axisLayer.js";

const props = defineProps({
  side:          { type: String,   default: AXIS_LAYER_DEFAULTS.side },
  data:          { type: Array,    default: () => AXIS_LAYER_DEFAULTS.data },
  margin:        { type: Object,   default: () => ({ ...AXIS_LAYER_DEFAULTS.margin }) },
  padding:       { type: Object,   default: () => ({ ...AXIS_LAYER_DEFAULTS.padding }) },
  scale:         { type: Object,   default: AXIS_LAYER_DEFAULTS.scale },
  max:           { type: Number,   default: AXIS_LAYER_DEFAULTS.max },
  stacked:       { type: Boolean,  default: AXIS_LAYER_DEFAULTS.stacked },
  tickValues:    { type: Array,    default: AXIS_LAYER_DEFAULTS.tickValues },
  tickFormat:    { type: Function, default: AXIS_LAYER_DEFAULTS.tickFormat },
  numTicks:      { type: Number,   default: AXIS_LAYER_DEFAULTS.numTicks },
  paddingInner:  { type: Number,   default: AXIS_LAYER_DEFAULTS.paddingInner },
  paddingOuter:  { type: Number,   default: AXIS_LAYER_DEFAULTS.paddingOuter },
  ease:          { type: String,   default: AXIS_LAYER_DEFAULTS.ease },
  duration:      { type: Number,   default: AXIS_LAYER_DEFAULTS.duration },
  tickColor:     { type: String,   default: AXIS_LAYER_DEFAULTS.tickColor },
  tickTextColor: { type: String,   default: AXIS_LAYER_DEFAULTS.tickTextColor },
  tickFontSize:  { type: Number,   default: AXIS_LAYER_DEFAULTS.tickFontSize },
  tickAngle:     { type: Number,   default: AXIS_LAYER_DEFAULTS.tickAngle },
  tickStagger:   { type: Number,   default: AXIS_LAYER_DEFAULTS.tickStagger },
  showGrid:      { type: Boolean,  default: AXIS_LAYER_DEFAULTS.showGrid },
  gridColor:     { type: String,   default: AXIS_LAYER_DEFAULTS.gridColor },
  gridDasharray: { type: String,   default: AXIS_LAYER_DEFAULTS.gridDasharray },
  gridOpacity:   { type: Number,   default: AXIS_LAYER_DEFAULTS.gridOpacity },
  phased:        { type: Boolean,  default: AXIS_LAYER_DEFAULTS.phased },
  order:         { type: Number,   default: undefined },
});

const draw = inject("draw");
const zoom = inject("zoom", null);
const core = createAxisLayer();

const getProps = () => ({ ...props });

watch(draw, (payload) => core.render(payload, getProps()), { immediate: true });
watch(zoom, (t) => { if (t) core.onZoom(t); });

// SINGLE RENDER PATH (mirrors RibbonLayer — see ribbon-chart-projector-refactor
// -plan.md §B). Props that change the host's PROJECTOR are EXCLUDED here:
// `data, max, stacked, paddingInner, paddingOuter`. When any of them changes the
// host's chartProjector recomputes → BaseCanvas.setProjector fires ONE draw →
// our `watch(draw)` renders ONCE. Leaving them here too renders a SECOND time in
// the next flush, and because the band-axis category phasing reads its own
// advancing `lastRenderData`, that second pass sees prev === new (no exits/
// enters) → phase1Dur 0 → it SNAPS the ticks to final position, killing the
// phased slide that keeps x-axis labels in lockstep with the bars. Both band
// hosts (RibbonChart, ScatterPlot) drive these through the draw.
//
// `padding` is EXCLUDED for the same reason: it feeds the host's chartProjector
// (→ draw), AND hosts often pass it as an inline object literal (e.g.
// rosechartPage's `:padding="{…}"`) that gets a fresh identity on every parent
// re-render — which would trip this watcher on every data swap and double-render
// the axis. The host must likewise keep `tickFormat`'s identity stable across
// data changes — a data-derived inline formatter trips this the same way (see
// RibbonChart.vue's stable xTickFormat).
watch(
  [
    () => props.scale,
    () => props.tickColor,
    () => props.tickTextColor,
    () => props.tickFontSize,
    () => props.tickAngle,
    () => props.tickStagger,
    () => props.tickValues,
    () => props.numTicks,
    () => props.tickFormat,
    () => props.duration,
    () => props.showGrid,
    () => props.gridColor,
    () => props.gridDasharray,
    () => props.gridOpacity,
  ],
  () => core.rerender(props.duration, getProps()),
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
