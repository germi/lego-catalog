<template>
  <div
    class="flex items-center justify-between border-t border-gray-200 bg-white"
  >
    <!-- for mobile -->
    <div class="flex flex-1 justify-between sm:hidden">
      <button
        class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        :class="[
          currentPage === 1 ? 'page-btn-disabled' : 'page-btn-clickable',
        ]"
        :disabled="currentPage === 1"
        @click="$emit('changePage', currentPage - 1)"
      >
        <OTText value="PAGINATION.PREVIOUS" />
      </button>
      <button
        class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        :class="[
          currentPage === totalPages
            ? 'page-btn-disabled'
            : 'page-btn-clickable',
        ]"
        :disabled="currentPage === totalPages"
        @click="$emit('changePage', currentPage + 1)"
      >
        <OTText value="PAGINATION.NEXT" />
      </button>
    </div>

    <!-- number of results -->
    <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
      <div>
        <p class="text-sm text-gray-700">
          {{
            $t("PAGINATION.RANGE", {
              start: number(currentIndexes[0], 0),
              end: number(currentIndexes[1], 0),
              total: number(totalItems, 0),
            })
          }}
        </p>
      </div>

      <!-- nav -->
      <div>
        <nav
          class="relative z-0 inline-flex -space-x-px rounded-md shadow-sm"
          aria-label="Pagination"
        >
          <button
            class="relative inline-flex cursor-pointer items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
            :class="[
              currentPage === 1 ? 'page-btn-disabled' : 'page-btn-clickable',
            ]"
            :disabled="currentPage === 1"
            @click="$emit('changePage', currentPage - 1)"
          >
            <span class="sr-only">{{ $t("PAGINATION.PREVIOUS") }}</span>
            <ChevronLeftIcon class="h-5 w-5" aria-hidden="true" />
          </button>
          <!-- Current: "z-10 bg-indigo-50 border-indigo-500 text-indigo-600", Default: "bg-white border-gray-300 text-gray-500 hover:bg-gray-50" -->
          <button
            aria-current="page"
            class="page-btn"
            :class="[
              currentPage === 1
                ? currentPageClass
                : 'page-btn-default page-btn-clickable',
            ]"
            @click="$emit('changePage', 1)"
          >
            1
          </button>
          <span
            class="page-btn page-btn-default"
            v-show="totalPages > 5 && currentPage >= 4"
          >
            ...
          </span>
          <button
            v-for="page in displayedPages"
            :key="page"
            class="page-btn"
            :class="[
              currentPage === page
                ? currentPageClass
                : 'page-btn-default page-btn-clickable',
            ]"
            :disabled="currentPage === page"
            @click="$emit('changePage', page)"
          >
            {{ page }}
          </button>
          <span
            class="page-btn page-btn-default"
            v-show="totalPages > 5 && currentPage <= totalPages - 3"
          >
            ...
          </span>
          <button
            v-show="totalPages > 1"
            class="page-btn"
            :class="[
              currentPage === totalPages
                ? currentPageClass
                : 'page-btn-default page-btn-clickable',
            ]"
            @click="$emit('changePage', totalPages)"
          >
            {{ totalPages }}
          </button>
          <button
            class="relative inline-flex cursor-pointer items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
            :class="[
              currentPage === totalPages
                ? 'page-btn-disabled'
                : 'page-btn-clickable',
            ]"
            :disabled="currentPage === totalPages"
            @click="$emit('changePage', currentPage + 1)"
          >
            <span class="sr-only">{{ $t("PAGINATION.NEXT") }}</span>
            <ChevronRightIcon class="h-5 w-5" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/vue/24/solid";

import { toRefs, computed } from "vue";

import { number } from "@/utils/helpers";

const props = defineProps({
  currentPage: {
    type: Number,
    default: 1,
  },
  totalItems: {
    type: Number,
    default: 100,
  },
  itemsPerPage: {
    type: Number,
    default: 10,
  },
  currentPageClass: {
    type: String,
    default: "page-btn-current",
  },
});

const emit = defineEmits(["changePage"]);

const { totalItems, itemsPerPage, currentPage } = toRefs(props);

const totalPages = computed(() => {
  return Math.ceil(totalItems.value / itemsPerPage.value);
});

// page numbers to display in between first and last
const displayedPages = computed(() => {
  let pages = [];

  if (totalPages.value > 5) {
    // show pages 2 - 4
    if (currentPage.value < 4) {
      pages = [2, 3, 4];
      // show 3 before last pages
    } else if (currentPage.value > totalPages.value - 3) {
      pages = [
        totalPages.value - 3,
        totalPages.value - 2,
        totalPages.value - 1,
      ];
      // show pages surrounding current page
    } else {
      pages = [currentPage.value - 1, currentPage.value, currentPage.value + 1];
    }
  } else {
    // add pages in between first and last page
    // start at 2
    for (let i = 2; i < totalPages.value; i++) {
      pages.push(i);
    }
  }

  return pages;
});

// indexes of items currently displayed
const currentIndexes = computed(() => {
  const last = currentPage.value * itemsPerPage.value;
  const first = last - itemsPerPage.value + 1;

  return [first, last > totalItems.value ? totalItems.value : last];
});
</script>

<style scoped>
@reference "../tailwind.css";

.page-btn {
  @apply relative inline-flex items-center border px-4 py-2 text-sm font-medium;
}

.page-btn-default {
  @apply border-gray-300 bg-white text-gray-500;
}

.page-btn-clickable {
  @apply cursor-pointer hover:bg-gray-50;
}

.page-btn-current {
  @apply z-10 cursor-default border-gray-800 bg-gray-100 text-gray-800;
}

.page-btn-disabled {
  @apply pointer-events-none cursor-not-allowed opacity-50;
}
</style>
