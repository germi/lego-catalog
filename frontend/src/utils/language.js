/**
 * Read a value from a nested object using a dot-separated path.
 *
 * @param {Object} obj  - The object to traverse.
 * @param {string} path - Dot-separated key path (e.g. `"MENU.HOME"`).
 * @returns {*} The value at the given path, or `undefined` if any segment is missing.
 */
export function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/**
 * Set a value inside a nested object using a dot-separated path.
 *
 * Intermediate objects are created automatically when they don't exist.
 *
 * @param {Object} obj   - The object to mutate.
 * @param {string} path  - Dot-separated key path (e.g. `"MENU.HOME"`).
 * @param {*}      value - The value to set at the deepest level.
 */
export function setNestedValue(obj, path, value) {
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * Save a label update across all locales.
 *
 * Updates each locale's messages object in memory via `setNestedValue`,
 * then (in DEV mode only) persists the changes to the locale JSON files
 * by POSTing to the Vite dev server's `/__save-locale` endpoint.
 *
 * @param {Object}   messages        - The reactive i18n `messages.value` object (keyed by locale).
 * @param {string[]} availableLocales - List of locale codes to update (e.g. `["en", "es"]`).
 * @param {string}   key             - The dot-separated label key (e.g. `"MENU.HOME"`).
 * @param {Object}   inputs          - An object keyed by locale with the new values.
 * @returns {Promise<void>}
 */
export async function saveLabel(messages, availableLocales, key, inputs) {
  for (const loc of availableLocales) {
    setNestedValue(messages[loc], key, inputs[loc]);
  }

  if (import.meta.env.DEV) {
    const updates = availableLocales.map((loc) => ({
      locale: loc,
      key,
      value: inputs[loc],
    }));
    await fetch("/__save-locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });
  }
}

/**
 * Flatten a nested locale messages object into an array of `{ key, value }` entries.
 *
 * Unlike `flattenJson` in `csvJsonUtils.js`, this does not handle arrays —
 * it is intended for i18n message objects where every leaf is a string.
 *
 * @param {Object} obj        - The nested messages object.
 * @param {string} [prefix=""] - Internal prefix used during recursion.
 * @returns {{ key: string, value: string }[]} Flat key/value pairs.
 */
export function flattenMessages(obj, prefix = "") {
  const entries = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      entries.push(...flattenMessages(obj[key], fullKey));
    } else {
      entries.push({ key: fullKey, value: obj[key] });
    }
  }
  return entries;
}
