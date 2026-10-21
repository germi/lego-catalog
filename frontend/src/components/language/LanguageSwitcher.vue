<template>
  <div class="flex items-center gap-1">
    <RouterLink
      v-for="lang in availableLanguages"
      :key="lang"
      :to="{
        name: route.name,
        params: { ...route.params, lang: lang },
        query: route.query,
      }"
      class="block border-s-4 py-2 pe-4 ps-3 text-base font-medium sm:inline-flex sm:border-s-0 sm:border-none sm:px-2 sm:py-0 sm:text-sm"
      :class="
        locale === lang
          ? 'border-primary-600 bg-primary-50 text-primary-700 sm:bg-transparent sm:text-gray-900'
          : 'border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700 sm:hover:bg-transparent'
      "
      >{{ langNames[lang] }}</RouterLink
    >
  </div>
</template>

<script setup>
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";

const i18n = useI18n();
const locale = i18n.locale;
const route = useRoute();
const availableLanguages = computed(() => i18n.availableLocales);

const langNames = {
  en: "English",
  es: "Español",
};
// Or use Intl.DisplayNames for automatic resolution:
// const langNames = new Intl.DisplayNames(undefined, { type: "language" });
// Then use langNames.of(lang) instead of langNames[lang] in the template
</script>
