import * as d3 from "d3";
import { buildScale } from "../scale/buildScale.js";

/**
 * Creates a Projector wrapping D3 x/y scales.  Always returns a ready-to-use
 * projector — scales are built eagerly from the data + dimensions you pass in.
 * There is no `fit()` method; if data or dimensions change, build a new
 * projector (typically via a Vue `computed()` or React `useMemo()`).
 *
 * @param {Object}   options
 * @param {Array}    options.data           - the data array (used to compute scale domains when no override is given)
 * @param {number}   options.width          - inner SVG width (range for xScale)
 * @param {number}   options.height         - inner SVG height (range for yScale, inverted)
 * @param {Function} [options.xAccessor]    - (d) => xValue   (default: d => d.x)
 * @param {Function} [options.yAccessor]    - (d) => yValue   (default: d => d.y)
 * @param {string}   [options.xScaleType]   - d3 scale type   (default: "linear")
 * @param {string}   [options.yScaleType]   - d3 scale type   (default: "linear")
 * @param {boolean}  [options.nice]         - shorthand: nice both axes (default: true)
 * @param {boolean}  [options.xNice]        - override `nice` for the x-scale only
 * @param {boolean}  [options.yNice]        - override `nice` for the y-scale only
 *
 * Multi-series / explicit-domain overrides (used by cartesian chart presets
 * whose y-domain is the union across several keys):
 * @param {Array}    [options.xDomain]      - [min, max] overrides accessor-based extent
 * @param {Array}    [options.yDomain]      - [min, max] overrides accessor-based extent
 *
 * Pre-configured scale instances — when provided, the projector copies the
 * scale, sets its range from inner dimensions, and uses it directly.
 * `xScaleType`, `xDomain`, and `nice` are ignored for that axis:
 * @param {d3.Scale} [options.xScale]       - fully configured D3 scale (domain set by caller)
 * @param {d3.Scale} [options.yScale]       - fully configured D3 scale (domain set by caller)
 *
 * Inner-area padding folded into the scale range — lets a chart preset
 * "inset" its plot area without applying a separate `padding` translate at
 * the layer level:
 * @param {Object}   [options.rangePad]     - {left, right, top, bottom} in px (default: 0/0/0/0)
 *
 * @returns {Projector|null} - { type: "scale", fn, invert, raw } or null if not enough info.
 *
 * Projector interface:
 *   type    — "scale"
 *   fn(d)   — (d) => [svgX, svgY] | null
 *   invert  — ([x,y]) => [xValue, yValue] | null
 *   raw     — { xScale, yScale }
 */
export function makeScaleProjector({
  data,
  width,
  height,
  xAccessor  = (d) => d.x,
  yAccessor  = (d) => d.y,
  xScaleType = "linear",
  yScaleType = "linear",
  nice       = true,
  xNice,
  yNice,
  xDomain    = null,
  yDomain    = null,
  xScale     = null,
  yScale     = null,
  rangePad   = null,
  rtl        = false,
} = {}) {
  const niceX = xNice ?? nice;
  const niceY = yNice ?? nice;
  if (!width || !height) return null;
  // Data is only needed when we must derive a domain from it.
  if (!xScale && !xDomain && !data?.length) return null;
  if (!yScale && !yDomain && !data?.length) return null;

  const pad = {
    left:   rangePad?.left   ?? 0,
    right:  rangePad?.right  ?? 0,
    top:    rangePad?.top    ?? 0,
    bottom: rangePad?.bottom ?? 0,
  };

  const ORDINAL = new Set(["band", "point"]);

  // Build or clone+rerange a scale for one axis.
  // When rtl=true on the x axis, continuous scales reverse their range so that
  // large values map to the left pixel edge (standard d3 range reversal).
  // Band/point scales do NOT reverse here — the preset reverses the data array
  // instead, which keeps link-edge calculations correct (links always connect the
  // inner physical edges of adjacent bars regardless of reading direction).
  function resolveAxis({ instance, scaleType, domain, accessor, range, niceIt, rtl: axisRtl }) {
    const isBand = instance ? !!instance.bandwidth : ORDINAL.has(scaleType);
    const effectiveRange = (axisRtl && !isBand) ? [range[1], range[0]] : range;

    if (instance) {
      return instance.copy().range(effectiveRange);
    }
    const resolvedDomain = domain
      ?? (isBand ? [...new Set(data.map(accessor))] : d3.extent(data, accessor));
    return buildScale({ type: scaleType, domain: resolvedDomain, range: effectiveRange, nice: niceIt });
  }

  const xScaleRaw = resolveAxis({
    instance:  xScale,
    scaleType: xScaleType,
    domain:    xDomain,
    accessor:  xAccessor,
    range:     [pad.left, width - pad.right],
    niceIt:    niceX,
    rtl,
  });
  const yScaleRaw = resolveAxis({
    instance:  yScale,
    scaleType: yScaleType,
    domain:    yDomain,
    accessor:  yAccessor,
    range:     [height - pad.bottom, pad.top],
    niceIt:    niceY,
    rtl:       false, // y axis is never reversed
  });

  // For band/point scales, expose a centered wrapper so all layers (scatter,
  // arc, etc.) get mid-band positions without special-casing scale type.
  const xScaleFinal = xScaleRaw.bandwidth
    ? Object.assign((v) => xScaleRaw(v) + xScaleRaw.bandwidth() / 2, xScaleRaw)
    : xScaleRaw;
  const yScaleFinal = yScaleRaw.bandwidth
    ? Object.assign((v) => yScaleRaw(v) + yScaleRaw.bandwidth() / 2, yScaleRaw)
    : yScaleRaw;

  return {
    type: "scale",

    // Whether this projector is RTL. For continuous x scales RTL also reverses
    // the pixel range, but for BAND/point scales the range stays ascending (the
    // preset reverses the data array instead) — so a slotted layer can't infer
    // RTL from the range alone. This flag is the reliable signal.
    rtl,

    fn(d) {
      const x = xScaleFinal(xAccessor(d));
      const y = yScaleFinal(yAccessor(d));
      if (!isFinite(x) || !isFinite(y)) return null;
      return [x, y];
    },

    invert([sx, sy]) {
      return [
        xScaleRaw.invert ? xScaleRaw.invert(sx) : null,
        yScaleRaw.invert ? yScaleRaw.invert(sy) : null,
      ];
    },

    // Expose the data accessors so a layer can pair the projector's own
    // x/y value-extraction with the canvas's LIVE zoomed scales
    // (`payload.xScale` / `payload.yScale`) instead of the raw scales baked
    // into `fn`. Without this a scatter layer that doesn't get a separate
    // `coordAccessor` would have to fall back to `fn` (raw, unzoomed) and
    // its dots wouldn't follow zoom.
    xAccessor,
    yAccessor,

    raw: {
      xScale: xScaleFinal,
      yScale: yScaleFinal,
      // Un-centered band/point scales — x(v) returns the band's LEFT EDGE
      // (standard d3), for bar/ribbon layers that position from the edge plus
      // bandwidth(). Identical to xScale/yScale for continuous scales, where no
      // centering wrapper is applied. Point / line / scatter layers keep using
      // the centered xScale/yScale; BaseCanvas zooms both and exposes the
      // uncentered ones as payload.xScaleUncentered / yScaleUncentered.
      xScaleUncentered: xScaleRaw,
      yScaleUncentered: yScaleRaw,
    },
  };
}
