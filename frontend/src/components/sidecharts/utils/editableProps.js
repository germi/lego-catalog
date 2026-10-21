import { reactive, computed } from "vue";

/**
 * Mirror a props object with a layer of editable overrides on top.
 *
 * Returns:
 *   - `overrides`  — reactive plain object. Set a key to override the prop;
 *                    delete the key to revert to the parent's value.
 *   - `effective`  — reactive object where each key returns the override
 *                    when present, otherwise the underlying prop value.
 *                    Use in the template exactly like you'd use `props`.
 *
 * @param {object} props     The Vue setup `props` proxy.
 * @param {object} defaults  The preset's `*_CHART_DEFAULTS` object. Its keys
 *                           define which props become editable.
 */
export function useEditableProps(props, defaults) {
  const overrides = reactive({});

  const map = {};
  for (const key of Object.keys(defaults)) {
    map[key] = computed(() =>
      key in overrides ? overrides[key] : props[key],
    );
  }
  // reactive() auto-unwraps computed refs at the property level, so
  // `effective.duration` in a template returns the value, not the ref.
  const effective = reactive(map);

  return { overrides, effective };
}
