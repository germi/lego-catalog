<template>
  <RibbonChart v-bind="$attrs" :show-links="false">
    <slot />
  </RibbonChart>
</template>

<script setup>
import RibbonChart from "./RibbonChart.vue";

defineOptions({ inheritAttrs: false });
</script>
