import { computed, ref } from "vue";
import { useRoute } from "vue-router";

// Apps without vue-router can flip this manually:
//   window.__sidechartsEditMode = true;
const globalFlag = ref(false);
if (typeof window !== "undefined") {
  Object.defineProperty(window, "__sidechartsEditMode", {
    get: () => globalFlag.value,
    set: (v) => { globalFlag.value = !!v; },
    configurable: true,
  });
}

/**
 * Reactive boolean: are we in edit mode?
 *
 * Sources, in priority order:
 *   1. `?mode=edit` in the URL (requires vue-router in the host app)
 *   2. `window.__sidechartsEditMode = true` (for apps without a router)
 */
export function useEditMode() {
  // useRoute() returns undefined when there is no router, never throws.
  const route = useRoute();
  return computed(() => {
    if (route?.query?.mode === "edit") return true;
    return globalFlag.value;
  });
}
