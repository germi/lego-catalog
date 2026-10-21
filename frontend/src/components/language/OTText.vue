<template>
  <span v-if="route.query.mode === 'edit'" class="relative inline-block">
    <button
      class="absolute inset-0 scale-105 rounded border border-orange-700 bg-orange-200 hover:bg-orange-300"
      @mouseover="hover = true"
      @mouseleave="hover = false"
      @click.stop.prevent="modalOpen = true"
    ></button>
    <span
      class="pointer-events-none absolute -left-px -top-5 flex items-center rounded border border-orange-700 bg-orange-200 p-px pr-2"
    >
      <PencilSquareIcon class="h-5 w-5 text-orange-700" />
      <span
        v-if="hover"
        class="w-20 text-xs font-normal lowercase leading-3 text-black"
        >Click to edit</span
      >
    </span>

    <span class="pointer-events-none relative"
      ><template v-if="markdown"
        ><OTMarkdown :value="$t(value, options)" :class="mdClass"
      /></template>
      <template v-else>{{ $t(value, options) }}</template></span
    >

    <LabelEditModal
      v-model:is-open="modalOpen"
      :label-key="value"
      :use-editor="markdown"
      :show-editor-toggle="markdown"
    />
  </span>
  <template v-else-if="markdown"
    ><OTMarkdown :value="$t(value, options)" :class="mdClass"
  /></template>
  <template v-else>{{ $t(value, options) }}</template>
</template>

<script setup>
import { PencilSquareIcon } from "@heroicons/vue/24/outline";
import { useRoute } from "vue-router";

const props = defineProps({
  value: String,
  options: Object,
  markdown: {
    type: Boolean,
    default: false,
  },
  mdClass: {
    type: String,
    default: "",
  },
});

const route = useRoute();

const hover = ref(false);
const modalOpen = ref(false);
</script>
