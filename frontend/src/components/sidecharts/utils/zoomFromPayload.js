/**
 * Read the chart's current zoom transform off the draw payload.
 *
 * The canvas now stamps every `draw` event with `payload.zoomTransform`
 * (snapshot of d3-zoom's internal state at fire time).  A programmatic
 * zoom snaps the transform synchronously then fires one draw — layers
 * pick up the new transform here instead of waiting for a separate
 * per-frame onZoom event.
 *
 * Returns null when the transform is identity, so layer code can use
 * `if (activeZoomTransform)` as a "we are zoomed" check (matching the
 * convention every layer used pre-refactor).
 *
 * Layers call this at the top of `render(payload, props)`:
 *
 *   activeZoomTransform = zoomFromPayload(payload, activeZoomTransform);
 *
 * The `fallback` is the layer's last-known transform — used when the
 * payload doesn't have one (older code paths, or a draw fired before
 * the canvas finished initialising d3-zoom).
 *
 * @param {object} payload   The draw payload.
 * @param {object} fallback  The layer's existing activeZoomTransform.
 * @returns {object|null}    The transform to use for resolving scales.
 */
export function zoomFromPayload(payload, fallback = null) {
  const t = payload?.zoomTransform;
  if (!t) return fallback;
  return (t.k === 1 && t.x === 0 && t.y === 0) ? null : t;
}
