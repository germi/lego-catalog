import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";

import api from "@/services/data";

export default function useLoadData(
  endpoint = "getData",
  initialValue = [],
  resetData = false, // whether to reset the data to initialValue every time the loadData function is called. Careful with watchers!
  params = ref(null),
  loadOnMount = true,
  useWatchers = true,
  customWatch = ref(null),
) {
  const data = ref(initialValue);
  const loading = ref(false);
  const error = ref(false);

  const route = useRoute();

  const loadData = async (postData) => {
    if (resetData) data.value = initialValue;

    let timeout;
    try {
      // activate the loading status after 200ms
      timeout = setTimeout(() => (loading.value = true), 200);

      const useParams = params.value || route.params;

      const result = await api[endpoint](useParams, route.query, postData);

      data.value = result;

      error.value = false;
    } catch (err) {
      error.value = err;
      console.error(err);
      throw err;
    } finally {
      loading.value = false;
      clearTimeout(timeout);
    }
  };

  onMounted(() => {
    loadOnMount && loadData();
  });

  watch(
    // if you want to watch params or query, be careful to avoid undesired reloads
    // use a string: JSON.stringify(route.params) or JSON.stringify(route.query) to watch them deeply but avoid reloads on every change
    () => route.name,
    () => {
      if (!useWatchers) return;
      loadData();
    },
  );

  watch(customWatch, () => {
    loadData();
  });

  return {
    data,
    loading,
    error,
    loadData,
  };
}
