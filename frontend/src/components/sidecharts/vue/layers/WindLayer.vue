<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createWindLayer, WIND_LAYER_DEFAULTS } from "../../core/windLayer.js";

const props = defineProps({
  data:      { type: Array,   default: () => [] },
  color:     { type: String,  default: WIND_LAYER_DEFAULTS.color },
  width:     { type: Number,  default: WIND_LAYER_DEFAULTS.width },
  maxLength: { type: Number,  default: WIND_LAYER_DEFAULTS.maxLength },
  minLength: { type: Number,  default: WIND_LAYER_DEFAULTS.minLength },
  arrowSize: { type: Number,  default: WIND_LAYER_DEFAULTS.arrowSize },
  maxSpeed:  { type: Number,  default: WIND_LAYER_DEFAULTS.maxSpeed },
  opacity:   { type: Number,  default: WIND_LAYER_DEFAULTS.opacity },
  duration:  { type: Number,  default: WIND_LAYER_DEFAULTS.duration },
  visible:   { type: Boolean, default: true },
  order:     { type: Number,  default: undefined },
});

const emit = defineEmits(["hover", "click"]);

const draw           = inject("draw");
const zoom           = inject("zoom");
const layerContainer = inject("layerContainer", null);

const core = createWindLayer({
  onHover: (e) => emit("hover", e),
  onClick: (d) => emit("click", d),
});

const getProps = () => ({ ...props, layerContainer });

watch(draw, (payload) => { if (payload) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

watch(
  [
    () => props.data,
    () => props.color,
    () => props.width,
    () => props.maxLength,
    () => props.minLength,
    () => props.arrowSize,
    () => props.maxSpeed,
    () => props.opacity,
    () => props.duration,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(() => props.order,   (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
