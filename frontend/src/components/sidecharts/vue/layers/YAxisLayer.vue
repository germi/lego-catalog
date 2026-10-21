<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createYAxisLayer, YAXIS_LAYER_DEFAULTS } from "../../core/yAxisLayer.js";

const props = defineProps({
  side:          { type: String,   default: YAXIS_LAYER_DEFAULTS.side },
  scale:         { type: Object,   default: YAXIS_LAYER_DEFAULTS.scale },
  scaleType:     { type: String,   default: YAXIS_LAYER_DEFAULTS.scaleType },
  max:           { type: Number,   default: YAXIS_LAYER_DEFAULTS.max },
  min:           { type: Number,   default: YAXIS_LAYER_DEFAULTS.min },
  nice:          { type: Boolean,  default: YAXIS_LAYER_DEFAULTS.nice },
  data:          { type: Array,    default: () => YAXIS_LAYER_DEFAULTS.data },
  stacked:       { type: Boolean,  default: YAXIS_LAYER_DEFAULTS.stacked },
  margin:        { type: Object,   default: () => ({ ...YAXIS_LAYER_DEFAULTS.margin }) },
  padding:       { type: Object,   default: () => ({ ...YAXIS_LAYER_DEFAULTS.padding }) },
  showGrid:      { type: Boolean,  default: YAXIS_LAYER_DEFAULTS.showGrid },
  tickValues:    { type: Array,    default: YAXIS_LAYER_DEFAULTS.tickValues },
  tickFormat:    { type: Function, default: YAXIS_LAYER_DEFAULTS.tickFormat },
  numTicks:      { type: Number,   default: YAXIS_LAYER_DEFAULTS.numTicks },
  tickSize:      { type: Number,   default: YAXIS_LAYER_DEFAULTS.tickSize },
  tickColor:     { type: String,   default: YAXIS_LAYER_DEFAULTS.tickColor },
  tickTextColor: { type: String,   default: YAXIS_LAYER_DEFAULTS.tickTextColor },
  gridColor:     { type: String,   default: YAXIS_LAYER_DEFAULTS.gridColor },
  gridDasharray: { type: String,   default: YAXIS_LAYER_DEFAULTS.gridDasharray },
  gridOpacity:   { type: Number,   default: YAXIS_LAYER_DEFAULTS.gridOpacity },
  ease:             { type: String,   default: YAXIS_LAYER_DEFAULTS.ease },
  duration:         { type: Number,   default: YAXIS_LAYER_DEFAULTS.duration },
  textTicksInside:  { type: Boolean,  default: YAXIS_LAYER_DEFAULTS.textTicksInside },
  rtl:              { type: Boolean,  default: YAXIS_LAYER_DEFAULTS.rtl },
  order:            { type: Number,   default: undefined },
});

const draw = inject("draw");
const zoom = inject("zoom", null);
const core = createYAxisLayer();

const getProps = () => ({ ...props });

watch(draw, (payload) => core.render(payload, getProps()), { immediate: true });
watch(zoom, (t) => { if (t) core.onZoom(t); });

watch(
  [
    () => props.data,
    () => props.scale,
    () => props.scaleType,
    () => props.max,
    () => props.min,
    () => props.nice,
    () => props.stacked,
    () => props.padding,
    () => props.showGrid,
    () => props.tickValues,
    () => props.numTicks,
    () => props.tickFormat,
    () => props.tickSize,
    () => props.tickColor,
    () => props.tickTextColor,
    () => props.gridColor,
    () => props.gridDasharray,
    () => props.gridOpacity,
    () => props.duration,
    () => props.textTicksInside,
    () => props.rtl,
  ],
  () => core.rerender(props.duration, getProps()),
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
