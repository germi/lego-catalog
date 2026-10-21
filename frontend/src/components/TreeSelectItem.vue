<template>
  <li>
    <div
      class="flex items-center rounded px-1 py-2 hover:bg-gray-100"
      :class="{
        'ml-4 pl-3': !data.children,
        'bg-gray-100': data.id === highlightedId,
      }"
    >
      <button
        v-if="data.children && data.children.length > 0"
        @click="isOpen = !isOpen"
        class="mr-1"
      >
        <ChevronRightIcon
          class="h-5 w-5 transition"
          :class="{ 'rotate-90': isOpen }"
        />
      </button>
      <div v-else class="w-6"></div>

      <template
        v-if="leafOnly && data.children?.length > 0 && !strictCheckMode"
      >
        <span class="ml-2 flex items-center">
          <span
            class="inline-block h-2 w-2 rounded-full"
            :class="{
              'bg-blue-600': indeterminate || checked,
              'bg-gray-300': !indeterminate && !checked,
            }"
          ></span>
          <span
            class="ml-2"
            :class="{ 'font-medium text-blue-600': indeterminate || checked }"
          >
            <HighlightString :phrase="data.name" :highlight="search" />
          </span>
        </span>
      </template>

      <template v-else-if="!data.children || data.children.length === 0">
        <input
          class="text-primary focus:ring-primary"
          :id="data.id"
          type="checkbox"
          :checked="checked"
          :disabled="preventDeselect && checked"
          @change="handleChange"
          @keydown.enter="(e) => handleChange(e)"
        />
        <label
          :for="data.id"
          class="ml-2 cursor-pointer"
          :class="{ 'font-semibold': checked }"
        >
          <HighlightString :phrase="data.name" :highlight="search" />
        </label>
      </template>

      <template v-else-if="leafOnly && data.children">
        <span class="ml-2">
          <HighlightString :phrase="data.name" :highlight="search" />
        </span>
      </template>

      <template v-else>
        <input
          class="text-primary focus:ring-primary"
          :disabled="preventDeselect && checked"
          :id="data.id"
          type="checkbox"
          :checked="checked"
          :indeterminate="indeterminate"
          @change="handleChange"
          @keydown.enter="handleChange"
        />
        <label
          :for="data.id"
          class="ml-2 cursor-pointer"
          :class="{ 'font-semibold': checked }"
        >
          <HighlightString :phrase="data.name" :highlight="search" />
        </label>
      </template>
    </div>

    <ul v-if="isOpen" class="list-none">
      <TreeSelectItem
        v-for="child in data.children"
        :key="child.id"
        :data="child"
        :value="value"
        :highlighted-id="highlightedId"
        :search="search"
        :leaf-only="leafOnly"
        :depth="depth + 1"
        :only-show-check-if-element-is-present="onlyShowCheckIfElementIsPresent"
        :force-single="forceSingle"
        @input="$emit('input', $event)"
        class="ml-4"
      />
    </ul>
  </li>
</template>

<script setup>
import { ref, computed, toRefs, onMounted, watch } from "vue";
import { ChevronRightIcon } from "@heroicons/vue/20/solid";
import TreeSelectItem from "../components/TreeSelectItem.vue";
import HighlightString from "../components/HighlightString.vue";

const props = defineProps({
  data: {
    type: Object,
    default: () => ({
      id: "a",
      name: "a",
      children: [
        { id: "aa", name: "aa" },
        { id: "ab", name: "ab" },
      ],
    }),
  },
  value: {
    type: Array,
    default: () => [],
  },
  highlightedId: {
    type: [Number, String],
    default: null,
  },
  search: {
    type: String,
    default: "",
  },
  leafOnly: {
    type: Boolean,
    default: false,
  },
  depth: {
    type: Number,
    default: 0,
  },
  preventDeselect: {
    type: Boolean,
    default: false,
  },
  onlyShowCheckIfElementIsPresent: {
    type: Boolean,
    default: false,
  },
  forceSingle: {
    type: Boolean,
    default: false,
  },
});

const emits = defineEmits(["input"]);

const {
  data,
  value,
  search,
  preventDeselect,
  onlyShowCheckIfElementIsPresent,
  forceSingle,
} = toRefs(props);

const isOpen = ref(false);

function containsSearch(node) {
  if (node.name.toLowerCase().includes(search.value.toLowerCase())) return true;
  if (node.children) {
    for (const child of node.children) {
      if (containsSearch(child)) return true;
    }
  }
  return false;
}

function setForceOpen() {
  if (!search.value) {
    isOpen.value = false;
    return;
  }

  isOpen.value = false;
  for (const child of data.value.children || []) {
    if (containsSearch(child)) {
      isOpen.value = true;
      break;
    }
  }
}

onMounted(setForceOpen);
watch(search, setForceOpen);

const currentNodeId = computed(() => (data.value?.id ?? "") + "");

const leafIds = computed(() => {
  const collectedLeafIds = [];

  function traverse(node) {
    if (!node.children || node.children.length === 0) {
      collectedLeafIds.push((node.id ?? "") + "");
      return;
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(data.value);
  return collectedLeafIds;
});

const strictCheckMode = computed(() => {
  return onlyShowCheckIfElementIsPresent.value || forceSingle.value;
});

const checked = computed(() => {
  if (strictCheckMode.value) {
    return value.value.includes(currentNodeId.value);
  }

  if (!data.value.children) {
    return value.value.includes(currentNodeId.value);
  }

  return leafIds.value.every((leafId) => value.value.includes(leafId));
});

const indeterminate = computed(() => {
  if (strictCheckMode.value) return false;
  if (checked.value || !data.value.children) return false;
  return leafIds.value.some((leafId) => value.value.includes(leafId));
});

const handleChange = (event) => {
  if (preventDeselect.value && checked.value) return;
  emits("input", {
    data: { ...data.value, id: currentNodeId.value },
    checked: event.target.checked,
  });
};
</script>
