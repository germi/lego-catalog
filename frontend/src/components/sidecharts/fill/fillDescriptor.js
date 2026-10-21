/**
 * Fill descriptors — the JSON-serializable bridge for the fill system.
 *
 * The library's fills (textures, gradients, flags) are **live objects** with
 * `{ register(svgEl), url() }` methods — great for rendering, impossible to
 * `JSON.stringify`. A *fill descriptor* is the plain-data twin: a `{ type, ... }`
 * object (or a bare CSS color string) that fully describes a fill and can be
 * stored in a scene, saved to localStorage, or returned by an AI agent.
 *
 *   descriptor  ──createFill()──▶  live fill ({register,url}) | css string
 *   live fill   ──serializeFill()─▶  descriptor | css string
 *
 * `createFill` is the single place that turns descriptors into the live objects
 * the layers' `color`/`fill` props expect (via `resolveFill`). Results are
 * memoized per structural descriptor so identical fills reuse one live object
 * (and therefore one registered `<defs>` entry) instead of churning on every
 * render.
 *
 * @typedef {Object} FillDescriptor
 * @property {"color"|"linearGradient"|"radialGradient"|"texture"|"flag"|"preset"} type
 * // ...type-specific fields, see FILL_TYPES below.
 */

import { fromTexture, textures } from "./texture.js";
import { linearGradient, radialGradient } from "./gradientFill.js";
import { fromFlag } from "./flagFill.js";
import { getTexturePreset } from "./textureRegistry.js";

export const FILL_TYPES = Object.freeze({
  COLOR: "color",
  LINEAR_GRADIENT: "linearGradient",
  RADIAL_GRADIENT: "radialGradient",
  TEXTURE: "texture",
  FLAG: "flag",
  PRESET: "preset",
});

const FILL_TYPE_SET = new Set(Object.values(FILL_TYPES));

/** Texture builder shapes we know how to (re)construct from a descriptor. */
const TEXTURE_SHAPES = new Set(["lines", "circles", "paths"]);

// ── Type guards ──────────────────────────────────────────────────────────────

/**
 * True when `x` is a fill descriptor object (has a known `type`). Bare color
 * strings are valid *fills* but are NOT descriptors — use `isFillSpec` for the
 * "string or descriptor" union.
 * @param {unknown} x
 */
export function isFillDescriptor(x) {
  return (
    !!x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    typeof (/** @type {any} */ (x).type) === "string" &&
    FILL_TYPE_SET.has(/** @type {any} */ (x).type)
  );
}

