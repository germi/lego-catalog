/**
 * SuperLineChart scene / story schema — validation and default-filling.
 *
 * Exports
 * -------
 *   validateScene(scene, opts?)    → { valid, errors, warnings }
 *   withSceneDefaults(scene)       → normalized scene (input not mutated)
 *   validateStory(story, opts?)    → { valid, errors, warnings }
 *   VALID_CURVES, VALID_EASES      → exported Sets (for editor enum pickers)
 *
 * Design notes
 * ------------
 * - Framework-agnostic: no Vue / D3 imports. Only depends on fillDescriptor
 *   (fill validation) and SuperLineChart.defaults.js (default values).
 * - Never throws. Every function catches bad input and returns a result.
 * - errors   = structural problems that will break rendering or meaning.
 * - warnings = suspicious but recoverable values (unknown enum, likely typo).
 * - The maxZoom-vs-zoom trap is checked when the caller passes `opts.data`;
 *   without data we can still validate shape, but not the implied k value.
 */

import { validateFillDescriptor } from "../../fill/fillDescriptor.js";
import {
  SUPER_CHART_DEFAULTS as CD,
  SUPER_SERIES_STROKE_DEFAULTS as SSD,
  SUPER_BAND_DEFAULTS,
} from "../../presets/SuperLineChart.defaults.js";

// ── Known enum sets (exported so the editor can build pickers from them) ─────

/** All D3 curve factory names accepted by LineChart's `curve` prop. */
export const VALID_CURVES = new Set([
  "curveLinear",
  "curveBasis", "curveBasisClosed", "curveBasisOpen",
  "curveBumpX", "curveBumpY",
  "curveBundle",
  "curveCardinal", "curveCardinalClosed", "curveCardinalOpen",
  "curveCatmullRom", "curveCatmullRomClosed", "curveCatmullRomOpen",
  "curveMonotoneX", "curveMonotoneY",
  "curveNatural",
  "curveStep", "curveStepAfter", "curveStepBefore",
]);

/** All d3-ease names accepted by the layer transition system. */
export const VALID_EASES = new Set([
  "easeLinear",
  "easeQuad",    "easeQuadIn",    "easeQuadOut",    "easeQuadInOut",
  "easeCubic",   "easeCubicIn",   "easeCubicOut",   "easeCubicInOut",
  "easePoly",    "easePolyIn",    "easePolyOut",    "easePolyInOut",
  "easeSin",     "easeSinIn",     "easeSinOut",     "easeSinInOut",
  "easeExp",     "easeExpIn",     "easeExpOut",     "easeExpInOut",
  "easeCircle",  "easeCircleIn",  "easeCircleOut",  "easeCircleInOut",
  "easeElastic", "easeElasticIn", "easeElasticOut", "easeElasticInOut",
  "easeBack",    "easeBackIn",    "easeBackOut",    "easeBackInOut",
  "easeBounce",  "easeBounceIn",  "easeBounceOut",  "easeBounceInOut",
]);

const LABEL_ALIGNS = new Set(["start", "middle", "end"]);

// ── Type helpers (local, no exports) ─────────────────────────────────────────

const isFiniteNum  = (v) => typeof v === "number" && isFinite(v);
const isPositiveNum = (v) => isFiniteNum(v) && v > 0;
const isNonNegNum  = (v) => isFiniteNum(v) && v >= 0;
const inRange01    = (v) => isFiniteNum(v) && v >= 0 && v <= 1;
const isStr        = (v) => typeof v === "string";
const isBool       = (v) => typeof v === "boolean";
const isPlainObj   = (v) => v != null && typeof v === "object" && !Array.isArray(v);
const isNumArr2    = (v) =>
  Array.isArray(v) && v.length === 2 && isFiniteNum(v[0]) && isFiniteNum(v[1]);

function checkFill(fill, path, errors) {
  if (fill == null) return;
  const r = validateFillDescriptor(fill);
  if (!r.valid) r.errors.forEach((e) => errors.push(`${path}: ${e}`));
}

// ── Section validators ────────────────────────────────────────────────────────

