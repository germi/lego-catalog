import { csvParse } from "d3";

// ── JSON → CSV ──────────────────────────────────────────────────────────

/**
 * Flatten a nested JSON object into an array of `{ key, value }` entries.
 *
 * Object paths are dot-separated (e.g. `"COMPONENTS.HEADER.TITLE"`).
 * Array elements receive a `"[]"` suffix for each value
 * (e.g. `"ITEMS[]"` appears once per element).
 *
 * @param {Object} json - The nested object to flatten.
 * @returns {{ key: string, value: string }[]} Flat key/value pairs.
 */
export function flattenJson(json) {
  const result = [];

  const traverse = (obj, path = []) => {
    Object.keys(obj).forEach((key) => {
      const newPath = [...path, key];

      if (Array.isArray(obj[key])) {
        obj[key].forEach((value) => {
          result.push({ key: newPath.join(".") + "[]", value });
        });
      } else if (typeof obj[key] === "string") {
        result.push({ key: newPath.join("."), value: obj[key] });
      } else {
        traverse(obj[key], newPath);
      }
    });
  };

  traverse(json);
  return result;
}

/**
 * Convert an array of `{ key, value }` objects to a CSV string.
 *
 * Every value is double-quoted so that commas, quotes and newlines
 * inside content are handled correctly (RFC 4180).
 *
 * @param {{ key: string, value: string }[]} rows - Flat key/value pairs.
 * @returns {string} A ready-to-download CSV string with a `key,value` header.
 */
export function toCsvString(rows) {
  const escape = (v) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;

  const header = "key,value";
  const lines = rows.map((r) => `${escape(r.key)},${escape(r.value)}`);
  return [header, ...lines].join("\n");
}

/**
 * Convert a nested JSON locale object directly to a CSV string.
 *
 * Shorthand for `toCsvString(flattenJson(json))`.
 *
 * @param {Object} json - The nested locale object (e.g. `{ HEADER: { TITLE: "Hello" } }`).
 * @returns {string} CSV string with `key,value` columns.
 */
export function jsonToCsv(json) {
  return toCsvString(flattenJson(json));
}

// ── Path / Key helpers ──────────────────────────────────────────────────

/**
 * Build a nested object from a single dot-separated path and a value.
 *
 * Every segment is treated as a plain object key — numeric segments
 * like `"1"` stay as string keys (no array conversion).
 *
 * @example convertToHierarchy("SDGS.1.TITLE", "No Poverty")
 * // → { SDGS: { "1": { TITLE: "No Poverty" } } }
 *
 * @param {string} path  - Dot-separated key path.
 * @param {*}      value - The value to set at the deepest level.
 * @returns {Object} A nested object with a single leaf.
 */
export function convertToHierarchy(path, value) {
  const keys = path.split(".");
  const result = {};
  let current = result;
  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

// ── CSV → JSON ──────────────────────────────────────────────────────────

/**
 * Reconstruct a nested JSON object from a flat array of `{ key, value }` rows.
 *
 * Keys follow the same dot / bracket convention produced by `flattenJson`:
 *   - `"COMPONENTS.HEADER.TITLE"` → `{ COMPONENTS: { HEADER: { TITLE: "…" } } }`
 *   - `"ITEMS[]"` (repeated) → `{ ITEMS: ["…", "…"] }`
 *   - Numeric segments are preserved as string object keys, not converted to arrays.
 *
 * @param {{ key: string, value: string }[]} flatArray - Rows with dot-separated keys.
 * @returns {Object} The reconstructed nested object.
 */
export function unflattenJson(flatArray) {
  const result = {};

  for (const { key, value } of flatArray) {
    if (key.endsWith("[]")) {
      // Array values: same key repeated, collect into an array
      const parts = key.slice(0, -2).split(".");
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      const last = parts[parts.length - 1];
      if (!Array.isArray(current[last])) current[last] = [];
      current[last].push(value);
    } else {
      // Plain dot-separated path — numeric segments stay as string keys
      const parts = key.split(".");
      let current = result;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
  }

  return result;
}

/**
 * Parse a CSV string into a nested JSON locale object.
 *
 * Expects a CSV with `key` and `value` columns (the format produced by `jsonToCsv`).
 * Uses d3's `csvParse` for robust RFC 4180 parsing, then rebuilds
 * the nested structure via `unflattenJson`.
 *
 * @param {string} csv - Raw CSV text with a header row.
 * @returns {Object} The reconstructed nested locale object.
 */
export function csvToJson(csv) {
  const rows = csvParse(csv);
  return unflattenJson(rows);
}

// ── Multi-language CSV ───────────────────────────────────────────────────

/**
 * Convert multiple locale objects into a single CSV with one column per language.
 *
 * The reference locale (first key) determines row order. Array keys (`"ITEMS[]"`)
 * appear as repeated rows, aligned by position across locales.
 *
 * @param {Object} locales - Map of lang code → nested locale object (e.g. `{ en: {…}, es: {…} }`).
 * @returns {string} CSV string with `key,en,es,…` columns.
 */
export function multiLangJsonToCsv(locales) {
  const langs = Object.keys(locales);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

  // Build per-lang lookup: "KEY::occurrence" → value
  const langMaps = {};
  for (const lang of langs) {
    const counter = {};
    langMaps[lang] = new Map();
    for (const { key, value } of flattenJson(locales[lang])) {
      counter[key] = (counter[key] ?? 0);
      langMaps[lang].set(`${key}::${counter[key]}`, value);
      counter[key]++;
    }
  }

  // Use first lang as reference for row ordering
  const refCounter = {};
  const rows = flattenJson(locales[langs[0]]).map(({ key }) => {
    refCounter[key] = (refCounter[key] ?? 0);
    const mapKey = `${key}::${refCounter[key]}`;
    refCounter[key]++;
    const values = langs.map((l) => langMaps[l].get(mapKey) ?? "");
    return [key, ...values].map(escape).join(",");
  });

  const header = ["key", ...langs].map(escape).join(",");
  return [header, ...rows].join("\n");
}

/**
 * Parse a multi-language CSV (columns: `key`, `en`, `es`, …) into a map of
 * lang code → nested locale object.
 *
 * @param {string} csv - CSV string produced by `multiLangJsonToCsv`.
 * @returns {Object} Map of lang code → nested locale object.
 */
export function multiLangCsvToJson(csv) {
  const rows = csvParse(csv);
  const langs = rows.columns.filter((c) => c !== "key");

  const flatByLang = Object.fromEntries(langs.map((l) => [l, []]));
  for (const row of rows) {
    for (const lang of langs) {
      flatByLang[lang].push({ key: row.key, value: row[lang] ?? "" });
    }
  }

  return Object.fromEntries(
    langs.map((lang) => [lang, unflattenJson(flatByLang[lang])])
  );
}
