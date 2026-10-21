<template />

<script setup>
import { computed, inject, watch, onBeforeUnmount } from "vue";
import { createVoronoiMarkerLayer, VORONOI_MARKER_LAYER_DEFAULTS } from "../../core/voronoiMarkerLayer.js";

const props = defineProps({
  radius:        {                 default: VORONOI_MARKER_LAYER_DEFAULTS.radius },
  color:         {                 default: VORONOI_MARKER_LAYER_DEFAULTS.color },
  colorAccessor: { type: Function, default: VORONOI_MARKER_LAYER_DEFAULTS.colorAccessor },
  valueAccessor: { type: Function, default: VORONOI_MARKER_LAYER_DEFAULTS.valueAccessor },
  fixedSize:     { type: Boolean,  default: VORONOI_MARKER_LAYER_DEFAULTS.fixedSize },
  strokeWidth:   { type: Number,   default: VORONOI_MARKER_LAYER_DEFAULTS.strokeWidth },
  strokeColor:   { type: String,   default: VORONOI_MARKER_LAYER_DEFAULTS.strokeColor },
  opacity:       { type: Number,   default: VORONOI_MARKER_LAYER_DEFAULTS.opacity },
  duration:      { type: Number,   default: VORONOI_MARKER_LAYER_DEFAULTS.duration },
  visible:       { type: Boolean,  default: true },
  order:         { type: Number,   default: undefined },
});

const emit = defineEmits(["hover", "click"]);

const draw         = inject("draw");
const zoom         = inject("zoom");
const voronoiDraw  = inject("voronoiDraw");
const voronoiOrder = inject("voronoiOrder", null);
const voronoiZoomMode = inject("voronoiZoomMode", null);
const voronoiGesture  = inject("voronoiGesture", null);
const effectiveOrder = computed(() => props.order ?? voronoiOrder?.value);

const core = createVoronoiMarkerLayer({
  onHover: (e) => emit("hover", e),
  onClick: (d) => emit("click", d),
});

const getProps = () => ({ ...props, recomputeOnZoom: voronoiZoomMode?.value ?? false });

watch(draw,        (payload) => { if (payload) core.render(payload, getProps(), voronoiDraw.value); }, { immediate: true });
watch(zoom,        (t)       => { if (t) core.onZoom(t); });
watch(voronoiDraw, (state)   => core.rerender(getProps(), state));
watch(() => voronoiGesture?.value, (d) => core.applyGestureTransform?.(d));

watch(
  [
    () => props.radius,
    () => props.color,
    () => props.colorAccessor,
    () => props.valueAccessor,
    () => props.fixedSize,
    () => props.strokeWidth,
    () => props.strokeColor,
    () => props.opacity,
    () => props.duration,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(effectiveOrder,      (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
