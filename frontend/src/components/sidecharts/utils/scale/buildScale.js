import * as d3 from "d3";

const FACTORIES = {
  linear: () => d3.scaleLinear(),
  sqrt:   () => d3.scaleSqrt(),
  log:    () => d3.scaleLog(),
  pow:    (exp) => d3.scalePow().exponent(exp),
  time:   () => d3.scaleTime(),
  band:   () => d3.scaleBand().padding(0.2),
  point:  () => d3.scalePoint().padding(0.5),
};

/**
 * Build a configured D3 scale.
 *
 * @param {object} opts
 * @param {string}  opts.type       "linear" | "sqrt" | "log" | "pow" | "time"  (default: "linear")
 * @param {Array}   opts.domain     e.g. [0, 500]
 * @param {Array}   opts.range      e.g. [innerHeight, 0] or [innerR, outerR]
 * @param {boolean} [opts.nice]     call .nice() after domain (default: false)
 * @param {number}  [opts.exponent] exponent for "pow" scale (default: 2)
 * @returns {d3.Scale}
 */
const ORDINAL_TYPES = new Set(["band", "point"]);

export function buildScale({ type = "linear", domain, range, nice = false, exponent = 2 } = {}) {
  const factory = type === "pow"
    ? () => FACTORIES.pow(exponent)
    : (FACTORIES[type] ?? FACTORIES.linear);
  const scale = factory();
  scale.domain(domain).range(range);
  if (nice && !ORDINAL_TYPES.has(type)) scale.nice();
  return scale;
}
