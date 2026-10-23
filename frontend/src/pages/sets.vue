<template>
  <main class="ot-container pb-16">
    <header class="pt-6">
      <h1 class="ot-title-1"><OTText value="SETS.TITLE" /></h1>
      <p class="mt-1 text-sm text-gray-500"><OTText value="SETS.SUBTITLE" /></p>
    </header>

    <section class="mt-6 flex flex-wrap items-end gap-3">
      <label class="min-w-56 flex-1">
        <span class="ot-label"><OTText value="SETS.SEARCH" /></span>
        <input
          v-model="search"
          type="search"
          class="ot-input w-full"
          :placeholder="t('SETS.SEARCH_PLACEHOLDER')"
          @keyup.enter="applySearch"
          @search="applySearch"
        />
      </label>

      <label class="min-w-52">
        <span class="ot-label"><OTText value="SETS.THEME" /></span>
        <select v-model="theme" class="ot-input w-full">
          <option :value="null">{{ t("SETS.ALL_THEMES") }}</option>
          <option v-for="th in rootThemes" :key="th.id" :value="String(th.id)">
            {{ th.name }}
          </option>
        </select>
      </label>

      <label class="w-28">
        <span class="ot-label"><OTText value="SETS.YEAR_FROM" /></span>
        <input
          v-model="yearFrom"
          type="number"
          class="ot-input w-full"
          placeholder="1949"
        />
      </label>

      <label class="w-28">
        <span class="ot-label"><OTText value="SETS.YEAR_TO" /></span>
        <input
          v-model="yearTo"
          type="number"
          class="ot-input w-full"
          placeholder="2026"
        />
      </label>

      <button
        v-if="hasFilters"
        class="ot-btn pb-2 text-sm text-gray-500 hover:text-gray-900"
        @click="clearFilters"
      >
        <OTText value="SETS.CLEAR" />
      </button>
    </section>

    <LoadingSpinner v-if="loading" class="mt-16" />
    <p v-else-if="error" class="mt-10 text-sm text-red-600">
      <OTText value="ERRORS.LOAD" />
    </p>
    <p v-else-if="!sets.length" class="mt-10 text-sm text-gray-500">
      <OTText value="SETS.EMPTY" />
    </p>

    <ul
      v-else
      class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      <li v-for="set in sets" :key="set.id">
        <RouterLink
          :to="{ name: 'set', params: { number: set.number } }"
          class="ot-ring block rounded-lg border border-gray-200 bg-white p-3 transition hover:border-gray-400"
        >
          <div
            class="flex aspect-4/3 items-center justify-center overflow-hidden rounded bg-gray-50"
          >
            <img
              v-if="set.imageUrl"
              :src="set.imageUrl"
              :alt="set.name"
              loading="lazy"
              class="h-full w-full object-contain"
            />
            <span v-else class="font-mono text-sm text-gray-400">{{
              set.number
            }}</span>
          </div>
          <p class="mt-2 font-mono text-xs text-gray-500">{{ set.number }}</p>
          <p class="line-clamp-2 text-sm font-medium text-gray-900">
            {{ set.name }}
          </p>
          <p
            class="mt-1 flex items-center justify-between text-xs text-gray-500"
          >
            <span>{{ set.year || "—" }}</span>
            <span>
              <OTText
                value="SETS.PIECES"
                :options="{ count: set.boxPieceCount }"
              />
            </span>
          </p>
        </RouterLink>
      </li>
    </ul>

    <div v-if="sets.length" class="mt-8 flex items-center justify-between">
      <button
        class="ot-btn text-sm disabled:opacity-40"
        :disabled="page <= 1"
        @click="page = page - 1"
      >
        <OTText value="PARTS.PREV" />
      </button>
      <span class="text-sm text-gray-500"
        ><OTText value="PARTS.PAGE" :options="{ page }"
      /></span>
      <button
        class="ot-btn text-sm disabled:opacity-40"
        :disabled="sets.length < 48"
        @click="page = page + 1"
      >
        <OTText value="PARTS.NEXT" />
      </button>
    </div>
  </main>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

import useLoadData from "@/functions/useLoadData";
import { useSingleRouteFilter } from "@/functions/useFilters";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const theme = useSingleRouteFilter("theme");
const page = useSingleRouteFilter("page", ref(1), "number");

const search = ref(route.query.q || "");
const applySearch = () =>
  router.push({
    name: "sets",
    query: { ...route.query, q: search.value || undefined, page: undefined },
  });

/** Year inputs write to the URL only once they hold a plausible year. */
function yearFilter(name) {
  return computed({
    get: () => route.query[name] || "",
    set: (value) => {
      const year = Number.parseInt(value, 10);
      router.push({
        name: "sets",
        query: {
          ...route.query,
          [name]:
            Number.isInteger(year) && year > 1900 ? String(year) : undefined,
          page: undefined,
        },
      });
    },
  });
}
const yearFrom = yearFilter("yearFrom");
const yearTo = yearFilter("yearTo");

const hasFilters = computed(
  () =>
    !!(
      route.query.q ||
      route.query.theme ||
      route.query.yearFrom ||
      route.query.yearTo
    ),
);
const clearFilters = () => {
  search.value = "";
  router.push({ name: "sets", query: {} });
};

const filterKey = computed(() =>
  JSON.stringify([
    route.query.q,
    route.query.theme,
    route.query.yearFrom,
    route.query.yearTo,
    route.query.page,
  ]),
);

const {
  data: sets,
  loading,
  error,
} = useLoadData("getSets", [], false, ref(null), true, true, filterKey);

const { data: themes } = useLoadData(
  "getThemes",
  [],
  false,
  ref({}),
  true,
  false,
);

// Only top-level themes in the filter: 496 themes nested three deep is not a dropdown.
const rootThemes = computed(() =>
  themes.value
    .filter((th) => th.depth === 0)
    .sort((a, b) => a.name.localeCompare(b.name)),
);
</script>
