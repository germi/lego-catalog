<template>
  <!--
    RoseCanvas = BaseCanvas (skipProjection) + polar coordinate center group.
    Owns ONLY layout geometry: centered <g>, radius, angles, duration, highlight state.
    Data, max, and scale live in each layer — presets compute shared max and pass it down.
  -->
  <BaseCanvas
    ref="canvas"
    :skip-projection="true"
    :force-square="true"
    :allow-manual-zoom="false"
    :duration="duration"
    @draw="onCanvasDraw"
  >
    <slot name="before" />
    <slot />
  </BaseCanvas>
</template>

<script setup>
import { ref, shallowRef, computed, watch, provide, toRef } from "vue";
import BaseCanvas from "./canvas/BaseCanvas.vue";
import { createRoseCanvas, ROSE_CANVAS_DEFAULTS } from "../core/roseCanvas.js";

const props = defineProps({
  duration:    { type: Number,           default: ROSE_CANVAS_DEFAULTS.duration },
  highlighted: { type: [String, Number], default: ROSE_CANVAS_DEFAULTS.highlighted },
  margin:      { type: Number,           default: ROSE_CANVAS_DEFAULTS.margin },
  startAngle:  { type: Number,           default: ROSE_CANVAS_DEFAULTS.startAngle },
  endAngle:    { type: Number,           default: ROSE_CANVAS_DEFAULTS.endAngle },
  innerRadius: { type: Number,           default: ROSE_CANVAS_DEFAULTS.innerRadius },
  scaleType:   { type: String,           default: ROSE_CANVAS_DEFAULTS.scaleType },
});

const canvas   = ref(null);
const svgGroup = shallowRef(null);
const core     = createRoseCanvas();

provide("roseHighlighted", toRef(props, "highlighted"));

const radius = computed(() => {
  const w = canvas.value?.width  ?? 200;
  const h = canvas.value?.height ?? 200;
  return Math.min(w, h) / 2 - props.margin;
});

// Provided to all descendant layers. Contains layout geometry only —
// no data, no scale, no pie. Layers build those themselves.
// Getters keep values live so cores always read current state.
const roseControls = {
  get radius()      { return radius.value; },
  get duration()    { return props.duration; },
  get highlighted() { return props.highlighted; },
  get innerRadius() { return props.innerRadius; },
  get margin()      { return props.margin; },
  get startAngle()  { return props.startAngle; },
  get endAngle()    { return props.endAngle; },
  get scaleType()   { return props.scaleType; },
  get svgGroup()    { return svgGroup.value; },
  get svgEl()       { return canvas.value?.svgEl; },
};
provide("roseControls", roseControls);

function onCanvasDraw({ svgEl }) {
  if (!svgEl) return;
  const w = canvas.value?.width  ?? 200;
  const h = canvas.value?.height ?? 200;
  const g = core.onDraw({ svgEl, width: w, height: h });
  svgGroup.value = g;
}

// Trigger instant redraws on layout-affecting prop changes.
watch(
  [() => props.startAngle, () => props.endAngle, () => props.margin, () => props.innerRadius],
  () => canvas.value?.redraw(0),
);

defineExpose({
  width:  computed(() => canvas.value?.width),
  height: computed(() => canvas.value?.height),
  svgEl:  computed(() => canvas.value?.svgEl),
});
</script>
