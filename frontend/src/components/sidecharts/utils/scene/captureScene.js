/**
 * captureScene — merge the live zoom domain into a scene and return a
 * self-contained, JSON-serializable snapshot.
 *
 * Usage (inside a Vue component):
 *
 *   const snapshot = captureScene(zoomState, props.scene);
 *   // snapshot is a plain object safe to JSON.stringify / localStorage
 *
 * @param {import("../../vue/composables/useChartZoom.js").ChartZoomState} zoomState
 *   A live useChartZoom() return value (or any object with .xDomain.value /
 *   .yDomain.value computed refs).
 * @param {Object} scene
 *   The reactive scene object from SuperChartEditor / SuperLineChart.
 * @returns {Object}  A deep-cloned snapshot with the current zoom merged in.
 */
export function captureScene(zoomState, scene) {
  const x = zoomState.xDomain?.value ?? null;
  const y = zoomState.yDomain?.value ?? null;
  const zoom = x ? { x, ...(y ? { y } : {}) } : null;

  // Deep-clone via JSON round-trip.  ±Infinity appears in forceY / y1 / y2 so
  // we encode them as sentinel strings and revive them on the way back.
  return JSON.parse(
    JSON.stringify({ ...scene, zoom }, _replacer),
    _reviver,
  );
}

// ─── ±Infinity codec ──────────────────────────────────────────────────────────

const INF  = "__Infinity__";
const NINF = "__-Infinity__";

function _replacer(_k, v) {
  if (v === Infinity)  return INF;
  if (v === -Infinity) return NINF;
  return v;
}

function _reviver(_k, v) {
  if (v === INF)  return Infinity;
  if (v === NINF) return -Infinity;
  return v;
}

/**
 * Serialize a scene (or any object) to a JSON string, encoding ±Infinity as
 * readable sentinel strings so the output can be stored / transmitted and later
 * reconstructed with `deserializeScene`.
 */
export function serializeScene(scene) {
  return JSON.stringify(scene, _replacer, 2);
}

/**
 * Parse a scene string produced by `serializeScene` (or hand-authored JSON)
 * back into a plain object, reviving ±Infinity sentinels.
 */
export function deserializeScene(json) {
  return JSON.parse(json, _reviver);
}
