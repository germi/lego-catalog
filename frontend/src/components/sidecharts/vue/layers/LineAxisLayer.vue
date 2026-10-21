<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createLineAxisLayer, LINE_AXIS_LAYER_DEFAULTS as D } from "../../core/lineAxisLayer.js";

const props = defineProps({
  data:          { type: Array,           default: () => D.data },
  side:          { type: String,          default: D.side },
  // margin / padding default to null — the core inherits payload.margin
  // when no explicit value is supplied by the parent chart.
  margin:        { type: Object,          default: null },
  padding:       { type: Object,          default: null },
  paddingInner:  { type: Number,          default: D.paddingInner },
  paddingOuter:  { type: Number,          default: D.paddingOuter },
  tickValues:    { type: Array,           default: D.tickValues },
  tickFormat:    { type: Function,        default: D.tickFormat },
  tickSize:      { type: Number,          default: D.tickSize },
  tickColor:     { type: String,          default: D.tickColor },
  tickTextColor: { type: String,          default: D.tickTextColor },
  fontSize:      { type: Number,          default: D.fontSize },
  showGrid:      { type: Boolean,         default: D.showGrid },
  gridColor:     { type: String,          default: D.gridColor },
  gridDasharray: { type: String,          default: D.gridDasharray },
  gridOpacity:   { type: Number,          default: D.gridOpacity },
  duration:      { type: Number,          default: D.duration },
  ease:          { type: String,          default: D.ease },
  order:         { type: Number,          default: undefined },
});

const draw           = inject("draw");
const zoom           = inject("zoom", null);
const layerContainer = inject("layerContainer", null);

const core = createLineAxisLayer();

const getProps = () => ({
  ...props,
  layerContainer,
  // margin / padding default to null — the core falls back to payload.margin.
  margin:   props.margin  ?? null,
  padding:  props.padding ?? null,
  duration: props.duration ?? null,
});

watch(draw, (payload) => { if (payload?.svgEl) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

// Visual-only props.  Data / scale / margin / padding flow through the
// projector → BaseCanvas → draw signal.
watch(
  [
    () => props.side,
    () => props.tickValues,
    () => props.tickFormat,
    () => props.tickSize,
    () => props.tickColor,
    () => props.tickTextColor,
    () => props.fontSize,
    () => props.showGrid,
    () => props.gridColor,
    () => props.gridDasharray,
    () => props.gridOpacity,
  ],
  () => core.rerender(getProps()),
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
