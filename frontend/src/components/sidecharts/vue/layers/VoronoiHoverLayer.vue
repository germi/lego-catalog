<template />

<script setup>
import { computed, inject, watch, onBeforeUnmount } from "vue";
import { createVoronoiHoverLayer, VORONOI_HOVER_LAYER_DEFAULTS } from "../../core/voronoiHoverLayer.js";

const props = defineProps({
  ghostRadius: { type: Number,  default: VORONOI_HOVER_LAYER_DEFAULTS.ghostRadius },
  visible:     { type: Boolean, default: true },
  order:       { type: Number,  default: undefined },
});

const emit = defineEmits(["hover", "click"]);

const draw         = inject("draw");
const zoom         = inject("zoom");
const voronoiDraw  = inject("voronoiDraw");
const voronoiHover = inject("voronoiHover");
const voronoiOrder = inject("voronoiOrder", null);
const voronoiZoomMode = inject("voronoiZoomMode", null);
const voronoiGesture  = inject("voronoiGesture", null);
const effectiveOrder = computed(() => props.order ?? voronoiOrder?.value);

const core = createVoronoiHoverLayer({
  onHover:              (e)    => emit("hover", e),
  onClick:              (d)    => emit("click", d),
  onVoronoiHoverChange: (cell) => { voronoiHover.value = cell; },
});

const getProps = () => ({ ...props, recomputeOnZoom: voronoiZoomMode?.value ?? false });

watch(draw,        (payload) => { if (payload) core.render(payload, getProps(), voronoiDraw.value); }, { immediate: true });
watch(zoom,        (t)       => { if (t) core.onZoom(t); });
watch(voronoiDraw, (state)   => core.rerender(getProps(), state));
// Live-gesture delta (option B): ride the transform instead of recomputing.
watch(() => voronoiGesture?.value, (d) => core.applyGestureTransform?.(d));

watch(() => props.ghostRadius, () => core.rerender(getProps(), voronoiDraw.value));

watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(effectiveOrder,      (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
