<template>
  <div class="ot-container">
    <h1 class="ot-title-1 mb-6">Language Editor</h1>

    <!-- Search -->
    <div class="relative mb-6">
      <MagnifyingGlassIcon
        class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
      />
      <input
        v-model="search"
        type="text"
        placeholder="Search by key or translation..."
        class="focus:border-primary-500 focus:ring-primary-500 w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1"
      />
    </div>

    <!-- Locale tabs + controls -->
    <div class="mb-4 flex items-center justify-between border-b border-gray-200">
      <div class="flex gap-1">
        <button
          v-for="loc in availableLocales"
          :key="loc"
          class="-mb-px px-4 py-2 text-sm font-medium uppercase"
          :class="
            viewLocale === loc
              ? 'border-primary-700 text-primary-700 border-b-2'
              : 'text-gray-400 hover:text-gray-600'
          "
          @click="localeFilter = loc === locale ? null : loc"
        >
          {{ loc }}
        </button>
      </div>
      <div class="mb-1 flex items-center gap-4">
        <OTToggle v-model="expandAll" small label-position="start">
          <span class="text-xs text-gray-500">Expand all</span>
        </OTToggle>
        <button
          class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          @click="downloadCsv"
        >
          <ArrowDownTrayIcon class="h-4 w-4" />
          Download CSV
        </button>
      </div>
    </div>

    <!-- Labels tree -->
    <div
      v-if="filteredTree.length === 0"
      class="py-12 text-center text-gray-400"
    >
      No labels found.
    </div>

    <LabelTreeItem
      v-else
      :nodes="filteredTree"
      :expanded="expanded"
      @toggle="toggleNode"
      @edit="openEdit"
    />

    <!-- Edit Modal -->
    <LabelEditModal v-model:is-open="modalOpen" :label-key="editingKey" :default-locale="viewLocale" show-editor-toggle />
  </div>
</template>

<script setup>
import {
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
} from "@heroicons/vue/24/outline";
import { useI18n } from "vue-i18n";
import { jsonToCsv } from "@/utils/csvJsonUtils";
import { useSingleRouteFilter } from "@/functions/useFilters";

const i18n = useI18n();
const locale = computed(() => i18n.locale.value);
const availableLocales = computed(() => i18n.availableLocales);

const search = ref("");
const localeFilter = useSingleRouteFilter("locale");
const viewLocale = computed(() => localeFilter.value || locale.value);
const modalOpen = ref(false);
const editingKey = ref("");
const expanded = ref(new Set());
const expandAll = ref(false);

// Build a tree from nested messages object
function buildTree(obj, prefix = "") {
  return Object.keys(obj).map((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      return { segment: key, path, value: null, children: buildTree(obj[key], path) };
    }
    return { segment: key, path, value: obj[key], children: [] };
  });
}

// Collect all branch paths (nodes with children) for expand-all
function collectBranchPaths(nodes) {
  const paths = [];
  for (const node of nodes) {
    if (node.children.length) {
      paths.push(node.path);
      paths.push(...collectBranchPaths(node.children));
    }
  }
  return paths;
}

const tree = computed(() => {
  const messages = i18n.messages.value[viewLocale.value];
  if (!messages) return [];
  return buildTree(messages);
});

// Filter tree to only branches containing matching leaves
function filterTree(nodes, query) {
  const q = query.toLowerCase();
  return nodes
    .map((node) => {
      if (node.children.length) {
        const filteredChildren = filterTree(node.children, query);
        if (filteredChildren.length) {
          return { ...node, children: filteredChildren };
        }
        return null;
      }
      // Leaf: match against path or value
      if (
        node.path.toLowerCase().includes(q) ||
        String(node.value).toLowerCase().includes(q)
      ) {
        return node;
      }
      return null;
    })
    .filter(Boolean);
}

const filteredTree = computed(() => {
  if (!search.value) return tree.value;
  return filterTree(tree.value, search.value);
});

// When searching, auto-expand all matching branches
watch(search, (q) => {
  if (q) {
    expanded.value = new Set(collectBranchPaths(filteredTree.value));
  }
});

// Expand/collapse all toggle
watch(expandAll, (val) => {
  if (val) {
    expanded.value = new Set(collectBranchPaths(filteredTree.value));
  } else {
    expanded.value = new Set();
  }
});

function toggleNode(path) {
  const next = new Set(expanded.value);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  expanded.value = next;
}

function openEdit(key) {
  editingKey.value = key;
  modalOpen.value = true;
}

function downloadCsv() {
  const messages = i18n.messages.value[viewLocale.value];
  if (!messages) return;
  const csv = jsonToCsv(messages);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${viewLocale.value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
</script>