function validateChart(chart, errors, warnings) {
  if (chart == null) return;
  if (!isPlainObj(chart)) { errors.push("chart must be an object"); return; }

  if (chart.duration != null && !isNonNegNum(chart.duration))
    errors.push("chart.duration: must be a non-negative number (ms)");

  if (chart.ease != null && !VALID_EASES.has(chart.ease))
    warnings.push(`chart.ease: unknown value "${chart.ease}" — falls back to default`);

  if (chart.curve != null && !VALID_CURVES.has(chart.curve))
    warnings.push(`chart.curve: unknown value "${chart.curve}" — falls back to default`);

  if (chart.maxZoom != null && (!isFiniteNum(chart.maxZoom) || chart.maxZoom < 1))
    errors.push("chart.maxZoom: must be a number ≥ 1");

  if (chart.forceY != null) {
    if (!isNumArr2(chart.forceY))
      errors.push("chart.forceY: must be [number, number]");
    else if (chart.forceY[0] >= chart.forceY[1])
      errors.push("chart.forceY: [0] must be strictly less than [1]");
  }

  if (chart.margin != null) {
    if (!isPlainObj(chart.margin)) {
      errors.push("chart.margin: must be an object");
    } else {
      for (const side of ["top", "right", "bottom", "left"])
        if (chart.margin[side] != null && !isNonNegNum(chart.margin[side]))
          errors.push(`chart.margin.${side}: must be a non-negative number`);
    }
  }

  if (chart.showXGrid != null && !isBool(chart.showXGrid))
    warnings.push("chart.showXGrid: expected boolean");
  if (chart.showYGrid != null && !isBool(chart.showYGrid))
    warnings.push("chart.showYGrid: expected boolean");
}

function validateSeriesItem(s, i, errors, warnings) {
  const at = `series[${i}]`;
  if (!isPlainObj(s)) { errors.push(`${at}: must be an object`); return; }

  if (!isStr(s.key) || !s.key)
    errors.push(`${at}.key: required, must be a non-empty string`);

  if (s.label != null && !isStr(s.label))
    warnings.push(`${at}.label: expected string`);

  if (s.curve != null && !VALID_CURVES.has(s.curve))
    warnings.push(`${at}.curve: unknown value "${s.curve}" — falls back to chart.curve`);

  if (s.highlighted != null && !isBool(s.highlighted))
    warnings.push(`${at}.highlighted: expected boolean`);

  // stroke
  if (s.stroke != null) {
    if (!isPlainObj(s.stroke)) {
      errors.push(`${at}.stroke: must be an object`);
    } else {
      checkFill(s.stroke.color, `${at}.stroke.color`, errors);
      if (s.stroke.width != null && !isPositiveNum(s.stroke.width))
        errors.push(`${at}.stroke.width: must be a positive number`);
      if (s.stroke.opacity != null && !inRange01(s.stroke.opacity))
        errors.push(`${at}.stroke.opacity: must be in [0, 1]`);
      if (s.stroke.dasharray != null && !isStr(s.stroke.dasharray))
        warnings.push(`${at}.stroke.dasharray: expected string or null`);
    }
  }

  // reveal
  if (s.reveal != null) {
    if (!isPlainObj(s.reveal)) {
      errors.push(`${at}.reveal: must be null or { start?, end? }`);
    } else {
      if (s.reveal.start != null && !isFiniteNum(s.reveal.start))
        errors.push(`${at}.reveal.start: must be a finite number`);
      if (s.reveal.end != null && !isFiniteNum(s.reveal.end))
        errors.push(`${at}.reveal.end: must be a finite number`);
      if (isFiniteNum(s.reveal.start) && isFiniteNum(s.reveal.end) &&
          s.reveal.start > s.reveal.end)
        errors.push(`${at}.reveal: start must be ≤ end (equal = fully hidden, useful as a starting state)`);
    }
  }

  // band
  if (s.band != null) {
    if (!isPlainObj(s.band)) {
      errors.push(`${at}.band: must be an object`);
    } else {
      if (!isStr(s.band.upperKey) || !s.band.upperKey)
        errors.push(`${at}.band.upperKey: required, must be a non-empty string`);
      if (!isStr(s.band.lowerKey) || !s.band.lowerKey)
        errors.push(`${at}.band.lowerKey: required, must be a non-empty string`);
      checkFill(s.band.fill, `${at}.band.fill`, errors);
      if (s.band.opacity != null && !inRange01(s.band.opacity))
        errors.push(`${at}.band.opacity: must be in [0, 1]`);
    }
  }
}