/** True for anything `createFill` accepts: a CSS string or a descriptor. */
export function isFillSpec(x) {
  return typeof x === "string" || isFillDescriptor(x);
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Lightweight structural validation. Returns `{ valid, errors }`. Does not
 * mutate. Intended for the scene validator and the agent API door.
 * @param {unknown} desc
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateFillDescriptor(desc) {
  const errors = [];
  if (typeof desc === "string") return { valid: true, errors };
  if (!isFillDescriptor(desc)) {
    return { valid: false, errors: ["not a fill descriptor or color string"] };
  }
  const d = /** @type {any} */ (desc);
  switch (d.type) {
    case FILL_TYPES.COLOR:
      if (typeof d.value !== "string") errors.push("color.value must be a string");
      break;
    case FILL_TYPES.LINEAR_GRADIENT:
    case FILL_TYPES.RADIAL_GRADIENT:
      if (!Array.isArray(d.stops) || d.stops.length === 0) {
        errors.push(`${d.type}.stops must be a non-empty array`);
      } else if (d.stops.some((s) => !s || typeof s.offset !== "string" || typeof s.color !== "string")) {
        errors.push(`${d.type}.stops items need { offset:string, color:string }`);
      }
      break;
    case FILL_TYPES.TEXTURE:
      if (d.shape != null && !TEXTURE_SHAPES.has(d.shape)) {
        errors.push(`texture.shape must be one of ${[...TEXTURE_SHAPES].join(", ")}`);
      }
      break;
    case FILL_TYPES.FLAG:
      if (typeof d.id !== "string") errors.push("flag.id must be a string");
      break;
    case FILL_TYPES.PRESET:
      if (typeof d.name !== "string") errors.push("preset.name must be a string");
      else if (!getTexturePreset(d.name)) errors.push(`unknown texture preset "${d.name}"`);
      break;
    default:
      errors.push(`unknown fill type "${d.type}"`);
  }
  return { valid: errors.length === 0, errors };
}

// ── Builders (descriptor → live fill) ──────────────────────────────────────────

function buildLinearGradient(d) {
  return linearGradient({
    stops: d.stops ?? [],
    x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
    gradientUnits: d.gradientUnits,
    spreadMethod: d.spreadMethod,
    gradientTransform: d.gradientTransform,
  });
}

function buildRadialGradient(d) {
  return radialGradient({
    stops: d.stops ?? [],
    mode: d.mode,
    cx: d.cx, cy: d.cy, r: d.r, fx: d.fx, fy: d.fy,
    gradientUnits: d.gradientUnits,
    spreadMethod: d.spreadMethod,
    gradientTransform: d.gradientTransform,
  });
}

function buildTexture(d) {
  const shape = d.shape ?? "lines";
  const factory = textures[shape];
  if (typeof factory !== "function") {
    throw new Error(`[fillDescriptor] unknown texture shape "${shape}"`);
  }
  let t = factory();
  // Setters return the texture function, so chaining via reassignment is safe.
  // Only apply fields that are present so the textures.js defaults stand.
  if (d.size != null) t = t.size(d.size);
  if (d.strokeWidth != null) t = t.strokeWidth(d.strokeWidth);
  if (d.stroke != null) t = t.stroke(d.stroke);
  if (d.background != null) t = t.background(d.background);
  if (d.shapeRendering != null) t = t.shapeRendering(d.shapeRendering);

  if (shape === "lines" && d.orientation != null) t = t.orientation(d.orientation);
  if (shape === "circles") {
    if (d.fill != null) t = t.fill(d.fill);
    if (d.radius != null) t = t.radius(d.radius);
    if (d.complement) t = t.complement();
  }
  if (shape === "paths") {
    if (d.d != null) t = t.d(d.d);
    if (d.fill != null) t = t.fill(d.fill);
  }
  return fromTexture(t);
}

/**
 * Attach the originating descriptor to a live fill (non-enumerable so it never
 * leaks into JSON of the live object itself) so `serializeFill` can recover it.
 */
function tag(live, descriptor) {
  try {
    Object.defineProperty(live, "__fillDescriptor", {
      value: descriptor,
      enumerable: false,
      configurable: true,
    });
  } catch {
    /* frozen / primitive — ignore */
  }
  return live;
}

// ── Memoization ────────────────────────────────────────────────────────────────

const _cache = new Map();

/** Deterministic stringify (sorted keys) so structurally-equal descriptors hit. */
function stableKey(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableKey).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => JSON.stringify(k) + ":" + stableKey(value[k])).join(",")}}`;
}

/** Clear the live-fill memo (e.g. on hot-reload or teardown). */
export function clearFillCache() {
  _cache.clear();
}

// ── Main entry points ──────────────────────────────────────────────────────────

/**
 * Turn a fill spec (CSS string or descriptor) into the value a layer's
 * `color`/`fill` prop wants: a CSS string, or a live `{ register, url }` object.
 * Returns `null` for nullish/invalid input (which `resolveFill` treats as "no
 * fill"). Already-live fills (objects with `register`/`url`) pass through.
 *
 * @param {string | FillDescriptor | { register: Function, url: Function } | null | undefined} value
 * @param {{ memo?: boolean }} [opts]
 * @returns {string | { register: Function, url: Function } | null}
 */
export function createFill(value, { memo = true } = {}) {
  if (value == null) return null;
  if (typeof value === "string") return value;

  // Already a live fill object — hand it straight to resolveFill.
  if (typeof value.register === "function" && typeof value.url === "function") {
    return value;
  }

  if (!isFillDescriptor(value)) {
    console.warn("[fillDescriptor] createFill: not a color string or descriptor", value);
    return null;
  }

  // `color` resolves to a plain string — itself serializable, no caching needed.
  if (value.type === FILL_TYPES.COLOR) return value.value ?? null;

  if (memo) {
    const key = stableKey(value);
    if (_cache.has(key)) return _cache.get(key);
    const built = buildLive(value);
    _cache.set(key, built);
    return built;
  }
  return buildLive(value);
}

function buildLive(value) {
  switch (value.type) {
    case FILL_TYPES.LINEAR_GRADIENT:
      return tag(buildLinearGradient(value), value);
    case FILL_TYPES.RADIAL_GRADIENT:
      return tag(buildRadialGradient(value), value);
    case FILL_TYPES.TEXTURE:
      return tag(buildTexture(value), value);
    case FILL_TYPES.FLAG:
      return tag(
        fromFlag(value.id, { basePath: value.basePath, extension: value.extension }),
        value,
      );
    case FILL_TYPES.PRESET: {
      const preset = getTexturePreset(value.name);
      if (!preset) {
        console.warn(`[fillDescriptor] unknown texture preset "${value.name}"`);
        return null;
      }
      // Build the underlying texture, but re-tag with the preset descriptor so
      // it serializes back to { type:"preset", name } rather than the expansion.
      return tag(createFill(preset, { memo: false }), value);
    }
    default:
      console.warn(`[fillDescriptor] unknown fill type "${value.type}"`);
      return null;
  }
}

/**
 * Inverse of `createFill`: recover a serializable spec from any fill value.
 * - CSS string → returned as-is.
 * - descriptor → returned as-is.
 * - live fill built by `createFill` → its tagged descriptor.
 * - opaque live fill (built elsewhere) → `null` + warning (can't introspect).
 *
 * @param {unknown} value
 * @returns {string | FillDescriptor | null}
 */
export function serializeFill(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (isFillDescriptor(value)) return value;
  const tagged = /** @type {any} */ (value).__fillDescriptor;
  if (tagged) return tagged;
  console.warn("[fillDescriptor] serializeFill: opaque live fill has no descriptor");
  return null;
}
