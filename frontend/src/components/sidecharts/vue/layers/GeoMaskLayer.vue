<template>
  <slot />
</template>

<script setup>
import { shallowRef, provide, inject, watch, onBeforeUnmount } from "vue";
import { createGeoMaskLayer } from "../../core/geoMaskLayer.js";

const props = defineProps({
  feature: { type: Object,  default: null },
  visible: { type: Boolean, default: true },
  order:   { type: Number,  default: undefined },
});

const draw = inject("draw");
const zoom = inject("zoom");

const core = createGeoMaskLayer();

const layerContainerRef = shallowRef(null);
provide("layerContainer", layerContainerRef);

watch(draw, (payload) => {
  if (!payload) return;
  core.render(payload, props.feature);
  layerContainerRef.value = core.getContainerNode();
}, { immediate: true });

watch(zoom, (t) => { if (t) core.onZoom(t); });
watch(() => props.feature, (f) => core.onFeatureChange(f));
watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(() => props.order,   (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