function validateRefArea(a, i, errors, warnings) {
  const at = `refAreas[${i}]`;
  if (!isPlainObj(a)) { errors.push(`${at}: must be an object`); return; }

  if (!isStr(a.id) || !a.id)
    errors.push(`${at}.id: required, must be a non-empty string`);

  checkFill(a.fill, `${at}.fill`, errors);

  if (a.fillOpacity != null && !inRange01(a.fillOpacity))
    errors.push(`${at}.fillOpacity: must be in [0, 1]`);
  if (a.strokeWidth != null && !isNonNegNum(a.strokeWidth))
    errors.push(`${at}.strokeWidth: must be a non-negative number`);

  // Coordinate fields — finite OR ±Infinity (clampToDomain accepts both)
  for (const k of ["x1", "x2", "y1", "y2"]) {
    const v = a[k];
    if (v != null && !isFiniteNum(v) && v !== Infinity && v !== -Infinity)
      errors.push(`${at}.${k}: must be a finite number or ±Infinity`);
  }
  if (isFiniteNum(a.x1) && isFiniteNum(a.x2) && a.x1 > a.x2)
    warnings.push(`${at}: x1 > x2 — rect will have zero width after clamping`);
  if (isFiniteNum(a.y1) && isFiniteNum(a.y2) && a.y1 > a.y2)
    warnings.push(`${at}: y1 > y2 — rect will have zero height after clamping`);

  // Half-plane shapes
  if (a.side != null) {
    const validSides = new Set(["above", "below", "left", "right"]);
    if (!validSides.has(a.side))
      errors.push(`${at}.side: must be "above", "below", "left", or "right"`);
    if (a.y != null && !isFiniteNum(a.y))
      errors.push(`${at}.y: must be a finite number`);
    if (a.x != null && !isFiniteNum(a.x))
      errors.push(`${at}.x: must be a finite number`);
  }
}

function validateArea(a, i, errors, warnings) {
  const at = `areas[${i}]`;
  if (!isPlainObj(a)) { errors.push(`${at}: must be an object`); return; }

  if (!isStr(a.id) || !a.id)
    errors.push(`${at}.id: required, must be a non-empty string`);

  // One of `key`, `keys`, or { upperKey, lowerKey } is required to render
  // anything. (`reveal`-only specs are pointless without data.)
  const hasKey   = isStr(a.key) && a.key;
  const hasKeys  = Array.isArray(a.keys) && a.keys.length > 0 && a.keys.every((k) => isStr(k) && k);
  const hasBand  = isStr(a.upperKey) && a.upperKey && isStr(a.lowerKey) && a.lowerKey;
  if (!hasKey && !hasKeys && !hasBand)
    warnings.push(
      `${at}: no key/keys/upperKey+lowerKey — area has nothing to render`,
    );

  if (a.color != null) checkFill(a.color, `${at}.color`, errors);
  if (a.opacity != null && !inRange01(a.opacity))
    errors.push(`${at}.opacity: must be in [0, 1]`);
  if (a.stacked != null && typeof a.stacked !== "boolean")
    errors.push(`${at}.stacked: must be a boolean`);
  if (a.curve != null && !isStr(a.curve))
    errors.push(`${at}.curve: must be a string (d3 curve name)`);

  // reveal: { start, end } — both finite numbers when present.
  if (a.reveal != null) {
    if (!isPlainObj(a.reveal)) {
      errors.push(`${at}.reveal: must be an object`);
    } else {
      if (a.reveal.start != null && !isFiniteNum(a.reveal.start))
        errors.push(`${at}.reveal.start: must be a finite number`);
      if (a.reveal.end != null && !isFiniteNum(a.reveal.end))
        errors.push(`${at}.reveal.end: must be a finite number`);
    }
  }
}

function validateRefLine(l, i, errors, warnings) {
  const at = `refLines[${i}]`;
  if (!isPlainObj(l)) { errors.push(`${at}: must be an object`); return; }

  if (!isStr(l.id) || !l.id)
    errors.push(`${at}.id: required, must be a non-empty string`);

  if (l.strokeWidth != null && !isNonNegNum(l.strokeWidth))
    errors.push(`${at}.strokeWidth: must be a non-negative number`);
  if (l.opacity != null && !inRange01(l.opacity))
    errors.push(`${at}.opacity: must be in [0, 1]`);
  if (l.labelAlign != null && !LABEL_ALIGNS.has(l.labelAlign))
    errors.push(`${at}.labelAlign: must be "start", "middle", or "end"`);
  if (l.labelSize != null && !isPositiveNum(l.labelSize))
    errors.push(`${at}.labelSize: must be a positive number`);
  if (l.labelDy != null && !isFiniteNum(l.labelDy))
    errors.push(`${at}.labelDy: must be a finite number`);

  // At least one of x / y / x1 is required for the line to render
  const hasCoords = l.y != null || l.x != null || l.x1 != null || l.rule != null;
  if (!hasCoords)
    warnings.push(`${at}: no coordinate (x, y, x1/y1/x2/y2, rule) — line will not render`);
}

