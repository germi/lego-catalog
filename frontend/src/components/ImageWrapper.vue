<template>
  <div :id="id" :style="{ padding: `${margin}px`, margin: `-${margin}px` }">
    <slot></slot>
  </div>
</template>

<script setup>
const props = defineProps({
  id: {
    type: String,
    default: "image",
  },
  margin: {
    type: Number,
    default: 24,
  },
});
</script>

<style scoped></style>
