<template>
  <button
    @click="downloadImage"
    title="Download image"
    class="flex items-center justify-center relative"
    :class="[btnClass, { 'ot-btn-disabled': disabled }]"
    :disabled="disabled || loading"
  >
    <div
      v-if="loading"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div
        class="animate-spin rounded-full border-r-transparent h-5 w-5 border-current border"
        role="status"
      >
        <span class="sr-only">Loading...</span>
      </div>
    </div>
    <slot v-else><PhotoIcon class="w-5 h-5" /></slot>
  </button>
</template>

<script setup>
import { ref, toRefs } from "vue";
import { snapdom } from "@zumer/snapdom";
import { PhotoIcon } from "@heroicons/vue/24/outline";

const props = defineProps({
  elementId: {
    type: String,
    default: "image", // id of element to download
  },
  filename: {
    type: String,
    default: "image",
  },
  btnClass: {
    type: String,
    default:
      "w-10 h-10 text-gray-600 border bg-gray-100 rounded-lg hover:bg-gray-200 hover:border-gray-500 hover:text-gray-800",
  },
  format: {
    type: String,
    default: "png", //or svg
  },
  width: {
    type: Number,
    default: null, // fixed width of downloaded image
  },
  disabled: {
    type: Boolean,
    default: false, // disable button
  },
  bgColor: {
    type: String,
    default: "#fff",
  },
});

const { elementId, filename, format, width, bgColor } = toRefs(props);

const loading = ref(false);

const downloadImage = async () => {
  loading.value = true;

  const el = elementId.value ? document.getElementById(elementId.value) : null;

  if (el) {
    requestAnimationFrame(() => {
      setTimeout(async () => {
        // see https://github.com/zumerlab/snapdom for more options
        await snapdom.download(el, {
          format: format.value,
          filename: filename.value,
          embedFonts: true,
          width: width.value,
          backgroundColor: bgColor.value,
          // exclude elements with class image-hidden
          filter: (node) => !node.classList.contains("image-hidden"),
          scale: 2,
        });

        loading.value = false;
      }, 0);
    });
  }
};
</script>

<style scoped></style>
