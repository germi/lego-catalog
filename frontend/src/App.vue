<template>
  <div id="content" class="min-h-screen">
    <div class="sticky top-0 z-30 bg-white shadow">
      <div class="w-full">
        <NavBar class="z-50" />
      </div>
    </div>

    <RouterView class="z-30 pt-8 pb-24" />

    <div v-if="isDev" class="fixed right-2 bottom-2">
      <RouterLink
        v-if="route.query.mode === 'edit'"
        class="ot-btn border-2 border-black bg-orange-300 hover:bg-orange-500"
        :to="{ query: { ...route.query, mode: null } }"
        >Exit edit mode</RouterLink
      >
      <RouterLink
        v-else
        class="ot-btn border-2 border-black bg-orange-300 hover:bg-orange-500"
        :to="{ query: { ...route.query, mode: 'edit' } }"
        >Enter edit mode</RouterLink
      >
    </div>
  </div>
</template>

<script setup>
import NavBar from "@/components/NavBar.vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
const isDev = import.meta.env.DEV;

const route = useRoute();

const { t } = useI18n();

// Labels come from src/locales/*.json. Uncomment useLoadLabels() (and restore its
// import) only if they ever need to come from a backend — see docs/LANGUAGE-SYSTEM.md.

useHead({
  titleTemplate: (title) => (title ? `${title} - ${t("TITLE")}` : t("TITLE")),
});
</script>
