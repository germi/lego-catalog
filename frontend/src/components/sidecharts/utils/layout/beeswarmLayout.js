import { AccurateBeeswarm } from "./accurateBeeswarm.js";

/**
 * Value-pinned beeswarm dodge — the SAME algorithm the legacy standalone
 * BeeswarmChart used: AccurateBeeswarm (accurate-beeswarm-plot, MIT). It's a
 * deterministic, guaranteed-no-overlap packer (see ./accurateBeeswarm.js).
 *
 * Each datum is pinned to its ALONG-AXIS pixel (`along(d)`) and the rest are
 * spread PERPENDICULAR; we return the perpendicular pixel per datum (input order).
 * Orientation-agnostic — the caller maps [along, perp] to screen axes. Static:
 * compute once per data/size/dims change and hand the result to a plain
 * ScatterLayer (positions come from an accessor).
 *
 * Variable radius (size-by-value): AccurateBeeswarm packs with a single UNIFORM
 * radius, so we pack at the LARGEST radius in the data. That keeps the no-overlap
 * guarantee for every circle (a smaller circle just gets extra breathing room) —
 * dense columns still never collide, they only grow taller.
 *
 * @param {Array}    data
 * @param {Object}   opts
 * @param {Function} opts.along   `(d) => alongAxisPixel` (e.g. `valueScale(value)`)
 * @param {number|Function} opts.radius  dot radius px (number or `(d) => px`)
 * @param {number}   [opts.center=0] perpendicular centre px (e.g. innerHeight/2)
 * @param {number}   [opts.gap=1]    extra px kept between circle EDGES
 * @returns {number[]} perpendicular pixel per datum (input order)
 */
export function beeswarmLayout(data, { along, radius, center = 0, gap = 1 } = {}) {
  if (!data?.length) return [];
  const rOf = typeof radius === "function" ? radius : () => radius;

  // Uniform pack radius = the largest dot radius, + half the gap so `gap` is kept
  // between circle EDGES (AccurateBeeswarm enforces a min centre distance of 2*r).
  let maxR = 0;
  for (const d of data) {
    const r = +rOf(d) || 0;
    if (r > maxR) maxR = r;
  }
  const packRadius = maxR + gap / 2;

  const positions = new AccurateBeeswarm(data, packRadius, (d) => +along(d))
    .withTiesBrokenRandomly()
    .calculateYPositions(); // returned in original input order

  return positions.map((p) => center + p.y);
}
