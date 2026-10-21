import { useEffect, useState } from "react";

// Apps that don't have a router can flip this manually:
//   window.__sidechartsEditMode = true;
let _globalFlag = false;
const _listeners = new Set();

if (typeof window !== "undefined") {
  Object.defineProperty(window, "__sidechartsEditMode", {
    get: () => _globalFlag,
    set: (v) => {
      _globalFlag = !!v;
      _listeners.forEach((fn) => fn());
    },
    configurable: true,
  });
}

function readModeFromUrl() {
  if (typeof window === "undefined") return false;
  // Regular search params.
  const search = window.location.search;
  if (new URLSearchParams(search).get("mode") === "edit") return true;
  // Hash-routed apps: #/route?mode=edit
  const hash = window.location.hash;
  const q = hash.indexOf("?");
  if (q >= 0) {
    if (new URLSearchParams(hash.slice(q + 1)).get("mode") === "edit") return true;
  }
  return false;
}

/**
 * React hook — reactive boolean: are we in edit mode?
 *
 * Sources, in priority order:
 *   1. `?mode=edit` in the URL (search OR the hash for hash-routed apps)
 *   2. `window.__sidechartsEditMode = true` (manual override)
 *
 * Mirrors Vue's `useEditMode()`.
 */
export function useEditMode() {
  const [state, setState] = useState(() => readModeFromUrl() || _globalFlag);

  useEffect(() => {
    const update = () => setState(readModeFromUrl() || _globalFlag);
    window.addEventListener("popstate",   update);
    window.addEventListener("hashchange", update);
    _listeners.add(update);
    return () => {
      window.removeEventListener("popstate",   update);
      window.removeEventListener("hashchange", update);
      _listeners.delete(update);
    };
  }, []);

  return state;
}
