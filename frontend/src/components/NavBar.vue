<template>
  <nav class="ot-container flex h-16 items-center justify-between">
    <RouterLink
      :to="{ name: 'home' }"
      class="ot-ring flex items-center gap-2 rounded"
    >
      <TagIcon class="text-primary-600 h-6 w-6" />
      <span class="text-base font-semibold tracking-tight text-gray-900"
        ><OTText value="NAV.BRAND"
      /></span>
    </RouterLink>

    <RouterSwitch
      :options="sections"
      :active="activeSection"
      inner-container-class="rounded-full bg-gray-100 p-1"
    />

    <div class="flex items-center gap-2">
      <a
        :href="apiDocs"
        target="_blank"
        rel="noopener noreferrer"
        class="ot-ring hidden rounded px-2 py-1 text-sm text-gray-500 hover:text-gray-900 sm:block"
      >
        <OTText value="NAV.API" />
      </a>
      <slot name="actions" />
    </div>
  </nav>
</template>

<script setup>
import { TagIcon } from "@heroicons/vue/24/solid";
import { useRoute } from "vue-router";

const route = useRoute();

const sections = [
  { id: "parts", name: "NAV.PARTS", to: { name: "home" } },
  { id: "sets", name: "NAV.SETS", to: { name: "sets" } },
];

// A part or set detail page still belongs to its section.
const activeSection = computed(() =>
  ["sets", "set"].includes(route.name) ? "sets" : "parts",
);

const apiDocs = `${(import.meta.env.VITE_API_URL || "/").replace(/\/$/, "")}/api/docs`;
</script>
