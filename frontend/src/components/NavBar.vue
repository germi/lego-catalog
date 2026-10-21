<template>
  <nav class="ot-container flex h-16 items-center justify-between">
    <RouterLink :to="{ name: 'home' }" class="ot-ring flex items-center gap-2 rounded">
      <TagIcon class="h-6 w-6 text-primary-600" />
      <span class="text-base font-semibold tracking-tight text-gray-900"><OTText value="NAV.BRAND" /></span>
    </RouterLink>

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

const apiDocs = `${(import.meta.env.VITE_API_URL || "/").replace(/\/$/, "")}/api/docs`;
</script>
