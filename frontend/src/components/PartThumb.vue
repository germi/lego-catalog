<template>
  <div
    class="flex items-center justify-center overflow-hidden rounded bg-white"
    :class="sizeClass"
  >
    <img
      v-if="src && !failed"
      :src="src"
      :alt="part.name"
      loading="lazy"
      class="h-full w-full object-contain"
      @error="failed = true"
    />
    <!-- No drawing for this part: the catalogue number is the next most useful thing. -->
    <span v-else class="font-mono text-sm text-gray-400">{{
      part.number
    }}</span>
  </div>
</template>

<script setup>
import mediaUrl from "@/utils/mediaUrl";

const props = defineProps({
  part: { type: Object, required: true },
  sizeClass: { type: String, default: "aspect-4/3" },
});

const failed = ref(false);
const src = computed(() => mediaUrl(props.part.imageUrl));

// A different part may be rendered into the same component instance.
watch(src, () => (failed.value = false));
</script>
