<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createGeoCircleLayer, GEO_CIRCLE_LAYER_DEFAULTS } from "../../core/geoCircleLayer.js";

const props = defineProps({
  color:       { type: String,  default: GEO_CIRCLE_LAYER_DEFAULTS.color },
  radius:      { type: Number,  default: GEO_CIRCLE_LAYER_DEFAULTS.radius },
  fillOpacity: { type: Number,  default: GEO_CIRCLE_LAYER_DEFAULTS.fillOpacity },
  visible:     { type: Boolean, default: true },
  order:       { type: Number,  default: undefined },
});

const draw           = inject("draw");
const zoom           = inject("zoom");
const layerContainer = inject("layerContainer", null);

const core = createGeoCircleLayer();

const getProps = () => ({ ...props, layerContainer });

watch(draw, (payload) => { if (payload) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [() => props.color, () => props.radius, () => props.fillOpacity],
  () => core.rerender(getProps()),
);

watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(() => props.order,   (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
