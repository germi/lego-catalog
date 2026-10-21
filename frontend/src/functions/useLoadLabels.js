import useLoadData from "@/functions/useLoadData";
import { watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { convertToHierarchy } from "@/utils/csvJsonUtils";

// Toggle between Google Sheets and own backend for label management.
// When true, labels are fetched from a published Google Sheet (all locales at once).
// When false, labels are fetched per-locale from the external API.
const USE_GOOGLE_SHEETS = false;

export default function useLoadLabels(loadOnMount = true, loadOnChange = true) {
  // globally change the language messages for current lang
  const i18n = useI18n();
  const route = useRoute();

  const locale = computed(() => {
    // if the route has a locale param, use that, otherwise use the i18n locale
    return route.params.locale || i18n.locale.value;
  });

  // function to get labels from the server
  const {
    data: labels,
    loadData: getLabels,
    error: errorOnLoading,
  } = useLoadData(
    USE_GOOGLE_SHEETS ? "getLabelsFromGSheets" : "getLabels",
    {},
    undefined,
    // computed(() => ({
    //   locale: locale.value,
    // })),
    undefined,
    loadOnMount,
    false,
    loadOnChange ? locale : undefined,
  );

  // post labels (and get the new ones as a response)
  const {
    data: updatedLabels,
    loadData: postLabels,
    loading,
    error,
  } = useLoadData("postLabels", {}, false, undefined, false, false);

  watch(labels, (labels) => {
    !errorOnLoading.value && updateLocales(labels);
  });
  watch(updatedLabels, updateLocales);

  function updateLocales(labels) {
    USE_GOOGLE_SHEETS
      ? updateLocalesFromGSheets(labels)
      : updateLocalesFromServer(labels);
  }

  function updateLocalesFromServer(labels) {
    // if  labels[locale.value] is array, then make apiLabels an empty object
    const apiLabels =
      (Array.isArray(labels[locale.value]) ? {} : labels[locale.value]) || {};

    i18n.mergeLocaleMessage(locale.value, apiLabels);
  }

  function updateLocalesFromGSheets(labels) {
    // labels will be an object like { en: {...}, es: {...} }
    for (let loc in labels) {
      if (labels.hasOwnProperty(loc) && i18n.messages.value[loc]) {
        i18n.messages.value[loc] = labels[loc];
      }
    }
  }

  return {
    labels,
    getLabels,
    locale,
    postLabels,
    convertToHierarchy,
    loading,
    error,
  };
}
