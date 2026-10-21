import { useCallback, useMemo, useState } from "react";

/**
 * Mirror a props object with a layer of editable overrides on top.
 *
 * Returns:
 *   - `overrides`     — current overrides object (plain map keyed by prop name).
 *   - `effective`     — { ...propsLike, ...overrides } restricted to the keys
 *                       present in `defaults`. Use it in JSX where you'd use
 *                       props directly.
 *   - `setOverride`   — `(key, value) => void`. Override a single prop.
 *   - `resetOverride` — `(key) => void`. Drop one override.
 *   - `resetAll`      — `() => void`. Drop all overrides.
 *
 * Mirrors Vue's `useEditableProps(props, defaults)`.
 *
 * @param {object} propsLike  Plain props object (just `props` in a React component).
 * @param {object} defaults   The preset's `*_CHART_DEFAULTS` — its keys define
 *                            which props are editable.
 */
export function useEditableProps(propsLike, defaults) {
  const [overrides, setOverrides] = useState({});

  const effective = useMemo(() => {
    const out = {};
    for (const key of Object.keys(defaults)) {
      out[key] = key in overrides ? overrides[key] : propsLike[key];
    }
    return out;
  }, [propsLike, overrides, defaults]);

  const setOverride = useCallback((key, value) => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetOverride = useCallback((key) => {
    setOverrides((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => setOverrides({}), []);

  return { overrides, effective, setOverride, resetOverride, resetAll };
}
