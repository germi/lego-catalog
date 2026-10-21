<template>
  <div>
    <template v-for="node in nodes" :key="node.path">
      <!-- Branch node (has children) -->
      <button
        v-if="node.children.length"
        class="flex w-full items-center gap-2 px-2 py-2 text-left text-sm transition-colors hover:bg-gray-50"
        :style="{ paddingLeft: `${depth * 20 + 8}px` }"
        @click="$emit('toggle', node.path)"
      >
        <ChevronRightIcon
          class="h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150"
          :class="{ 'rotate-90': expanded.has(node.path) }"
        />
        <span class="font-medium text-gray-600">{{ node.segment }}</span>
        <span class="text-xs text-gray-300">{{ countLeaves(node) }}</span>
      </button>

      <!-- Leaf node (has value) -->
      <button
        v-else
        class="flex w-full items-center gap-4 py-2.5 pr-2 text-left transition-colors hover:bg-gray-50"
        :style="{ paddingLeft: `${depth * 20 + 8}px` }"
        @click="$emit('edit', node.path)"
      >
        <span
          class="mt-0.5 shrink-0 rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500"
        >
          {{ node.path }}
        </span>
        <span class="min-w-0 flex-1 truncate text-sm text-gray-800">
          {{ node.value || "—" }}
        </span>
        <PencilSquareIcon class="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
      </button>

      <!-- Recursive children -->
      <div v-if="node.children.length && expanded.has(node.path)">
        <LabelTreeItem
          :nodes="node.children"
          :expanded="expanded"
          :depth="depth + 1"
          @toggle="$emit('toggle', $event)"
          @edit="$emit('edit', $event)"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { ChevronRightIcon, PencilSquareIcon } from "@heroicons/vue/24/outline";

defineProps({
  nodes: {
    type: Array,
    required: true,
  },
  expanded: {
    type: Set,
    required: true,
  },
  depth: {
    type: Number,
    default: 0,
  },
});

defineEmits(["toggle", "edit"]);

function countLeaves(node) {
  if (!node.children.length) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}
</script>
