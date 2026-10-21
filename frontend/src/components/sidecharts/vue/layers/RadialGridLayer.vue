<template></template>

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createRadialGridLayer, RADIAL_GRID_LAYER_DEFAULTS } from "../../core/radialGridLayer.js";

const props = defineProps({
  max:                 { type: Number, default: RADIAL_GRID_LAYER_DEFAULTS.max },
  scaleType:           { type: String, default: RADIAL_GRID_LAYER_DEFAULTS.scaleType },
  gridColor:           { type: String, default: RADIAL_GRID_LAYER_DEFAULTS.gridColor },
  gridStrokeDasharray: { type: String, default: RADIAL_GRID_LAYER_DEFAULTS.gridStrokeDasharray },
  tickColor:           { type: String, default: RADIAL_GRID_LAYER_DEFAULTS.tickColor },
  tickCount:           { type: Number, default: RADIAL_GRID_LAYER_DEFAULTS.tickCount },
  order:               { type: Number, default: RADIAL_GRID_LAYER_DEFAULTS.order },
});

const draw         = inject("draw");
const roseControls = inject("roseControls");
const core         = createRadialGridLayer();
const getProps     = () => ({ ...props, roseControls });

watch(draw, (payload) => core.render(payload, getProps()), { immediate: true });
watch(() => [props.max, props.scaleType], () => core.rerender(getProps()));
watch(() => props.order, (order) => core.setOrder(order), { immediate: true });
onBeforeUnmount(() => core.destroy());
</script>
