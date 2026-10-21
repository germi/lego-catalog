<template>
  <slot />
</template>

<script setup>
import { shallowRef, provide, inject, watch, onBeforeUnmount } from "vue";
import {
  createCartesianMaskLayer,
  CARTESIAN_MASK_DEFAULTS as D,
} from "../../core/cartesianMaskLayer.js";

const props = defineProps({
  // Reveal window: data-space x values (null = no constraint on that edge).
  revealStart:    { type: [Number, Object], default: () => D.revealStart },
  revealEnd:      { type: [Number, Object], default: () => D.revealEnd },
  revealDuration: { type: Number,           default: D.revealDuration },
  revealEase:     { type: String,           default: D.revealEase },
  // Optional explicit margin/padding override (inherits from chartContext
  // when not set, matching the behaviour of AreaLayer / LineLayer).
  margin:  { type: Object, default: null },
  padding: { type: Object, default: null },
  // Box-clip mode — also clip top/bottom to the plot area (see core defaults).
  clipToPlot: { type: Boolean, default: D.clipToPlot },
  // Pointer-events on the mask container — "auto" makes clipped children hit
  // targets (e.g. scatter dots); "none" (default) passes through (reveal/labels).
  pointerEvents: { type: String, default: D.pointerEvents },
  order:   { type: Number, default: undefined },
});

const draw  = inject("draw");
const zoom  = inject("zoom", null);
const liveTransform = inject("liveTransform", null);

// If this MaskLayer is nested inside another MaskLayer (or geo MaskLayer),
// the outer container is passed via layerContainer.
const outerLayerContainer = inject("layerContainer", null);

// Layout inheritance from the host chart (same pattern as AreaLayer / LineLayer).
const chartContext = inject("chartContext", null);

const core = createCartesianMaskLayer();

// Provide our container <g> as the layerContainer for child layers.
const containerRef = shallowRef(null);
provide("layerContainer", containerRef);

const getProps = () => {
  const ctx = chartContext?.value ?? {};
  return {
    ...props,
    outerLayerContainer,
    margin:  props.margin  ?? ctx.margin  ?? null,
    padding: props.padding ?? ctx.padding ?? null,
  };
};

// First-render zoom catch-up: overlay the `liveTransform` (kept current by
// BaseCanvas from both onZoom AND onDraw) onto the payload before rendering
// so a mask mounted mid-zoom lands at the current scale. See AreaLayer.vue
// for the full rationale.
let zoomCaughtUp = false;
watch(draw, (payload) => {
  if (!payload?.svgEl) return;
  let effective = payload;
  if (!zoomCaughtUp) {
    zoomCaughtUp = true;
    const live = liveTransform?.value;
    const pt = payload.zoomTransform;
    const alreadyCorrect = pt && live && pt.k === live.k && pt.x === live.x && pt.y === live.y;
    if (live && !alreadyCorrect && (live.k !== 1 || live.x !== 0 || live.y !== 0)) {
      effective = { ...payload, zoomTransform: live, xScale: undefined, yScale: undefined };
    }
  }
  core.render(effective, getProps());
  containerRef.value = core.getContainerNode();
}, { immediate: true });

watch(zoom, (t) => { if (t) core.onZoom(t); });

// An explicit reveal-window change (sliding the window, "advancing a line")
// animates at revealDuration/revealEase — independent of any zoom tempo, which
// is handled by core.render() following the draw signal instead.
watch(
  [
    () => props.revealStart,
    () => props.revealEnd,
    () => props.revealDuration,
    () => props.revealEase,
    () => props.margin,
    () => props.padding,
    () => props.clipToPlot,
  ],
  () => { if (draw.value) core.updateReveal(getProps()); },
  { deep: true },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