/**
 * Check the zoom field.
 *
 * maxZoom-vs-zoom trap: when the requested zoom.x domain spans less than
 * 1/maxZoom of the full data x-extent, the first user wheel/pinch gesture
 * will snap to maxZoom — visually jarring.  We detect and warn when data is
 * available so callers can either widen the domain or raise maxZoom.
 */
function validateZoom(zoom, chart, data, errors, warnings) {
  if (zoom == null) return; // null → full reset, always valid

  if (!isPlainObj(zoom)) {
    errors.push("zoom: must be an object or null");
    return;
  }

  // ── Transform zoom ────────────────────────────────────────────────────────
  if (zoom.transform != null) {
    if (!isPlainObj(zoom.transform)) {
      errors.push("zoom.transform: must be an object { k, tx, ty }");
      return;
    }
    const t = zoom.transform;
    if (!isPositiveNum(t.k))  errors.push("zoom.transform.k: must be a positive finite number");
    if (!isFiniteNum(t.tx))   errors.push("zoom.transform.tx: must be a finite number");
    if (!isFiniteNum(t.ty))   errors.push("zoom.transform.ty: must be a finite number");

    // maxZoom guard
    const maxZoom = chart?.maxZoom;
    if (isPositiveNum(t.k) && isPositiveNum(maxZoom) && t.k > maxZoom) {
      warnings.push(
        `zoom.transform.k (${t.k.toFixed(2)}) exceeds chart.maxZoom (${maxZoom}). ` +
        `The first user gesture will snap — raise maxZoom or reduce the zoom level.`,
      );
    }
    return;
  }

  // ── Domain zoom ───────────────────────────────────────────────────────────
  if (zoom.x != null) {
    if (!isNumArr2(zoom.x))
      errors.push("zoom.x: must be [number, number]");
    else if (zoom.x[0] >= zoom.x[1])
      errors.push("zoom.x: first value must be strictly less than second");
  }
  if (zoom.y != null) {
    if (!isNumArr2(zoom.y))
      errors.push("zoom.y: must be [number, number]");
    else if (zoom.y[0] >= zoom.y[1])
      errors.push("zoom.y: first value must be strictly less than second");
  }
  if (zoom.x == null && zoom.y == null) {
    warnings.push("zoom has no .x, .y, or .transform — treated as a full reset");
  }

  // maxZoom-vs-zoom trap (requires data to compute implied k)
  const maxZoom = chart?.maxZoom;
  if (isPositiveNum(maxZoom) && isNumArr2(zoom.x) && zoom.x[0] < zoom.x[1] && data?.length) {
    const xs = data.map((d) => parseFloat(d.name)).filter(isFinite);
    if (xs.length >= 2) {
      const fullSpan = Math.max(...xs) - Math.min(...xs);
      const zoomSpan = zoom.x[1] - zoom.x[0];
      if (zoomSpan > 0) {
        const impliedK = fullSpan / zoomSpan;
        if (impliedK > maxZoom) {
          warnings.push(
            `zoom.x [${zoom.x}] implies k ≈ ${impliedK.toFixed(1)}, which exceeds ` +
            `chart.maxZoom (${maxZoom}). The first user gesture will snap to maxZoom. ` +
            `Widen zoom.x or raise chart.maxZoom to at least ${Math.ceil(impliedK)}.`,
          );
        }
        // Also warn when zoom.x extends outside the data range
        const dataMin = Math.min(...xs);
        const dataMax = Math.max(...xs);
        if (zoom.x[0] < dataMin || zoom.x[1] > dataMax) {
          warnings.push(
            `zoom.x [${zoom.x}] extends outside the data x-range ` +
            `[${dataMin}, ${dataMax}] — axis will show empty space.`,
          );
        }
      }
    }
  }
}

