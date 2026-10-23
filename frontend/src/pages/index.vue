<template>
  <main class="ot-container pb-16">
    <header class="pt-6">
      <h1 class="ot-title-1"><OTText value="PARTS.TITLE" /></h1>
      <p class="mt-1 text-sm text-gray-500">
        <OTText value="PARTS.SUBTITLE" />
      </p>
    </header>

    <!-- Filters. Every one of them lives in the URL, so a filtered list is a
         link you can keep. -->
    <section class="mt-6 flex flex-wrap items-end gap-3">
      <label class="min-w-56 flex-1">
        <span class="ot-label"><OTText value="PARTS.SEARCH" /></span>
        <input
          v-model="search"
          type="search"
          class="ot-input w-full"
          :placeholder="t('PARTS.SEARCH_PLACEHOLDER')"
          @keyup.enter="applySearch"
          @search="applySearch"
        />
      </label>

      <label class="min-w-48">
        <span class="ot-label"><OTText value="PARTS.CATEGORY" /></span>
        <select v-model="category" class="ot-input w-full">
          <option :value="null">{{ t("PARTS.ALL_CATEGORIES") }}</option>
          <option v-for="c in categories" :key="c.id" :value="String(c.id)">
            {{ c.fullName }}
          </option>
        </select>
      </label>

      <label class="min-w-44">
        <span class="ot-label"><OTText value="PARTS.COLOR" /></span>
        <select v-model="color" class="ot-input w-full">
          <option :value="null">{{ t("PARTS.ANY_COLOR") }}</option>
          <optgroup
            v-for="group in colorsByFamily"
            :key="group.name"
            :label="group.name"
          >
            <option v-for="c in group.colors" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </optgroup>
        </select>
      </label>

      <label class="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          v-model="decorated"
          type="checkbox"
          class="rounded border-gray-300"
        />
        <OTText value="PARTS.DECORATED_ONLY" />
      </label>

      <button
        v-if="hasFilters"
        class="ot-btn pb-2 text-sm text-gray-500 hover:text-gray-900"
        @click="clearFilters"
      >
        <OTText value="PARTS.CLEAR" />
      </button>
    </section>

    <LoadingSpinner v-if="loading" class="mt-16" />

    <p v-else-if="error" class="mt-10 text-sm text-red-600">
      <OTText value="ERRORS.LOAD" />
    </p>

    <p v-else-if="!parts.length" class="mt-10 text-sm text-gray-500">
      <OTText value="PARTS.EMPTY" />
    </p>

    <ul
      v-else
      class="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5"
    >
      <li v-for="part in parts" :key="part.id">
        <RouterLink
          :to="{ name: 'part', params: { number: part.number } }"
          class="ot-ring block rounded-lg border border-gray-200 bg-white p-3 transition hover:border-gray-400"
        >
          <PartThumb :part="part" />
          <p class="mt-2 line-clamp-2 text-sm font-medium text-gray-900">
            {{ part.shortName || part.name }}
          </p>
          <p
            class="mt-1 flex items-center justify-between text-xs text-gray-500"
          >
            <span>{{ part.studSize || "—" }}</span>
            <span>
              <OTText
                value="PARTS.COLOR_COUNT"
                :options="{ count: part.knownColorCount }"
              />
            </span>
          </p>
        </RouterLink>
      </li>
    </ul>

    <div v-if="parts.length" class="mt-8 flex items-center justify-between">
      <button
        class="ot-btn text-sm disabled:opacity-40"
        :disabled="page <= 1"
        @click="page = page - 1"
      >
        <OTText value="PARTS.PREV" />
      </button>
      <span class="text-sm text-gray-500">
        <OTText value="PARTS.PAGE" :options="{ page }" />
      </span>
      <button
        class="ot-btn text-sm disabled:opacity-40"
        :disabled="parts.length < 60"
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

const category = useSingleRouteFilter("category");
const color = useSingleRouteFilter("color");
const page = useSingleRouteFilter("page", ref(1), "number");

// The search box is not bound straight to the URL: typing would push a history
// entry per keystroke and refetch on every one.
const search = ref(route.query.q || "");
const applySearch = () =>
  router.push({
    name: "home",
    query: { ...route.query, q: search.value || undefined, page: undefined },
  });

const decorated = computed({
  get: () => route.query.decorated === "true",
  set: (value) =>
    router.push({
      name: "home",
      query: {
        ...route.query,
        decorated: value ? "true" : undefined,
        page: undefined,
      },
    }),
});

const hasFilters = computed(
  () =>
    !!(
      route.query.q ||
      route.query.category ||
      route.query.color ||
      route.query.decorated
    ),
);
const clearFilters = () => {
  search.value = "";
  router.push({ name: "home", query: {} });
};

// Refetch whenever any filter in the URL changes, but not on unrelated query keys.
const filterKey = computed(() =>
  JSON.stringify([
    route.query.q,
    route.query.category,
    route.query.color,
    route.query.decorated,
    route.query.page,
  ]),
);

const {
  data: parts,
  loading,
  error,
} = useLoadData("getParts", [], false, ref(null), true, true, filterKey);

const { data: categories } = useLoadData(
  "getPartCategories",
  [],
  false,
  ref({}),
  true,
  false,
);
const { data: colors } = useLoadData(
  "getColors",
  [],
  false,
  ref({}),
  true,
  false,
);

/** Colours grouped by family, so the select mirrors how the catalogue reads. */
const colorsByFamily = computed(() => {
  const groups = new Map();
  for (const c of colors.value) {
    const name = c.family?.name || t("PARTS.NO_FAMILY");
    if (!groups.has(name)) groups.set(name, { name, colors: [] });
    groups.get(name).colors.push(c);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
});
</script>
