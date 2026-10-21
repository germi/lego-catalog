<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createContourLayer, CONTOUR_LAYER_DEFAULTS } from "../../core/contourLayer.js";

const props = defineProps({
  data:        { default: null },
  thresholds:  { default: CONTOUR_LAYER_DEFAULTS.thresholds },
  colorScale:  { type: Function, default: CONTOUR_LAYER_DEFAULTS.colorScale },
  fillOpacity: { type: Number,   default: CONTOUR_LAYER_DEFAULTS.fillOpacity },
  stroke:      { type: String,   default: CONTOUR_LAYER_DEFAULTS.stroke },
  strokeWidth: { type: Number,   default: CONTOUR_LAYER_DEFAULTS.strokeWidth },
  smooth:      { type: Boolean,  default: CONTOUR_LAYER_DEFAULTS.smooth },
  duration:    { type: Number,   default: CONTOUR_LAYER_DEFAULTS.duration },
  visible:     { type: Boolean,  default: true },
  order:       { type: Number,   default: undefined },
});

const emit = defineEmits(["hover", "click"]);

const draw           = inject("draw");
const zoom           = inject("zoom");
const layerContainer = inject("layerContainer", null);

const core = createContourLayer({
  onHover: (e) => emit("hover", e),
  onClick: (d) => emit("click", d),
});

const getProps = () => ({ ...props, layerContainer });

watch(draw, (payload) => { if (payload) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [
    () => props.data,
    () => props.thresholds,
    () => props.colorScale,
    () => props.fillOpacity,
    () => props.stroke,
    () => props.strokeWidth,
    () => props.smooth,
    () => props.duration,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(() => props.order,   (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
