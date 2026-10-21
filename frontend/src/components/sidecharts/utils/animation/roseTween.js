import * as d3 from "d3";

/**
 * Rescales all numeric fields in a data object when the pie's total value changes.
 * This ensures d3.interpolate correctly animates every radius-driving property
 * (value, min, max, aValue, bMin, etc.), not just `value`.
 */
function rescaleData(data, oldMax, newMax) {
  if (oldMax === newMax || oldMax === 0) return;
  const scale = d3.scaleLinear().range([0, newMax]).domain([0, oldMax]);
  for (const k in data) {
    if (typeof data[k] === "number") {
      data[k] = scale(data[k]);
    } else if (
      data[k] !== null &&
      typeof data[k] === "object" &&
      !Array.isArray(data[k])
    ) {
      rescaleData(data[k], oldMax, newMax);
    }
  }
}

/**
 * Returns a D3 attrTween function for animating arc path transitions.
 *
 * @param {Function} arcGeneratorFn - a d3.arc() instance
 */
export function makeTween(arcGeneratorFn) {
  return function arcTween(a) {
    const i = d3.interpolate(this._current, a);
    this._current = i(0);
    // Stamp destination pixel radii so that a subsequent draw (or unmount)
    // starts the next tween from the correct position rather than from where
    // the previous tween began.
    if (a.data?._innerR !== undefined)
      this._current.data._innerR = a.data._innerR;
    if (a.data?._outerR !== undefined)
      this._current.data._outerR = a.data._outerR;
    return (t) => arcGeneratorFn(i(t));
  };
}

/**
 * Returns a D3 attrTween function for animating text element positions via translate.
 *
 * @param {Function} centroidFn - function(d) => [x, y]
 */
/**
 * Zero all numeric data fields so d3.interpolate animates every radius-driving
 * property from 0, not just `value`. Preserves non-numeric fields (id, name, color…).
 */
export function zeroedData(data) {
  const out = {};
  for (const k in data) {
    const v = data[k];
    if (typeof v === "number") {
      out[k] = 0;
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = zeroedData(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Returns a D3 attrTween callback that interpolates only ONE dimension of the arc,
 * freezing the other. Used for phased animation where radii and angles must animate
 * in separate sequential transitions.
 *
 * @param {Function} arcFn - a d3.arc() instance
 * @param {Object} options
 * @param {"data"|"layout"} options.dimension - which dimension to animate this phase
 * @param {"radius"|"angle"|"angle-precomputed"} options.mode - chart mode
 */
export function makePartialTween(arcFn, { dimension, mode } = {}) {
  return function partialArcTween(target) {
    const current = this._current;
    let mid;

    if (mode === "radius") {
      if (dimension === "data") {
        // Phase 1 (exit path): animate radii, freeze angles at current values.
        mid = {
          ...target,
          startAngle: current.startAngle,
          endAngle: current.endAngle,
        };
      } else if (dimension === "angles") {
        // Phase 1 (enter-only path): animate angles, freeze radii at current values.
        // Used when there are no exits: angles rearrange first at the old scale,
        // then radii update simultaneously with the entering arcs.
        mid = {
          ...target,
          data: {
            ...target.data,
            _innerR: current.data._innerR,
            _outerR: current.data._outerR,
          },
        };
      } else {
        // Phase 2: animate remaining dimension to target (radii after angles, or angles after radii).
        mid = { ...target };
      }
    } else if (mode === "angle") {
      if (dimension === "data") {
        // Phase 1: animate angles, freeze radii at current ring position.
        mid = {
          ...target,
          data: {
            ...target.data,
            _innerR: current.data._innerR,
            _outerR: current.data._outerR,
          },
        };
      } else {
        // Phase 2: animate radii to new ring positions, angles already at target.
        mid = { ...target };
      }
    } else {
      mid = { ...target };
    }

    const i = d3.interpolate(current, mid);
    // Break the data reference: mid.data === target.data (shallow spread), so if a
    // subsequent draw's exit handler mutates d.data._outerR the shared reference would
    // corrupt this._current's start state, causing instant (zero-visual-delta) exits.
    this._current = { ...mid, data: { ...mid.data } };
    return (t) => arcFn(i(t));
  };
}

export function makeTextPositionTween(centroidFn) {
  return function textPositionTween(d) {
    this._current = this._current || d;
    rescaleData(this._current.data, this._current.value, d.value);
    const i = d3.interpolate(this._current, d);
    this._current = i(0);
    this._current.value = d.value;
    return (t) => `translate(${centroidFn(i(t))})`;
  };
}
