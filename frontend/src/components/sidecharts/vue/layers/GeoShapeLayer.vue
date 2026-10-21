<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createGeoShapeLayer, GEO_SHAPE_LAYER_DEFAULTS } from "../../core/geoShapeLayer.js";

const props = defineProps({
  feature:     { type: Object, default: null },
  color:       {               default: GEO_SHAPE_LAYER_DEFAULTS.color },
  fillOpacity: { type: Number, default: GEO_SHAPE_LAYER_DEFAULTS.fillOpacity },
  stroke:      { type: String, default: GEO_SHAPE_LAYER_DEFAULTS.stroke },
  strokeWidth: { type: Number, default: GEO_SHAPE_LAYER_DEFAULTS.strokeWidth },
  visible:     { type: Boolean, default: true },
  order:       { type: Number,  default: undefined },
});

const draw           = inject("draw");
const zoom           = inject("zoom");
const layerContainer = inject("layerContainer", null);

const core = createGeoShapeLayer();

const getProps = () => ({ ...props, layerContainer });

watch(draw, (payload) => { if (payload) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [
    () => props.feature,
    () => props.color,
    () => props.fillOpacity,
    () => props.stroke,
    () => props.strokeWidth,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(() => props.order,   (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
