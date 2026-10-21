<template>
  <svg
    ref="svgEl"
    xmlns="http://www.w3.org/2000/svg"
    width="100%"
    height="100%"
    style="display: block; overflow: hidden;"
  >
    <defs />
    <rect width="100%" height="100%" :fill="resolvedFill || 'transparent'" />
  </svg>
</template>

<script setup>
import { ref, watchEffect } from "vue";
import { resolveFill } from "../fill/resolveFill";

const props = defineProps({
  color: { default: null },
});

const svgEl = ref(null);
const resolvedFill = ref(null);

// Tracks both props.color and svgEl reactively.
// Runs once after mount (when svgEl goes null → element) and again on color changes.
watchEffect(() => {
  if (!svgEl.value) return;
  resolvedFill.value = resolveFill(props.color, svgEl.value);
});
</script>
