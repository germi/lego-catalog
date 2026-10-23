<template>
  <main class="ot-container pb-16">
    <RouterLink
      :to="{ name: 'sets' }"
      class="ot-ring mt-6 inline-block rounded text-sm text-gray-500 hover:text-gray-900"
    >
      <OTText value="SET.BACK" />
    </RouterLink>

    <LoadingSpinner v-if="loading" class="mt-16" />
    <p v-else-if="!set" class="mt-10 text-sm text-gray-500">
      <OTText value="SET.NOT_FOUND" />
    </p>

    <template v-else>
      <header class="mt-4 flex flex-wrap items-start gap-6">
        <img
          v-if="set.imageUrl"
          :src="set.imageUrl"
          :alt="set.name"
          class="h-40 w-56 shrink-0 rounded-lg border border-gray-200 object-contain"
        />
        <div>
          <p class="font-mono text-sm text-gray-500">{{ set.number }}</p>
          <h1 class="ot-title-1">{{ set.name }}</h1>
          <p class="mt-1 text-sm text-gray-500">
            {{ set.year || "—"
            }}<template v-if="set.theme"> · {{ set.theme.fullName }}</template>
          </p>
        </div>
      </header>

      <!-- Two piece counts, because the box and the inventory count different things. -->
      <dl class="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt class="ot-label"><OTText value="SET.BOX_COUNT" /></dt>
          <dd class="text-sm text-gray-900">{{ set.boxPieceCount }}</dd>
        </div>
        <div>
          <dt class="ot-label"><OTText value="SET.LOOSE_PARTS" /></dt>
          <dd class="text-sm text-gray-900">{{ set.numParts }}</dd>
        </div>
        <div>
          <dt class="ot-label"><OTText value="SET.MINIFIG_PARTS" /></dt>
          <dd class="text-sm text-gray-900">{{ set.numMinifigParts }}</dd>
        </div>
        <div>
          <dt class="ot-label"><OTText value="SET.SPARES" /></dt>
          <dd class="text-sm text-gray-900">{{ spareTotal }}</dd>
        </div>
      </dl>
      <p class="mt-2 text-xs text-gray-400">
        <OTText value="SET.COUNT_HELP" />
      </p>

      <section v-if="minifigs.length" class="mt-10">
        <h2 class="ot-title-2"><OTText value="SET.MINIFIGS" /></h2>
        <ul class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <li
            v-for="line in minifigs"
            :key="line.id"
            class="flex items-center gap-3 rounded border border-gray-200 p-2"
          >
            <img
              v-if="line.minifig.imageUrl"
              :src="line.minifig.imageUrl"
              :alt="line.minifig.name"
              loading="lazy"
              class="h-12 w-10 shrink-0 object-contain"
            />
            <span class="min-w-0">
              <span class="block truncate text-sm text-gray-900">{{
                line.minifig.name
              }}</span>
              <span class="font-mono text-xs text-gray-500">
                {{ line.minifig.number
                }}<template v-if="line.quantity > 1">
                  ×{{ line.quantity }}</template
                >
              </span>
            </span>
          </li>
        </ul>
      </section>

      <section v-if="subsets.length" class="mt-10">
        <h2 class="ot-title-2"><OTText value="SET.SUBSETS" /></h2>
        <ul class="mt-3 flex flex-wrap gap-2">
          <li v-for="line in subsets" :key="line.id">
            <RouterLink
              :to="{ name: 'set', params: { number: line.childSet.number } }"
              class="ot-ring inline-flex items-center gap-2 rounded border border-gray-200 px-2 py-1 text-xs hover:border-gray-400"
            >
              <span class="font-mono">{{ line.childSet.number }}</span>
              <span class="text-gray-500">{{ line.childSet.name }}</span>
              <span v-if="line.quantity > 1" class="text-gray-400"
                >×{{ line.quantity }}</span
              >
            </RouterLink>
          </li>
        </ul>
      </section>

      <section class="mt-10">
        <div class="flex flex-wrap items-baseline justify-between gap-3">
          <h2 class="ot-title-2"><OTText value="SET.INVENTORY" /></h2>
          <label class="flex items-center gap-2 text-sm text-gray-600">
            <input
              v-model="showSpares"
              type="checkbox"
              class="rounded border-gray-300"
            />
            <OTText value="SET.SHOW_SPARES" />
          </label>
        </div>

        <LoadingSpinner v-if="inventoryLoading" class="mt-10" />

        <template v-else>
          <p v-if="!visibleLines.length" class="mt-4 text-sm text-gray-500">
            <OTText value="SET.NO_INVENTORY" />
          </p>

          <ul
            v-else
            class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
          >
            <li
              v-for="line in visibleLines"
              :key="line.id"
              class="flex items-center gap-3 rounded border p-2"
              :class="
                line.role === 'spare'
                  ? 'border-dashed border-gray-300 bg-gray-50'
                  : 'border-gray-200'
              "
            >
              <span
                class="shrink-0 text-sm font-medium text-gray-900 tabular-nums"
                >{{ line.quantity }}×</span
              >
              <PartThumb
                :part="line.element.part"
                size-class="h-10 w-12 shrink-0"
              />
              <span
                class="h-6 w-6 shrink-0 rounded border border-gray-300"
                :style="{
                  backgroundColor: line.element.color.hex || 'transparent',
                }"
                :title="line.element.color.name"
              />
              <RouterLink
                :to="{
                  name: 'part',
                  params: { number: line.element.part.number },
                }"
                class="ot-ring min-w-0 rounded"
              >
                <span class="block truncate text-sm text-gray-900">{{
                  line.element.part.name
                }}</span>
                <span class="block truncate text-xs text-gray-500">
                  {{ line.element.color.name }}
                  <template v-if="line.role === 'spare'">
                    · <OTText value="SET.SPARE"
                  /></template>
                </span>
              </RouterLink>
            </li>
          </ul>
        </template>
      </section>
    </template>
  </main>
</template>

<script setup>
import useLoadData from "@/functions/useLoadData";

const { data: set, loading } = useLoadData("getSet", null, true);

const setId = computed(() => (set.value ? { id: set.value.id } : null));

const {
  data: inventory,
  loading: inventoryLoading,
  loadData: loadInventory,
} = useLoadData("getSetInventory", [], true, setId, false, false);

const { data: minifigs, loadData: loadMinifigs } = useLoadData(
  "getSetMinifigs",
  [],
  true,
  setId,
  false,
  false,
);

const { data: subsets, loadData: loadSubsets } = useLoadData(
  "getSetSubsets",
  [],
  true,
  setId,
  false,
  false,
);

// All three depend on the set's id, which only exists once the set itself has loaded.
watch(
  setId,
  (value) => {
    if (!value) return;
    loadInventory();
    loadMinifigs();
    loadSubsets();
  },
  { immediate: true },
);

const showSpares = ref(false);

const spareTotal = computed(() =>
  inventory.value
    .filter((line) => line.role === "spare")
    .reduce((total, line) => total + line.quantity, 0),
);

/**
 * Sorted by quantity descending: the pieces a set is mostly made of are the ones worth
 * seeing first. Spares are hidden by default — they are in the bag but not in the model.
 */
const visibleLines = computed(() =>
  inventory.value
    .filter((line) => showSpares.value || line.role !== "spare")
    .slice()
    .sort(
      (a, b) =>
        b.quantity - a.quantity ||
        a.element.part.name.localeCompare(b.element.part.name) ||
        a.element.color.name.localeCompare(b.element.color.name),
    ),
);
</script>
