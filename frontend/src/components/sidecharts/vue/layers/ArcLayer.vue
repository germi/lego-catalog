<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createArcLayer, ARC_LAYER_DEFAULTS } from "../../core/arcLayer.js";

const props = defineProps({
  data:              { type: Array,           default: () => ARC_LAYER_DEFAULTS.data },
  projector:         {                        default: ARC_LAYER_DEFAULTS.projector },
  color:             {                        default: ARC_LAYER_DEFAULTS.color },
  width:             { type: Number,          default: ARC_LAYER_DEFAULTS.width },
  opacity:           { type: Number,          default: ARC_LAYER_DEFAULTS.opacity },
  curvature:         { type: Number,          default: ARC_LAYER_DEFAULTS.curvature },
  fixedSize:         { type: Boolean,         default: ARC_LAYER_DEFAULTS.fixedSize },
  duration:          { type: Number,          default: ARC_LAYER_DEFAULTS.duration },
  dashArray:         { type: String,          default: ARC_LAYER_DEFAULTS.dashArray },
  animate:           { type: Boolean,         default: ARC_LAYER_DEFAULTS.animate },
  animateSpeed:      { type: Number,          default: ARC_LAYER_DEFAULTS.animateSpeed },
  labelFontSize:     { type: Number,          default: ARC_LAYER_DEFAULTS.labelFontSize },
  labelColor:        {                        default: ARC_LAYER_DEFAULTS.labelColor },
  labelBgColor:      {                        default: ARC_LAYER_DEFAULTS.labelBgColor },
  labelBgWidth:      { type: Number,          default: ARC_LAYER_DEFAULTS.labelBgWidth },
  labelDy:           { type: Number,          default: ARC_LAYER_DEFAULTS.labelDy },
  // Highlight / dim
  highlighted:        { type: [Array, String], default: () => ARC_LAYER_DEFAULTS.highlighted },
  highlightOpacity:   { type: Number,          default: ARC_LAYER_DEFAULTS.highlightOpacity },
  highlightColor:     {                        default: ARC_LAYER_DEFAULTS.highlightColor },
  highlightWidth:     { type: Number,          default: ARC_LAYER_DEFAULTS.highlightWidth },
  highlightDashArray: { type: String,          default: ARC_LAYER_DEFAULTS.highlightDashArray },
  dimOpacity:         { type: Number,          default: ARC_LAYER_DEFAULTS.dimOpacity },
  dimColor:           {                        default: ARC_LAYER_DEFAULTS.dimColor },
  dimWidth:           { type: Number,          default: ARC_LAYER_DEFAULTS.dimWidth },
  dimDashArray:       { type: String,          default: ARC_LAYER_DEFAULTS.dimDashArray },
  order:             { type: Number,          default: undefined },
});

const emit = defineEmits(["hover", "click"]);

const draw           = inject("draw");
const zoom           = inject("zoom");
const layerContainer = inject("layerContainer", null);

const core = createArcLayer({
  onHover: (e) => emit("hover", e),
  onClick: (d) => emit("click", d),
});

const getProps = () => ({ ...props, layerContainer });

watch(draw, (payload) => { if (payload) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [
    () => props.data,
    () => props.projector,
    () => props.color,
    () => props.width,
    () => props.opacity,
    () => props.curvature,
    () => props.fixedSize,
    () => props.duration,
    () => props.dashArray,
    () => props.animate,
    () => props.animateSpeed,
    () => props.labelFontSize,
    () => props.labelColor,
    () => props.labelBgColor,
    () => props.labelBgWidth,
    () => props.labelDy,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

// Highlight changes are instant (duration 0) so hovering feels immediate
// regardless of the canvas's current animation duration.
watch(
  [
    () => props.highlighted,
    () => props.highlightOpacity,
    () => props.highlightColor,
    () => props.highlightWidth,
    () => props.highlightDashArray,
    () => props.dimOpacity,
    () => props.dimColor,
    () => props.dimWidth,
    () => props.dimDashArray,
  ],
  () => {
    core.rerender(getProps(), 0);
  },
  { deep: true },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
