import { useRoute, useRouter } from "vue-router";
import { removeNulls } from "@/utils/helpers";
import { ref } from "vue";

function useSetQuery() {
  const router = useRouter();
  const route = useRoute();

  const setQuery = (q = {}, page = null) => {
    router.push({
      name: page || route.name,
      query: removeNulls({ ...route.query, ...q }),
    });
  };

  return setQuery;
}

export function useSingleRouteFilter(
  name,
  defaultValue = ref(null),
  type = "string",
) {
  const route = useRoute();
  const setQuery = useSetQuery();

  const filter = computed({
    get: () => {
      if (type === "number") return +route.query[name] || defaultValue.value;
      else return route.query[name] || defaultValue.value;
    },
    set: (value) => setQuery({ [name]: value }),
  });

  return filter;
}

export function useSingleRouteParam(
  name,
  defaultValue = ref(null),
  type = "string",
) {
  const route = useRoute();
  const router = useRouter();

  const filter = computed({
    get: () => {
      if (type === "number") return +route.params[name] || defaultValue.value;
      else return route.params[name] || defaultValue.value;
    },
    set: (value) =>
      router.push({
        params: { ...route.params, [name]: value },
        query: route.query,
      }),
  });

  return filter;
}

export function useMultipleRouteFilter(name, defaultValue = ref([])) {
  const route = useRoute();
  const router = useRouter();

  const filter = computed({
    get: () => {
      return route.query[name]?.split(",") || [...defaultValue.value];
    },
    set: (value) => {
      // we can set it to null to remove the filter
      if (value === null) {
        setSegment(name, null);
        return;
      }
      // if it's an array, set it directly
      if (Array.isArray(value)) {
        setSegment(name, value.length ? value.join(",") : null);
        return;
      }
      // otherwise, toggle the value
      const curr = route.query[name]?.split(",") || [...defaultValue.value];

      if (curr.includes(value)) {
        curr.splice(curr.indexOf(value), 1);
      } else {
        curr.push(value);
      }

      setSegment(name, curr?.length ? curr.join(",") : null);
    },
  });

  const setSegment = (name, value) => {
    router.push({ query: removeNulls({ ...route.query, [name]: value }) });
  };

  return filter;
}

export default function useFilters() {
  const setQuery = useSetQuery();

  // --- Dashboard -----------------------------------------------------------
  // Which list is being shown: "all", "none", or a list id.
  const listQuery = useSingleRouteFilter("list", ref("all"));
  const list = computed({
    get: () => listQuery.value,
    // removeNulls drops falsy values, so writing null takes the parameter out of the
    // URL entirely. The default is written as null to keep a plain URL plain.
    set: (value) => (listQuery.value = !value || value === "all" ? null : String(value)),
  });

  // Grouped-by-list view. Present as group=1, absent when off.
  const groupQuery = useSingleRouteFilter("group");
  const grouped = computed({
    get: () => groupQuery.value === "1",
    set: (value) => (groupQuery.value = value ? "1" : null),
  });

  // --- Product page --------------------------------------------------------
  // Chart range: "30", "90", "365" or "all". Kept as a string on purpose — the
  // number type coerces with `+value || default`, which would turn a legitimate 0
  // back into the default.
  const daysQuery = useSingleRouteFilter("days", ref("90"));
  const days = computed({
    get: () => daysQuery.value,
    set: (value) => (daysQuery.value = !value || value === "90" ? null : String(value)),
  });

  // do not remove this
  const viewLocale = useSingleRouteFilter("locale");

  return { list, grouped, days, viewLocale, setQuery };
}