function validateNarration(narration, errors, warnings) {
  if (narration == null) return;
  if (!isPlainObj(narration)) {
    errors.push("narration: must be an object or null");
    return;
  }
  if (narration.text != null && !isStr(narration.text))
    errors.push("narration.text: must be a string");
  if (narration.holdMs != null && !isNonNegNum(narration.holdMs))
    errors.push("narration.holdMs: must be a non-negative number (ms)");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Validate one scene object. Never throws.
 *
 * @param {unknown} scene
 * @param {{ data?: Array }} [opts]
 *   data — the resolved dataset array, used for the maxZoom-vs-zoom range check.
 *   When omitted the check is skipped (shape validation still runs).
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateScene(scene, opts = {}) {
  const errors   = [];
  const warnings = [];

  if (!isPlainObj(scene)) {
    return { valid: false, errors: ["scene must be a plain object"], warnings };
  }

  const s = /** @type {any} */ (scene);

  // ── Top-level fields
  if (s.version != null && s.version !== 1)
    errors.push(`scene.version: expected 1, got ${JSON.stringify(s.version)}`);
  if (s.id      != null && !isStr(s.id))
    errors.push("scene.id: must be a string");
  if (s.title   != null && !isStr(s.title))
    warnings.push("scene.title: expected string");
  if (s.dataset != null && !isStr(s.dataset))
    errors.push("scene.dataset: must be a string");

  validateChart(s.chart, errors, warnings);

  if (s.series != null) {
    if (!Array.isArray(s.series))
      errors.push("scene.series: must be an array");
    else
      s.series.forEach((item, i) => validateSeriesItem(item, i, errors, warnings));
  }

  if (s.areas != null) {
    if (!Array.isArray(s.areas))
      errors.push("scene.areas: must be an array");
    else
      s.areas.forEach((item, i) => validateArea(item, i, errors, warnings));
  }

  if (s.refAreas != null) {
    if (!Array.isArray(s.refAreas))
      errors.push("scene.refAreas: must be an array");
    else
      s.refAreas.forEach((item, i) => validateRefArea(item, i, errors, warnings));
  }

  if (s.refLines != null) {
    if (!Array.isArray(s.refLines))
      errors.push("scene.refLines: must be an array");
    else
      s.refLines.forEach((item, i) => validateRefLine(item, i, errors, warnings));
  }

  validateZoom(s.zoom, s.chart, opts.data, errors, warnings);
  validateNarration(s.narration, errors, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Return a new scene with defaults from SuperLineChart.defaults.js merged in.
 * Input is never mutated. Unknown extra fields pass through unchanged.
 *
 * The main use-cases are:
 *   - Normalising a partial scene before display in the editor.
 *   - Building the "current resolved scene" object for agent context.
 *   - Feeding into validateScene so checks run against filled-in values.
 *
 * Note: SuperLineChart itself applies the same defaults internally, so calling
 * this before rendering is optional. It is NOT lossless for series items that
 * omit `stroke` — the returned object will contain an explicit `stroke` object
 * that was not in the original.
 *
 * @param {Record<string, any>} scene  A (possibly partial) scene object.
 * @returns {Record<string, any>}      New scene with defaults applied.
 */
export function withSceneDefaults(scene) {
  const s = isPlainObj(scene) ? /** @type {any} */ (scene) : {};

  const chart = {
    duration:     CD.duration,
    ease:         CD.ease,
    curve:        CD.curve,
    ghostOpacity: CD.ghostOpacity,
    ...(isPlainObj(s.chart) ? s.chart : {}),
  };

  const series = Array.isArray(s.series)
    ? s.series.map((item) => {
        if (!isPlainObj(item)) return item;
        const stroke = { ...SSD, ...(isPlainObj(item.stroke) ? item.stroke : {}) };
        const band   = isPlainObj(item.band)
          ? { opacity: SUPER_BAND_DEFAULTS.opacity, ...item.band }
          : item.band ?? null;
        return { ...item, stroke, band };
      })
    : (s.series ?? []);

  return {
    version: 1,
    ...s,
    chart,
    series,
  };
}

/**
 * Validate a story object (`{ version, title?, scenes: Scene[] }`).
 * Errors from individual scenes are prefixed with their index.
 *
 * @param {unknown} story
 * @param {{ data?: Array }} [opts]  Passed through to each scene's validation.
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateStory(story, opts = {}) {
  const errors   = [];
  const warnings = [];

  if (!isPlainObj(story)) {
    return { valid: false, errors: ["story must be a plain object"], warnings };
  }

  const st = /** @type {any} */ (story);

  if (st.version != null && st.version !== 1)
    errors.push(`story.version: expected 1, got ${JSON.stringify(st.version)}`);
  if (st.title != null && !isStr(st.title))
    warnings.push("story.title: expected string");

  if (!Array.isArray(st.scenes)) {
    errors.push("story.scenes: required, must be an array of scene objects");
  } else if (st.scenes.length === 0) {
    warnings.push("story.scenes is empty — nothing to play");
  } else {
    st.scenes.forEach((scene, i) => {
      const r = validateScene(scene, opts);
      r.errors  .forEach((e) => errors  .push(`scenes[${i}]: ${e}`));
      r.warnings.forEach((w) => warnings.push(`scenes[${i}]: ${w}`));
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}
