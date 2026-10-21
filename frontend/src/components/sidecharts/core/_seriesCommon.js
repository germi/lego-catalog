/**
 * Shared helpers for series-style layers (LineLayer, AreaLayer).
 *
 * Both layers consume data of shape `[{ id, name, values: { key: { value } } }]`,
 * build a categorical x-scale, optionally d3.stack the values, and render
 * one path per series.  Everything in this module is pure — no DOM, no state.
 */
import * as d3 from "d3";
import { buildScale } from "../utils/scale/buildScale.js";

export function resolveCurve(curve) {
  if (typeof curve === "function") return curve;
  return d3[curve] ?? d3.curveLinear;
}

export function resolveKeys(data, propsKeys) {
  if (propsKeys?.length) return propsKeys;
  return data.length ? Object.keys(data[0].values) : [];
}

/**
 * Flatten `{ values: { key: { value } } }` onto the root as `{ key: value }`
 * so that d3.stack() can read it directly.
 */
export function flattenData(data) {
  return data.map((d) => {
    const out = { ...d };
    Object.keys(d.values).forEach((k) => { out[k] = d.values[k].value; });
    return out;
  });
}

/**
 * d3.stack(keys)(flat data), then optionally unstack each entry so y0=0 and
 * y1=originalValue (or null if originalValue was null).  Returns the d3.stack
 * series array shape — `[{ key, …, [{ data, 0, 1 }, …] }, …]`.
 */
export function buildStackedSeries(data, keys, stacked) {
  if (!data.length || !keys.length) return [];
  const flat = flattenData(data);
  const series = d3.stack().keys(keys)(flat);
  if (!stacked) {
    series.forEach((s) => s.forEach((e) => {
      const v = e.data[s.key];
      if (v == null) { e[0] = 0; e[1] = null; }
      else            { e[0] = 0; e[1] = v;    }
    }));
  }
  return series;
}

/**
 * Read the continuous x-value for one datum.  By default `name` is parsed —
 * as a Date for time scales, as a number otherwise.  Callers can override
 * with `xAccessor: (datum) => number | Date`.
 */
export function xValueFor(datum, props) {
  if (props.xAccessor) return props.xAccessor(datum);
  if (props.xScaleType === "time") {
    const parse = props.parseTime ?? ((name) => new Date(String(name)));
    return parse(datum.name);
  }
  return +datum.name;
}

/**
 * Continuous x-scale built from `data`'s xValue extent.  Supports
 * "linear" (default), "time", "log", "sqrt", "pow".  No categorical
 * scales — line / area charts are continuous by nature.
 */
export function buildXScale(data, range, props) {
  const type = props.xScaleType ?? "linear";
  const xs = data.map((d) => xValueFor(d, props));
  const domain = [d3.min(xs), d3.max(xs)];

  if (type === "time") {
    return d3.scaleTime().domain(domain).range(range);
  }
  return buildScale({ type, domain, range, nice: false });
}

/**
 * "Phase scale" for the three-phase choreography.  Continuous scales
 * extrapolate natively — x(value) returns positions outside `range` for
 * values outside the domain — so all we have to do is build a regular
 * scale on `coreData`.  Padding ids from `allData` that fall outside
 * `coreData`'s domain get extrapolated positions automatically.
 *
 * `allData` is accepted for API symmetry with the choreography call sites
 * but not used directly.
 */
// eslint-disable-next-line no-unused-vars
export function buildExtrapolatedXScale(coreData, allData, range, props) {
  return buildXScale(coreData, range, props);
}

/**
 * Screen x for a series entry.  Series entries from d3.stack (and our
 * band-series wrapper) carry `.data` — the original datum — which we feed
 * through `xValueFor` and then through the continuous scale.
 */
export function xPositionFor(d, x, props) {
  return x(xValueFor(d.data, props));
}

