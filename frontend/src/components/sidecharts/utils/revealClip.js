import * as d3 from "d3";

/**
 * Ensure a `<clipPath><rect/></clipPath>` exists inside the given `<defs>`
 * selection, keyed by `clipId`.  Returns the `<rect>` d3 selection so the
 * caller can read or update its attributes.
 *
 * Idempotent: calling it twice with the same `clipId` returns the existing
 * `<rect>` without creating a duplicate.
 *
 * @param {d3.Selection} defsSel  - D3 selection wrapping the `<defs>` element.
 * @param {string}       clipId   - The `id` to assign to the `<clipPath>`.
 * @returns {d3.Selection} The `<rect>` inside the clip-path.
 */
export function ensureClipPath(defsSel, clipId) {
  let clip = defsSel.select(`#${clipId}`);
  if (clip.empty()) {
    clip = defsSel.append("clipPath").attr("id", clipId);
    clip.append("rect");
  }
  return clip.select("rect");
}

/**
 * Set or transition the reveal clip `<rect>` to the given geometry.
 *
 * Uses the named transition `"reveal"` so it never fights with the
 * three-phase choreography that animates the line / area paths on the
 * default unnamed transition.
 *
 * @param {d3.Selection} rectSel
 * @param {object}  opts
 * @param {number}  opts.x        - Left edge of the clip rect, in local coords.
 * @param {number}  opts.width    - Width of the clip rect (already clamped ≥ 0).
 * @param {number}  opts.y        - Top edge (may be negative when the plot area
 *                                  includes a top-margin region above y=0).
 * @param {number}  opts.height   - Full height of the clip rect.
 * @param {number}  [opts.duration=0]
 * @param {string}  [opts.ease]   - D3 ease name, e.g. `"easeCubic"`.  Falls back
 *                                  to `d3.easeCubic` when omitted or unknown.
 */
export function updateRevealRect(rectSel, { x, width, y, height, duration = 0, ease }) {
  if (duration > 0) {
    const easeFn = (ease && d3[ease]) ? d3[ease] : d3.easeCubic;
    rectSel
      .transition("reveal")
      .duration(duration)
      .ease(easeFn)
      .attr("x",      x)
      .attr("width",  width)
      .attr("y",      y)
      .attr("height", height);
  } else {
    rectSel
      .attr("x",      x)
      .attr("width",  width)
      .attr("y",      y)
      .attr("height", height);
  }
}

/**
 * Resolve the reveal boundary for one series key from a prop that accepts:
 *
 * - `null`     → no constraint on this side (the clip extends to ±∞ on this edge)
 * - `number`   → same constraint for every series
 * - `Object`   → per-key map; series not in the map fall through to `null`
 *
 * @param {null|number|Object} spec
 * @param {string}             seriesKey
 * @returns {number|null}
 */
export function resolveReveal(spec, seriesKey) {
  if (spec == null) return null;
  if (typeof spec === "number") return spec;
  if (typeof spec === "object") return spec[seriesKey] ?? null;
  return null;
}

/**
 * Compute the clip rect geometry for one series, given the current scales
 * and reveal props, then apply it to `rectSel`.
 *
 * The result rect is the intersection of the `plotBounds` (left/right plot
 * edges) and the reveal window.  When `debugClip` is false the plot-bounds
 * clamping is skipped so the line can bleed outside the plot area (this
 * matches the original `debugClip: false` behaviour for phase-A/B tails).
 *
 * @param {d3.Selection} rectSel        - The `<rect>` inside the clip-path.
 * @param {object}       opts
 * @param {number}       opts.plotLeft
 * @param {number}       opts.plotRight
 * @param {number}       opts.plotTop   - y attr of the rect (may be negative).
 * @param {number}       opts.plotHeight
 * @param {number|null}  opts.revealStart  - Data-space x or null.
 * @param {number|null}  opts.revealEnd    - Data-space x or null.
 * @param {Function}     opts.xScale       - Zoom-adjusted D3 scale.
 * @param {boolean}      [opts.debugClip=true] - When true, intersect with plot bounds.
 * @param {number}       [opts.duration=0]
 * @param {string}       [opts.ease]
 */
export function applyRevealClip(rectSel, {
  plotLeft, plotRight, plotTop, plotHeight,
  revealStart, revealEnd, xScale,
  debugClip = true,
  duration = 0,
  ease,
}) {
  // Baseline bounds: full plot area (debugClip) or unconstrained.
  const baseLeft  = debugClip ? plotLeft  : -Infinity;
  const baseRight = debugClip ? plotRight :  Infinity;

  // Screen coordinates of the reveal edges, in the rect's coordinate space.
  // `xScale` returns values in its own range [0, plotWidth] — to land in the
  // host group's coordinate system we offset by `plotLeft` (the left margin +
  // left padding of the plot area, minus any canvas-margin difference).
  const scaledLeft  = revealStart != null ? plotLeft + xScale(revealStart) : -Infinity;
  const scaledRight = revealEnd   != null ? plotLeft + xScale(revealEnd)   :  Infinity;

  // Intersection.
  const left  = Math.max(baseLeft,  scaledLeft);
  const right = Math.min(baseRight, scaledRight);

  updateRevealRect(rectSel, {
    x:      left,
    width:  Math.max(0, right - left),
    y:      plotTop,
    height: plotHeight,
    duration,
    ease,
  });
}
