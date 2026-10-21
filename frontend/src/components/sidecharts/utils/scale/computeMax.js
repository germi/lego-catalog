import * as d3 from "d3";

/**
 * Derive the maximum value from ribbon/rose chart shaped data.
 *
 * data shape: Array<{ values: { [key]: { value: number } } }>
 *
 * @param {Array}  data
 * @param {object} opts
 * @param {number|null} [opts.max]     explicit cap — returned as-is when provided
 * @param {boolean}     [opts.stacked] sum all series per category (default: true)
 * @returns {number}
 */
export function computeMax(data, { max = null, stacked = true } = {}) {
  if (max !== null) return max;
  if (!data?.length) return 0;
  return stacked
    ? d3.max(data, (cat) => Object.values(cat.values).reduce((s, v) => s + v.value, 0)) ?? 0
    : d3.max(data.flatMap((cat) => Object.values(cat.values).map((v) => v.value))) ?? 0;
}