export function computeYDomain(series, props) {
  const vals = [];
  series.forEach((s) => s.forEach((e) => {
    if (e[0] != null && isFinite(e[0])) vals.push(e[0]);
    if (e[1] != null && isFinite(e[1])) vals.push(e[1]);
  }));
  if (props.forceValues != null) {
    if (Array.isArray(props.forceValues)) vals.push(...props.forceValues);
    else                                  vals.push(props.forceValues);
  }
  if (!vals.length) vals.push(0, 1);
  const min = Math.min(...vals);
  const max = props.max ?? Math.max(...vals);
  return [Math.min(0, min), max];
}

export function buildYScale(series, innerHeight, props) {
  // Prefer an explicit yDomain over the series-based computation — chart
  // presets typically pass one so sibling layers share the same y space.
  const domain = props.yDomain ?? computeYDomain(series, props);
  return buildScale({
    type:   props.scaleType ?? "linear",
    domain,
    range:  [innerHeight, 0],
    nice:   true,
  });
}

/**
 * Compute the union y-domain across every value in `data.values`, regardless
 * of which keys a particular layer plans to render.  Used by LineChart /
 * AreaChart presets to derive a shared scale that all slotted layers (line,
 * band, etc.) can lock onto.
 *
 * When `stacked` is true, the top of the domain is the maximum per-row sum
 * across `keys` (the actual stack height), not the maximum single value.
 * Negative singletons still pull the min below zero so a partly-negative
 * series doesn't get clipped.
 */
export function computeFullYDomain(data, props = {}) {
  const stacked = !!props.stacked;
  const keys = (props.keys && props.keys.length)
    ? props.keys
    : (data[0]?.values ? Object.keys(data[0].values) : []);

  const vals = [];
  for (const d of data) {
    if (!d?.values) continue;
    if (stacked) {
      let sum = 0;
      let any = false;
      for (const k of keys) {
        const v = d.values[k]?.value;
        if (v != null && isFinite(v) && v > 0) { sum += v; any = true; }
      }
      if (any) vals.push(sum);
    }
    // Always push raw values too — covers the non-stacked case AND lets
    // negative values pull the min below zero even when stacking.
    for (const k of keys) {
      const v = d.values[k]?.value;
      if (v != null && isFinite(v)) vals.push(v);
    }
  }

  if (props.forceValues != null) {
    if (Array.isArray(props.forceValues)) vals.push(...props.forceValues);
    else                                  vals.push(props.forceValues);
  }
  if (!vals.length) return [0, 1];
  const min = Math.min(...vals);
  const max = props.max ?? Math.max(...vals);
  return [Math.min(0, min), max];
}

export function innerDimensions(payload, props) {
  const m = props.margin;
  const p = props.padding;
  return {
    innerWidth:  payload.width  - m.left - m.right  - p.left - p.right,
    innerHeight: payload.height - m.top  - m.bottom - p.top  - p.bottom,
  };
}

export function xRangeFromZoom(innerWidth, activeZoomTransform) {
  if (!activeZoomTransform) return [0, innerWidth];
  return [activeZoomTransform.applyX(0), activeZoomTransform.applyX(innerWidth)];
}

export function idsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Apply a d3.zoomTransform to a pair of x/y scales according to the
 * canvas's `zoomAxes` setting ("xy" | "x" | "y" | "none").  Returns a
 * fresh `{ x, y }` object where each scale is either the original or a
 * `transform.rescaleX/Y(scale)` copy.
 *
 * Layers call this so the same `zoomAxes` declaration on the BaseCanvas
 * automatically governs every cartesian layer's zoom behaviour.
 */
export function applyZoomToScales(xScale, yScale, transform, zoomAxes = "xy") {
  if (!transform || zoomAxes === "none") return { x: xScale, y: yScale };
  const wantX = zoomAxes === "xy" || zoomAxes === "x";
  const wantY = zoomAxes === "xy" || zoomAxes === "y";
  return {
    x: wantX ? transform.rescaleX(xScale) : xScale,
    y: wantY ? transform.rescaleY(yScale) : yScale,
  };
}
