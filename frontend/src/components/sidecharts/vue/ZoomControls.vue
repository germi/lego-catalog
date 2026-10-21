<template>
  <div class="absolute flex items-center gap-1">
    <div
      class="flex overflow-hidden rounded-md border border-gray-200 shadow-sm"
    >
      <button
        class="flex h-7 w-7 items-center justify-center bg-white text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
        @click="chartRef?.zoomIn()"
      >
        <PlusIcon class="h-4 w-4" />
      </button>

      <button
        class="flex h-7 w-7 items-center justify-center border-l border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50 active:bg-gray-100"
        @click="chartRef?.zoomOut()"
      >
        <MinusIcon class="h-4 w-4" />
      </button>
    </div>
    <button
      class="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:bg-gray-50 active:bg-gray-100"
      @click="recenter"
    >
      <ArrowsPointingOutIcon class="h-4 w-4" />
    </button>
  </div>
</template>

<script setup>
import {
  PlusIcon,
  MinusIcon,
  ArrowsPointingOutIcon,
} from "@heroicons/vue/24/outline";

const props = defineProps({
  chartRef: {
    type: Object,
    default: null,
  },
  recenterMethod: {
    type: String,
    default: "resetZoom",
  },
});

function recenter() {
  props.chartRef?.[props.recenterMethod]?.();
}
</script>
