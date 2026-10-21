<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createGraticuleLayer, GRATICULE_LAYER_DEFAULTS } from "../../core/graticuleLayer.js";

const props = defineProps({
  step:         { type: Array,   default: () => GRATICULE_LAYER_DEFAULTS.step },
  color:        { type: String,  default: GRATICULE_LAYER_DEFAULTS.color },
  width:        { type: Number,  default: GRATICULE_LAYER_DEFAULTS.width },
  opacity:      { type: Number,  default: GRATICULE_LAYER_DEFAULTS.opacity },
  outline:      { type: Boolean, default: GRATICULE_LAYER_DEFAULTS.outline },
  outlineColor: { type: String,  default: GRATICULE_LAYER_DEFAULTS.outlineColor },
  outlineWidth: { type: Number,  default: GRATICULE_LAYER_DEFAULTS.outlineWidth },
  fixedSize:    { type: Boolean, default: GRATICULE_LAYER_DEFAULTS.fixedSize },
  order:        { type: Number,  default: undefined },
});

const draw           = inject("draw");
const zoom           = inject("zoom");
const layerContainer = inject("layerContainer", null);

const core = createGraticuleLayer();

const getProps = () => ({ ...props, layerContainer });

watch(draw, (payload) => { if (payload) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [
    () => props.step,
    () => props.color,
    () => props.width,
    () => props.opacity,
    () => props.outline,
    () => props.outlineColor,
    () => props.outlineWidth,
    () => props.fixedSize,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
