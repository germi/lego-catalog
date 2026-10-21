<template>
  <main class="ot-container pb-16">
    <RouterLink
      :to="{ name: 'home' }"
      class="ot-ring mt-6 inline-block rounded text-sm text-gray-500 hover:text-gray-900"
    >
      <OTText value="PART.BACK" />
    </RouterLink>

    <LoadingSpinner v-if="loading" class="mt-16" />

    <p v-else-if="!part" class="mt-10 text-sm text-gray-500">
      <OTText value="PART.NOT_FOUND" />
    </p>

    <template v-else>
      <header class="mt-4">
        <p class="font-mono text-sm text-gray-500">{{ part.number }}</p>
        <h1 class="ot-title-1">{{ part.name }}</h1>
      </header>

      <!-- The shape's own facts. Everything here is true regardless of colour. -->
      <dl class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt class="ot-label"><OTText value="PART.CATEGORY" /></dt>
          <dd class="text-sm text-gray-900">
            {{ part.primaryCategory?.fullName || "—" }}
          </dd>
        </div>
        <div>
          <dt class="ot-label"><OTText value="PART.SIZE" /></dt>
          <dd class="text-sm text-gray-900">{{ part.studSize || "—" }}</dd>
        </div>
        <div>
          <dt class="ot-label"><OTText value="PART.MATERIAL" /></dt>
          <dd class="text-sm text-gray-900">{{ part.material }}</dd>
        </div>
        <div>
          <dt class="ot-label"><OTText value="PART.COLOR_COUNT" /></dt>
          <dd class="text-sm text-gray-900">{{ part.knownColorCount }}</dd>
        </div>
      </dl>

      <p v-if="otherNumbers.length" class="mt-4 text-sm text-gray-500">
        <OTText value="PART.ALSO_KNOWN_AS" />
        <span class="font-mono">{{ otherNumbers.join(", ") }}</span>
      </p>

      <!-- Related shapes: prints, mould variants, pairs. Flattened by the API,
           because PartRelationship points at Part on both sides. -->
      <section v-if="part.relatedParts?.length" class="mt-8">
        <h2 class="ot-title-3"><OTText value="PART.RELATED" /></h2>
        <ul class="mt-2 flex flex-wrap gap-2">
          <li
            v-for="rel in part.relatedParts.slice(0, 24)"
            :key="rel.number + rel.type"
          >
            <RouterLink
              :to="{ name: 'part', params: { number: rel.number } }"
              class="ot-ring inline-flex items-center gap-2 rounded border border-gray-200 px-2 py-1 text-xs hover:border-gray-400"
            >
              <span class="font-mono">{{ rel.number }}</span>
              <span class="text-gray-500">{{
                t(`PART.REL.${rel.type.toUpperCase()}`)
              }}</span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- The elements: this shape, one row per colour it was made in. This is the
           part/element distinction made visible. -->
      <section class="mt-10">
        <h2 class="ot-title-2"><OTText value="PART.ELEMENTS" /></h2>
        <p class="mt-1 text-sm text-gray-500">
          <OTText value="PART.ELEMENTS_HELP" />
        </p>

        <LoadingSpinner v-if="elementsLoading" class="mt-10" />

        <div v-else class="mt-4 space-y-6">
          <div v-for="group in elementsByFamily" :key="group.name">
            <h3 class="ot-label">{{ group.name }}</h3>
            <ul
              class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
            >
              <li
                v-for="element in group.elements"
                :key="element.id"
                class="flex items-center gap-3 rounded border border-gray-200 p-2"
              >
                <span
                  class="h-8 w-8 shrink-0 rounded border border-gray-300"
                  :style="{
                    backgroundColor: element.color.hex || 'transparent',
                  }"
                />
                <span class="min-w-0">
                  <span class="block truncate text-sm text-gray-900">{{
                    element.color.name
                  }}</span>
                  <span class="block font-mono text-xs text-gray-500">{{
                    element.primaryCode || "—"
                  }}</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<script setup>
import { useI18n } from "vue-i18n";

import useLoadData from "@/functions/useLoadData";

const { t } = useI18n();

const { data: part, loading } = useLoadData("getPart", null, true);

const otherNumbers = computed(() =>
  (part.value?.numbers || [])
    .map((n) => n.number)
    .filter((n) => n !== part.value?.number),
);

const partId = computed(() => (part.value ? { id: part.value.id } : null));
const {
  data: elements,
  loading: elementsLoading,
  loadData: loadElements,
} = useLoadData("getPartElements", [], true, partId, false, false);

// The elements can only be fetched once the part's id is known.
watch(partId, (value) => value && loadElements(), { immediate: true });

/** Grouped by colour family, which is how a colour list is worth reading. */
const elementsByFamily = computed(() => {
  const groups = new Map();
  for (const element of elements.value) {
    const name = element.color.family?.name || t("PARTS.NO_FAMILY");
    if (!groups.has(name)) groups.set(name, { name, elements: [] });
    groups.get(name).elements.push(element);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
});
</script>
