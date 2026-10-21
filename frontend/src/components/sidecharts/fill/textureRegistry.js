/**
 * Named, JSON-serializable texture presets.
 *
 * Each preset is a plain **fill descriptor** (see `fillDescriptor.js`), NOT a
 * live texture object — so they round-trip through JSON and can be listed in an
 * editor or handed to an AI agent. `createFill({ type: "preset", name })`
 * resolves a name to its descriptor and builds the live texture on demand.
 *
 * The continent set mirrors the live singletons in `continentTextures.js`
 * (kept as-is for the map components); these descriptor twins exist so scenes
 * can reference them by name and serialize cleanly.
 */

/** @type {Record<string, import("./fillDescriptor.js").FillDescriptor>} */
export const TEXTURE_PRESETS = {
  // ── Continent-style (twins of continentTextures.js) ──────────────────────
  africa:       { type: "texture", shape: "circles", fill: "#f59e0b", radius: 2, size: 7, background: "#fef3c7" },
  asia:         { type: "texture", shape: "lines", orientation: "diagonal",  stroke: "#ef4444", size: 7, strokeWidth: 1.5, background: "#fee2e2" },
  europe:       { type: "texture", shape: "lines", orientation: "vertical",  stroke: "#3b82f6", size: 6, strokeWidth: 1.5, background: "#dbeafe" },
  northAmerica: { type: "texture", shape: "lines", orientation: "3/8",       stroke: "#8b5cf6", size: 7, strokeWidth: 1.5, background: "#ede9fe" },
  southAmerica: { type: "texture", shape: "circles", fill: "#10b981", radius: 2, size: 8, background: "#d1fae5" },
  oceania:      { type: "texture", shape: "lines", orientation: "horizontal", stroke: "#f97316", size: 6, strokeWidth: 1.5, background: "#ffedd5" },

  // ── Generic, background-less hatches/dots (read well over any chart) ──────
  diagonalHatch:   { type: "texture", shape: "lines", orientation: "diagonal",   stroke: "rgba(71,85,105,0.55)",  size: 6, strokeWidth: 1 },
  verticalHatch:   { type: "texture", shape: "lines", orientation: "vertical",   stroke: "rgba(71,85,105,0.55)",  size: 6, strokeWidth: 1 },
  horizontalHatch: { type: "texture", shape: "lines", orientation: "horizontal", stroke: "rgba(71,85,105,0.55)",  size: 6, strokeWidth: 1 },
  crossHatch:      { type: "texture", shape: "paths", d: "crosses", stroke: "rgba(71,85,105,0.55)", size: 8, strokeWidth: 1 },
  dots:            { type: "texture", shape: "circles", fill: "rgba(71,85,105,0.55)", radius: 1.5, size: 7 },
  waves:           { type: "texture", shape: "paths", d: "waves", stroke: "rgba(71,85,105,0.55)", size: 8, strokeWidth: 1 },
};

/** All preset names, for populating an editor dropdown. */
export function listTexturePresets() {
  return Object.keys(TEXTURE_PRESETS);
}

/**
 * Resolve a preset name to its (cloned) descriptor, or `null` if unknown.
 * Cloned so callers can tweak without mutating the shared preset.
 * @param {string} name
 * @returns {import("./fillDescriptor.js").FillDescriptor | null}
 */
export function getTexturePreset(name) {
  const d = TEXTURE_PRESETS[name];
  return d ? { ...d } : null;
}
