import * as d3 from "d3";

/**
 * Compute the padded pixel range [lo, hi] for a single axis request.
 * Returns null if the request is missing or degenerates to a zero-width
 * window.
 *
 * Works with any D3 scale type (linear, time, log, sqrt, pow) because the
 * conversion only uses scale(value) → pixel, not the scale's internals.
 */
function paddedPixelRange(scale, [dMin, dMax], padding) {
  if (!scale) return null;
  const a = scale(dMin);
  const b = scale(dMax);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (lo === hi) return null;
  if (padding > 0) {
    const pad = (hi - lo) * padding;
    return [lo - pad, hi + pad];
  }
  return [lo, hi];
}

/**
 * Convert a desired visible data-space domain [dMin, dMax] on a single axis
 * into the zoom factor (k) and translate (t) needed to make that domain fill
 * the scale's full range.
 *
 * Kept exported for callers that want per-axis math (e.g. layers that build
 * their own composite transforms).  For the standard "fit both axes" use
 * case prefer {@link domainToTransform}.
 *
 * @param {d3.Scale} scale    - The base (unzoomed) D3 scale for this axis.
 * @param {[any, any]} domain - [min, max] in data space (same units as scale domain).
 * @param {number} padding    - Fractional breathing room added on each side (0–1).
 * @returns {{ k: number, t: number }} Zoom factor and translate for this axis.
 */
export function domainAxisToTransform(scale, [dMin, dMax], padding = 0) {
  const px = paddedPixelRange(scale, [dMin, dMax], padding);
  if (!px) return { k: 1, t: 0 };
  const [r0, r1] = scale.range();
  const span = r1 - r0; // signed — positive for x (left → right), negative for y (top → bottom)
  const k    = span / (px[1] - px[0]) * (span < 0 ? -1 : 1); // keep k positive
  // Anchor whichever range endpoint matches the start of the scale range so
  // padded request maps to the full viewport.
  const t = (span >= 0)
    ? r0 - px[0] * k
    : r0 - px[1] * k;
  return { k, t };
}

/**
 * Build a full d3.ZoomTransform that zooms to the requested data-space domains.
 *
 * **Single-axis mode** — when only `x` (or only `y`) is supplied, the other
 * axis component is left at identity (k=1 for that axis, t=0).  Note that
 * d3-zoom transforms have a single k shared by both axes, so the unrequested
 * axis still gets multiplied by the same k as the requested one — this is
 * the well-known d3-zoom independence limitation.
 *
 * **Both-axes mode** — when both `x` AND `y` are supplied, the same single k
 * cannot exactly satisfy both requests simultaneously.  We follow the
 * fit-bounds rule used by map projections: pick the **less restrictive** k
 * (`min(k_x, k_y)`) so both requested windows remain fully visible.  The
 * axis whose k was chosen lands exactly at its requested window; the other
 * axis shows the requested window centered inside a slightly larger visible
 * range.
 *
 * @param {d3.Scale|null} xScale
 * @param {d3.Scale|null} yScale
 * @param {{ x?: [any,any], y?: [any,any], padding?: number }} opts
 * @returns {d3.ZoomTransform}
 */
export function domainToTransform(xScale, yScale, { x, y, padding = 0 } = {}) {
  const pxX = x ? paddedPixelRange(xScale, x, padding) : null;
  const pxY = y ? paddedPixelRange(yScale, y, padding) : null;

  // No request → identity.
  if (!pxX && !pxY) return d3.zoomIdentity;

  // Viewport dimensions in pixels (signed for y because the range is inverted).
  const xRange = xScale?.range?.();
  const yRange = yScale?.range?.();
  const plotW  = xRange ? Math.abs(xRange[1] - xRange[0]) : 0;
  const plotH  = yRange ? Math.abs(yRange[1] - yRange[0]) : 0;

  // Per-axis k that would fit the requested padded window exactly.
  const kX = (pxX && plotW > 0) ? plotW / (pxX[1] - pxX[0]) : Infinity;
  const kY = (pxY && plotH > 0) ? plotH / (pxY[1] - pxY[0]) : Infinity;

  // Both requested → pick the less restrictive (smaller) k so both fit.
  // One requested → use that axis's k.
  let k = Math.min(kX, kY);
  if (!Number.isFinite(k) || k <= 0) k = 1;

  // Translate each axis so the requested (padded) window is **centered** in
  // its viewport dimension.  This guarantees the request is visible even when
  // the chosen k is more relaxed than that axis's own k_*.  The axis whose k
  // was chosen ends up perfectly snapped to the edges; the other is centered
  // inside extra room.
  let tx = 0;
  let ty = 0;

  if (pxX && xRange) {
    const cx = (pxX[0] + pxX[1]) / 2;
    const viewportCx = (xRange[0] + xRange[1]) / 2;
    tx = viewportCx - cx * k;
  }
  if (pxY && yRange) {
    const cy = (pxY[0] + pxY[1]) / 2;
    const viewportCy = (yRange[0] + yRange[1]) / 2;
    ty = viewportCy - cy * k;
  }

  return d3.zoomIdentity.translate(tx, ty).scale(k);
}
