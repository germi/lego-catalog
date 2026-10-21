import * as d3 from "d3";

/**
 * Compute a `zoomToDomain` request that fits a set of data points (selected by
 * id) into the viewport, with optional breathing room.
 *
 * Pure data math — no canvas / scale internals. The bounding-box → transform
 * work (scale-agnostic projection, fit-bounds, padding, reactive-safe deferral)
 * lives in BaseCanvas.zoomToDomain; this only turns `ids` into the data-space
 * window to hand it. Pair it with a preset's `zoomToIds` wrapper, which already
 * knows the chart's `data` + accessors.
 *
 * @param {Array}    data  full data array
 * @param {Array|Set} ids  ids to fit
 * @param {Object}   [opts]
 * @param {Function} [opts.xAccessor=(d)=>d.x]
 * @param {Function} [opts.yAccessor=(d)=>d.y]
 * @param {Function} [opts.idAccessor=(d)=>d.id]
 * @param {number}   [opts.scale=0.95] fraction of the viewport the points should
 *                   fill → converted to `padding = (1/scale - 1) / 2` per side.
 * @param {string}   [opts.axes="xy"]  which axes to fit: "x", "y", or "xy".
 * @param {number}   [opts.singlePointZoom=0.1] when the selection is a single
 *                   point (or colinear on an axis) the window degenerates to
 *                   zero width; synthesize one sized as this fraction of the
 *                   FULL data extent on that axis so the zoom level stays sane.
 * @param {number|{x?:number,y?:number}} [opts.minSpan=0] floor on the window
 *                   span, as a fraction of the FULL data extent on that axis, so
 *                   a tight cluster doesn't over-zoom. e.g. `0.25` (or
 *                   `{ x:0.25, y:0.25 }`) = "never zoom tighter than a quarter of
 *                   the data range". Only widens (around the centre) when the
 *                   selection is narrower than the floor; wider selections are
 *                   untouched. 0 = off. Applied BEFORE the `scale` padding.
 * @param {boolean} [opts.xLog=false] x-axis is log-scaled. The `minSpan` floor
 *                   and degenerate/centred widening are then done in LOG space
 *                   (geometric) — a LINEAR floor balloons at the low end of a
 *                   log axis and can push an edge to ≤ 0 (NaN). `scale` padding
 *                   is unaffected (it happens later in pixel space).
 * @param {boolean} [opts.yLog=false] y-axis is log-scaled (same treatment).
 * @returns {{ x?: [any,any], y?: [any,any], padding: number } | null}
 *          A `zoomToDomain` argument, or null when nothing matched.
 */
export function idsToZoomDomain(data, ids, {
  xAccessor = (d) => d.x,
  yAccessor = (d) => d.y,
  idAccessor = (d) => d.id,
  scale = 0.95,
  axes = "xy",
  singlePointZoom = 0.1,
  minSpan = 0,
  xLog = false,
  yLog = false,
} = {}) {
  if (!Array.isArray(data) || !data.length || !ids?.length) return null;
  const idSet = ids instanceof Set ? ids : new Set(ids);
  const pts = data.filter((d) => idSet.has(idAccessor(d)));
  if (!pts.length) return null;

  // Per-axis minimum span (fraction of full extent). Accepts a number (both
  // axes) or { x, y }.
  const minSpanX = (minSpan && typeof minSpan === "object") ? (minSpan.x ?? 0) : minSpan;
  const minSpanY = (minSpan && typeof minSpan === "object") ? (minSpan.y ?? 0) : minSpan;

  // Window for one axis. d3.min/max skip null/undefined/NaN and keep the
  // original value type when no flooring is needed (so Dates / linear values
  // pass straight through to the scale). A selection narrower than the floor is
  // widened around its centre; the floor is the larger of `minSpan` (tight-
  // cluster guard) and, for a zero-span selection, `singlePointZoom` — both
  // fractions of the full data extent.
  //
  // On a LOG axis all of that math is done in log10 space (geometric), so the
  // floor is the same on-screen fraction at any position and the widening can
  // never produce an edge ≤ 0 (which would be NaN through a log scale). Falls
  // back to linear when the values aren't all positive.
  const axisWindow = (accessor, minSpanAxis, isLog) => {
    const lo = d3.min(pts, accessor);
    const hi = d3.max(pts, accessor);
    if (lo == null || hi == null) return undefined;

    const dataLo = +d3.min(data, accessor);
    const dataHi = +d3.max(data, accessor);
    const useLog = isLog && +lo > 0 && +hi > 0 && dataLo > 0 && dataHi > 0;
    const fwd = useLog ? Math.log10 : (v) => +v;
    const inv = useLog ? (v) => 10 ** v : (v) => v;

    const a = fwd(lo);
    const b = fwd(hi);
    const span = b - a;
    const fullExtent = (fwd(dataHi) - fwd(dataLo)) || 0;
    const floorFromMin  = minSpanAxis > 0 ? fullExtent * minSpanAxis : 0;
    const floorFromZero = span === 0
      ? (fullExtent * singlePointZoom) || (Math.abs(a) * singlePointZoom) || 1
      : 0;
    const floor = Math.max(floorFromMin, floorFromZero);
    if (floor > span) {
      const c = (a + b) / 2;
      return [inv(c - floor / 2), inv(c + floor / 2)];
    }
    return [lo, hi]; // already wider than the floor → keep original types/values
  };

  const x = axes.includes("x") ? axisWindow(xAccessor, minSpanX, xLog) : undefined;
  const y = axes.includes("y") ? axisWindow(yAccessor, minSpanY, yLog) : undefined;
  if (!x && !y) return null;

  const padding = scale > 0 && scale < 1 ? (1 / scale - 1) / 2 : 0;
  return { x, y, padding };
}
