/**
 * RefLineLayer — straight reference lines (horizontal / vertical / slanted /
 * rule-derived) drawn on top of a cartesian chart.
 *
 * Canvas-agnostic: reads x/y scales from `payload.projector` when the host
 * canvas exposes one (ScatterPlot's makeScaleProjector), or builds its own
 * scales from `props.data` + `props.yDomain` (LineChart / AreaChart slot).
 *
 * Each entry in `props.lines` must have a stable `id`.  The D3 join uses
 * the id as the key, so flipping a line from `{ y: 50 }` to `{ y: 30 }`
 * (same id) transitions the y attribute over `props.duration` instead of
 * removing and re-adding the element.
 *
 * Spec shapes:
 *   { id, y: <data-space y> }                       horizontal
 *   { id, x: <data-space x> }                       vertical
 *   { id, x1, y1, x2, y2 }                          slanted (two endpoints)
 *   { id, rule: "medianX" | "medianY" | "meanX" |
 *               "meanY"   | "regression" | fn }     computed each render
 *
 * Per-datum optional styling:
 *   color, dasharray, strokeWidth, opacity, label,
 *   labelColor, labelSize, labelDy, labelAlign
 */

import * as d3 from "d3";
import { createLayer } from "./layer.js";
import { buildScale } from "../utils/scale/buildScale.js";
import { resolveFill } from "../fill/resolveFill.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";
import { linearRegression } from "../utils/regression.js";
import { resolveEase } from "../utils/ease.js";

export const REF_LINE_LAYER_DEFAULTS = {
  lines:        [],
  data:         null,
  xAccessor:    (d) => d.x,
  yAccessor:    (d) => d.y,
  margin:       { top: 0, right: 0, bottom: 0, left: 0 },
  padding:      { top: 0, right: 0, bottom: 0, left: 0 },
  xScaleType:   "linear",
  yScaleType:   "linear",
  yDomain:      null,
  // Visual defaults — overridable per-datum
  color:        "currentColor",
  dasharray:    null,
  strokeWidth:  1,
  opacity:      1,
  // Label defaults
  labelColor:   "currentColor",
  labelSize:    10,
  labelDy:      -4,
  labelAlign:   "end",   // "start" | "middle" | "end" — placement along the line
  // Animation
  duration:     GLOBAL_DEFAULTS.duration,
  ease:         GLOBAL_DEFAULTS.ease,
};

// Build x/y scales from props.data when the host canvas doesn't expose a
// projector — used by tests / standalone usage.  Production charts
// (LineChart / AreaChart / ScatterPlot) supply a projector.
function buildScalesFromData(payload, props, m, p) {
  // Nothing to anchor to: the host exposes no projector (caller already tried),
  // and there's neither data nor an explicit yDomain to derive a scale from.
  // Bail rather than stamp lines against a guessed [0,1] domain — otherwise a
  // host's FIRST draw (before its projector is built — e.g. RibbonChart, whose
  // projector needs the measured canvas width + loaded data) renders the lines
  // far off-scale, and the real projector draw then violently transitions them
  // into place, shredding the enter fade. Returning null makes render() skip;
  // the lines first appear on the projector draw and enter cleanly.
  if (!props.data?.length && props.yDomain == null) {
    return { xScale: null, yScale: null };
  }

  const innerWidth  = Math.max(0, payload.width  - m.left - m.right  - p.left - p.right);
  const innerHeight = Math.max(0, payload.height - m.top  - m.bottom - p.top  - p.bottom);

  const data = props.data ?? [];
  const xAcc = props.xAccessor;
  const yAcc = props.yAccessor;

  const xs = data.map((d) => +xAcc(d)).filter(Number.isFinite);
  const xDomain = xs.length
    ? [Math.min(...xs), Math.max(...xs)]
    : [0, 1];
  const xScale = buildScale({
    type:   props.xScaleType ?? "linear",
    domain: xDomain,
    range:  [0, innerWidth],
    nice:   false,
  });

  let yDomain = props.yDomain;
  if (!yDomain) {
    const ys = data.map((d) => +yAcc(d)).filter(Number.isFinite);
    yDomain = ys.length
      ? [Math.min(...ys), Math.max(...ys)]
      : [0, 1];
  }
  const yScale = buildScale({
    type:   props.yScaleType ?? "linear",
    domain: yDomain,
    range:  [innerHeight, 0],
    nice:   true,
  });

  return { xScale, yScale, innerWidth, innerHeight, fromProjector: false };
}

// Resolves the scales we'll project rules through.  Canvas-rescaled
// scales come on the draw payload (`payload.xScale` / `payload.yScale`)
// so we use them as-is when the host canvas has a projector with raw
// scales.  Otherwise we fall back to building scales from data (only
// ever exercised when used outside a cartesian chart).
function resolveScales(payload, props, m, p) {
  if (payload.projector?.type === "scale" && payload.xScale && payload.yScale) {
    // innerWidth/innerHeight must be the UNZOOMED plot dimensions — they pin
    // full-width horizontal (and full-height vertical) rules. payload.xScale may
    // be zoomed, and for BAND scales the zoom is applied to the RANGE (it's
    // stretched), so read the projector's RAW (never-zoomed) scale range when
    // available; for continuous scales raw and zoomed ranges are identical.
    const rawX = payload.projector.raw?.xScale ?? payload.xScale;
    const rawY = payload.projector.raw?.yScale ?? payload.yScale;
    const xr = rawX.range();
    const yr = rawY.range();
    return {
      xScale: payload.xScale,
      yScale: payload.yScale,
      innerWidth:  Math.abs(xr[1] - xr[0]),
      innerHeight: Math.abs(yr[0] - yr[1]),
      // RTL signal: the projector knows directly. Band/point x scales keep an
      // ascending range under RTL (only the data array is reversed), so the
      // range-orientation heuristic in placeLabel misses them — read the flag.
      rtl: !!payload.projector.rtl,
      fromProjector: true,
    };
  }
  return buildScalesFromData(payload, props, m, p);
}

// Rule resolvers — turn `{ rule: ... }` into a concrete `{x|y|x1,y1,x2,y2}`.
function applyRule(spec, data, scales, xAcc, yAcc) {
  const rule = spec.rule;
  if (typeof rule === "function") return rule(data, scales);
  if (!data?.length) return null;

  switch (rule) {
    case "medianY": return { ...spec, y: d3.median(data, yAcc) };
    case "medianX": return { ...spec, x: d3.median(data, xAcc) };
    case "meanY":   return { ...spec, y: d3.mean(data, yAcc) };
    case "meanX":   return { ...spec, x: d3.mean(data, xAcc) };
    case "regression": {
      const r = linearRegression(data, {
        x: xAcc, y: yAcc, domain: scales.xScale.domain(),
      });
      if (!r.linePoints?.length) return null;
      // Multi-point sample so the line traces the actual regression curve
      // when projected through non-linear axes (log, pow, sqrt).
      return { ...spec, points: r.linePoints };
    }
    default: return null;
  }
}

// Normalise a user spec into either:
//   { id, kind: "line", x1, y1, x2, y2, …style }            2-point line
//   { id, kind: "path", points: [{x, y}, …], …style }       multi-point poly-line
// All coords in data space.  Horizontal rules pin to the plot's pixel width
// (full-width, zoom-stable); vertical rules fan out across the full y-domain.
function normalizeSpec(spec, scales, data, props) {
  if (!spec) return null;
  const r = spec.rule ? applyRule(spec, data, scales, props.xAccessor, props.yAccessor) : spec;
  if (!r) return null;

  const style = {
    color:        r.color       ?? props.color,
    dasharray:    r.dasharray   ?? props.dasharray,
    strokeWidth:  r.strokeWidth ?? props.strokeWidth,
    opacity:      r.opacity     ?? props.opacity,
    label:        r.label       ?? null,
    labelColor:   r.labelColor  ?? props.labelColor,
    labelSize:    r.labelSize   ?? props.labelSize,
    labelDy:      r.labelDy     ?? props.labelDy,
    labelAlign:   r.labelAlign  ?? props.labelAlign,
  };

  // Multi-point poly-line (e.g. regression sampled across non-linear axes).
  if (Array.isArray(r.points) && r.points.length >= 2) {
    return { id: spec.id, kind: "path", points: r.points, ...style };
  }

  const yDomain = scales.yScale.domain();

  let x1, y1, x2, y2, fullWidth = false;
  if (r.x1 != null) {
    // Slanted — explicit two endpoints
    x1 = r.x1; y1 = r.y1;
    x2 = r.x2; y2 = r.y2;
  } else if (r.y != null && r.x == null) {
    // Horizontal reference rule — spans the FULL inner width in pixels
    // ([0, innerWidth]), independent of the x-domain and of x-zoom. (The old
    // "domain edges" approach mapped through xScale, which on a BAND scale
    // spanned only cat[0]→cat[1] — and `domain[1]` is the *second* category,
    // not the last. On a continuous scale it was already full width.) For a
    // BOUNDED horizontal segment, use the explicit 2-point { x1,y1,x2,y2 } form.
    fullWidth = true;
    y1 = r.y; y2 = r.y;
  } else if (r.x != null && r.y == null) {
    // Vertical across full y-domain
    x1 = r.x;        x2 = r.x;
    y1 = yDomain[0]; y2 = yDomain[1];
  } else {
    return null;
  }

  return { id: spec.id, kind: "line", x1, y1, x2, y2, fullWidth, ...style };
}

// Angle (deg) for rotating a label along a slanted line, matching SVG's
// y-down coordinate system.  Returns a value in (-180, 180].
function lineAngle(sx1, sy1, sx2, sy2) {
  const radians = Math.atan2(sy2 - sy1, sx2 - sx1);
  return (radians * 180) / Math.PI;
}

function anchorFor(align) {
  if (align === "start")  return "start";
  if (align === "middle") return "middle";
  return "end";
}

// Compute a label's screen position for a given (datum, scales) pair.
// Pure — takes everything it needs as arguments — so render() can call it
// with current scales for the final position, with prevScales for the
// enter starting point, and destroy() can call it with the latest scales
// for an exit-to-final-position animation. Mirrors RefAreaLayer's pathFor
// in spirit (datum + scales → drawable target).
function placeLabel(d, sc) {
  // RTL signal shared by every branch. Prefer the projector's explicit rtl flag
  // (band/point x scales keep an ascending range under RTL, so the range-
  // orientation check alone misses them); fall back to range orientation for
  // continuous scales / standalone usage. Drives BOTH the label's writing
  // `direction` (set in render) and the logical anchor below, so they agree
  // regardless of the host page's inherited `dir`.
  const isRtl = (sc.rtl
    ?? (sc.xScale?.range && sc.xScale.range()[0] > sc.xScale.range()[1])) || false;

  // Multi-point poly-line: place at the chosen endpoint / mid sample
  // and use the local tangent direction for rotation.
  if (d.kind === "path") {
    const pts = d.points;
    const n   = pts.length;
    if (!n) return { tx: 0, ty: 0, angle: 0, anchor: "end", rtl: isRtl };
    const i = d.labelAlign === "start"  ? 0
            : d.labelAlign === "middle" ? Math.floor(n / 2)
            : n - 1;
    const tx = sc.xScale(pts[i].x);
    const ty = sc.yScale(pts[i].y);
    // Tangent: use the neighbouring sample for slope.
    const j  = Math.max(0, Math.min(n - 1, i === 0 ? 1 : i - 1));
    const tx2 = sc.xScale(pts[j].x);
    const ty2 = sc.yScale(pts[j].y);
    const angle = lineAngle(tx2, ty2, tx, ty);
    return { tx, ty, angle, anchor: d.labelAlign === "start" ? "start" : "end", rtl: isRtl };
  }

  const sx1 = d.fullWidth ? 0             : sc.xScale(d.x1);
  const sy1 = sc.yScale(d.y1);
  const sx2 = d.fullWidth ? sc.innerWidth : sc.xScale(d.x2);
  const sy2 = sc.yScale(d.y2);

  // Horizontal — single y, place along width
  if (Math.abs(sy1 - sy2) < 0.5) {
    // Position at the reading edge: "start" = reading start, "end" = reading end.
    // For a full-width rule those map to opposite pixel edges under RTL.
    const hx1 = (d.fullWidth && isRtl) ? sc.innerWidth : sx1;  // reading-start edge
    const hx2 = (d.fullWidth && isRtl) ? 0             : sx2;  // reading-end edge
    const tx = d.labelAlign === "start"  ? hx1
             : d.labelAlign === "middle" ? (hx1 + hx2) / 2
             : hx2;
    // Anchor is LOGICAL (no physical flip): render sets the label's writing
    // `direction` to match `isRtl`, so an "end" anchor under direction:rtl reads
    // back INTO the chart from the left edge — and Arabic label text still
    // renders rtl. (A physical flip would only be correct if direction were
    // forced ltr, which would mis-order rtl text.)
    return { tx, ty: sy1, angle: 0, anchor: anchorFor(d.labelAlign), rtl: isRtl };
  }
  // Vertical — single x, place along height
  if (Math.abs(sx1 - sx2) < 0.5) {
    const ty = d.labelAlign === "start"  ? sy2
             : d.labelAlign === "middle" ? (sy1 + sy2) / 2
             : sy1;
    return { tx: sx1, ty, angle: 0, anchor: "middle", rtl: isRtl };
  }
  // Slanted — pin to end (or start / middle) and rotate along the line
  const t = d.labelAlign === "start" ? 0 : d.labelAlign === "middle" ? 0.5 : 1;
  const tx = sx1 + (sx2 - sx1) * t;
  const ty = sy1 + (sy2 - sy1) * t;
  const angle = lineAngle(sx1, sy1, sx2, sy2);
  return { tx, ty, angle, anchor: d.labelAlign === "start" ? "start" : "end", rtl: isRtl };
}

const labelToTransform = ({ tx, ty, angle }) =>
  `translate(${tx}, ${ty}) rotate(${angle})`;

// 2-point-line screen position helper for entry/exit/update geometry.
// Full-width rules ignore x-data and pin to the plot's pixel extent
// [0, innerWidth] (zoom-stable), so they never slide horizontally.
function lineXy(d, sc) {
  const x1 = d.fullWidth ? 0             : sc.xScale(d.x1);
  const x2 = d.fullWidth ? sc.innerWidth : sc.xScale(d.x2);
  return { x1, y1: sc.yScale(d.y1), x2, y2: sc.yScale(d.y2) };
}

// Poly-line `d` attribute for given scales.
function pathDFor(d, sc) {
  const pts = d.points;
  if (!pts?.length) return "";
  let dStr = "";
  for (let i = 0; i < pts.length; i++) {
    dStr += (i === 0 ? "M" : "L") + sc.xScale(pts[i].x) + "," + sc.yScale(pts[i].y);
  }
  return dStr;
}

export function createRefLineLayer() {
  const base = createLayer({ className: "ref-line-layer", prefer: "inner" });

  let contentG    = null;
  let linesG      = null;
  let labelsG     = null;
  let lastPayload = null;
  let lastProps   = null;

  function initGroups(payload, layerContainer) {
    const outerG = base.ensureGroup(payload, layerContainer);
    if (contentG) return;
    contentG = outerG.append("g");
    linesG   = contentG.append("g").attr("class", "lines");
    labelsG  = contentG.append("g").attr("class", "labels").style("pointer-events", "none");
  }

  function drawLines({ resolved, scales, prevScales, payload, duration, ease }) {
    const easeFn = resolveEase(ease);
    const svgEl  = payload.svgEl;
    const stroke = (d) => resolveFill(d.color, svgEl) ?? "currentColor";

    const lineSpecs = resolved.filter((d) => d.kind === "line");
    const pathSpecs = resolved.filter((d) => d.kind === "path");

    // Entering specs start at their previous-viewport pixel position so
    // they slide in from the old scale rather than fading in-place. When
    // prevScales is null (first render, fresh mount) we fall back to the
    // current scales — initial position == final position so the enter
    // is a pure opacity fade with no positional motion. Same contract
    // RefAreaLayer uses; before this fix new ref-lines were stamped at
    // their final position immediately, making the enter feel jumpy
    // whenever the scale was about to swap.
    const enterScales = prevScales ?? scales;

    // ---- 2-point lines (horizontal / vertical / slanted endpoints) ----
    const setLineGeo = (s, sc) => s
      .attr("x1", (d) => lineXy(d, sc).x1)
      .attr("y1", (d) => lineXy(d, sc).y1)
      .attr("x2", (d) => lineXy(d, sc).x2)
      .attr("y2", (d) => lineXy(d, sc).y2);
    const setLineStyle = (s) => s
      .attr("stroke",           stroke)
      .attr("stroke-width",     (d) => d.strokeWidth)
      .attr("stroke-dasharray", (d) => d.dasharray);

    const lineSel = linesG.selectAll("line.ref-line").data(lineSpecs, (d) => d.id);

    // ENTER — stamp prevScales position + final style + opacity 0; then
    // transition geometry + opacity to current state. The previous
    // implementation chained `setLineAttrs(... .call(e => e.transition()…))`
    // which is a no-op (.call() returns the selection; the inner transition
    // had no tweens attached) so the enter snapped to final instantly.
    const lineEnter = lineSel.enter().append("line")
      .attr("class", "ref-line")
      .attr("opacity", 0);
    setLineGeo(lineEnter, enterScales);
    setLineStyle(lineEnter);
    if (duration > 0) {
      const t = lineEnter.transition().duration(duration).ease(easeFn)
        .attr("opacity", (d) => d.opacity);
      setLineGeo(t, scales);
    } else {
      setLineGeo(lineEnter, scales);
      lineEnter.attr("opacity", (d) => d.opacity);
    }

    // UPDATE — transition geometry + style to current scales.
    if (duration > 0) {
      const t = lineSel.transition().duration(duration).ease(easeFn)
        .attr("opacity", (d) => d.opacity);
      setLineGeo(t, scales);
      setLineStyle(t);
    } else {
      setLineGeo(lineSel, scales);
      setLineStyle(lineSel);
      lineSel.attr("opacity", (d) => d.opacity);
    }

    // EXIT — slide geometry toward the NEW scales while fading out, so
    // exiting specs animate alongside the rest of the chart instead of
    // disappearing in place. Mirrors RefAreaLayer's exit.
    if (duration > 0) {
      const tExit = lineSel.exit().transition().duration(duration).ease(easeFn)
        .attr("opacity", 0);
      setLineGeo(tExit, scales);
      tExit.remove();
    } else {
      lineSel.exit().remove();
    }

    // ---- Multi-point poly-lines (sampled regression curves, etc.) ----
    const setPathStyle = (s) => s
      .attr("fill",             "none")
      .attr("stroke",           stroke)
      .attr("stroke-width",     (d) => d.strokeWidth)
      .attr("stroke-dasharray", (d) => d.dasharray);

    const pathSel = linesG.selectAll("path.ref-line").data(pathSpecs, (d) => d.id);

    // ENTER — `d` from prevScales, style + opacity 0; transition d + opacity.
    const pathEnter = pathSel.enter().append("path")
      .attr("class", "ref-line")
      .attr("opacity", 0)
      .attr("d", (d) => pathDFor(d, enterScales));
    setPathStyle(pathEnter);
    if (duration > 0) {
      pathEnter.transition().duration(duration).ease(easeFn)
        .attr("opacity", (d) => d.opacity)
        .attr("d", (d) => pathDFor(d, scales));
    } else {
      pathEnter
        .attr("d", (d) => pathDFor(d, scales))
        .attr("opacity", (d) => d.opacity);
    }

    // UPDATE
    if (duration > 0) {
      const t = pathSel.transition().duration(duration).ease(easeFn)
        .attr("opacity", (d) => d.opacity)
        .attr("d", (d) => pathDFor(d, scales));
      setPathStyle(t);
    } else {
      pathSel
        .attr("d", (d) => pathDFor(d, scales))
        .attr("opacity", (d) => d.opacity);
      setPathStyle(pathSel);
    }

    // EXIT — slide `d` toward the NEW scales while fading out.
    if (duration > 0) {
      pathSel.exit().transition().duration(duration).ease(easeFn)
        .attr("opacity", 0)
        .attr("d", (d) => pathDFor(d, scales))
        .remove();
    } else {
      pathSel.exit().remove();
    }
  }

  function drawLabels({ resolved, scales, prevScales, payload, duration, ease }) {
    const easeFn = resolveEase(ease);
    const svgEl = payload.svgEl;
    const data = resolved.filter((d) => d.label != null && d.label !== "");

    const finalTransform = (d) => labelToTransform(placeLabel(d, scales));
    // Entering labels start at prevScales position so they animate FROM the
    // previous viewport rather than flying in from (0,0).  When no prevScales
    // are available (first render) they simply appear at the final position
    // (pure opacity fade-in with no positional motion).
    const initialTransform = prevScales
      ? (d) => labelToTransform(placeLabel(d, prevScales))
      : finalTransform;

    const sel = labelsG.selectAll("g.ref-label").data(data, (d) => d.id);

    // ENTER — stamp the initial position (prevScales or final), then
    // transition to the final position + full opacity.
    const enter = sel.enter().append("g")
      .attr("class",     "ref-label")
      .attr("opacity",   0)
      .attr("transform", initialTransform);
    enter.append("text");

    if (duration > 0) {
      enter.transition().duration(duration).ease(easeFn)
        .attr("transform", finalTransform)
        .attr("opacity",   1);
    } else {
      enter.attr("transform", finalTransform).attr("opacity", 1);
    }

    // UPDATE — transition from current position to new final position.
    // Re-assert opacity:1 here (not just transform): starting this default
    // transition INTERRUPTS an entering label's still-running opacity fade
    // (0→1). Without re-driving opacity, that label freezes at whatever value
    // the fade had reached when interrupted (e.g. ~0.03) and never recovers.
    // Mirrors drawLines' UPDATE, which already re-asserts opacity.
    if (duration > 0) {
      sel.transition().duration(duration).ease(easeFn)
        .attr("transform", finalTransform)
        .attr("opacity",   1);
    } else {
      sel.attr("transform", finalTransform).attr("opacity", 1);
    }

    // Text attrs — applied immediately on both enter and update (no
    // transition needed for text content / style changes).
    enter.merge(sel).select("text")
      .attr("dy",          (d) => d.labelDy)
      .attr("text-anchor", (d) => placeLabel(d, scales).anchor)
      // Set the label's own writing direction so the LOGICAL anchor above resolves
      // correctly AND rtl (e.g. Arabic) label text renders in the right order —
      // deterministic regardless of the host page's inherited `dir`.
      .style("direction",  (d) => (placeLabel(d, scales).rtl ? "rtl" : "ltr"))
      .style("font-size",  (d) => `${d.labelSize}px`)
      .style("fill",       (d) => resolveFill(d.labelColor, svgEl) ?? "currentColor")
      .text((d) => d.label);

    // EXIT — slide transform toward the NEW scales while fading out, so
    // exiting labels animate alongside the rest of the chart instead of
    // just disappearing in place.
    if (duration > 0) {
      sel.exit().transition().duration(duration).ease(easeFn)
        .attr("opacity", 0)
        .attr("transform", finalTransform)
        .remove();
    } else {
      sel.exit().remove();
    }
  }

  function render(payload, props) {
    if (!payload?.svgEl) return;
    lastPayload = payload;
    lastProps   = props;

    initGroups(payload, props.layerContainer?.value ?? props.layerContainer ?? null);
    // Ref layers always redraw on zoom via rescaled scales — they never
    // ride the canvas's group transform.  Null any transform that
    // base.onZoom or base.ensureGroup may have stamped.
    base.group?.attr("transform", null);

    // Resolve effective margin / padding.
    //   props.margin / props.padding  — explicit chart-level overrides
    //   payload.margin                — canvas margin (the canvas already
    //                                    translates innerEl by this)
    // If the layer was given no margin (typical when slotted into a canvas
    // that owns the margin, like ScatterPlot), inherit the canvas's margin
    // so the translate diff below resolves to zero.
    const cm = payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const m  = props.margin  ?? cm;
    const p  = props.padding ?? payload.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };

    const scales = resolveScales(payload, props, m, p);
    if (!scales.xScale || !scales.yScale) return;

    // contentG translate = (chart_margin + chart_padding) - canvas_margin.
    // Works for both paradigms:
    //   - LineChart-style (margin not on BaseCanvas): canvasM = 0 → dx = m + p.
    //   - Scatter-style (margin IS on BaseCanvas → innerEl already at
    //     canvasM): dx = p only (or 0 if no padding).
    const dx = m.left + p.left - cm.left;
    const dy = m.top  + p.top  - cm.top;
    contentG.attr("transform", (dx || dy) ? `translate(${dx}, ${dy})` : null);

    const data = props.data ?? [];
    const resolved = (props.lines ?? [])
      .map((spec) => normalizeSpec(spec, scales, data, props))
      .filter(Boolean);

    // duration: prop wins; otherwise pick up the canvas's duration so
    // ref-line transitions stay in lockstep with the host chart by default.
    const duration = props.duration ?? payload.duration ?? 0;
    const ease = props.ease ?? payload.ease;

    // Previous-viewport scales for the enter animation — when the chart
    // is mid-transition between projectors (data swap or programmatic
    // zoom), payload.prevXScale / prevYScale point at the OLD scales so
    // new lines/labels can land at their old-viewport position and
    // slide into place. Matches RefAreaLayer's contract. Falls back to
    // null on first render / fresh mount, in which case drawLines /
    // drawLabels use current scales (pure opacity fade, no motion).
    const prevScales = payload.prevXScale && payload.prevYScale
      ? { ...scales, xScale: payload.prevXScale, yScale: payload.prevYScale }
      : null;

    drawLines ({ resolved, scales, prevScales, payload, duration, ease });
    drawLabels({ resolved, scales, prevScales, payload, duration, ease });
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    if (!lastPayload || !lastProps) return;
    base.onZoom(transform);          // records lastTransform; also stamps SVG transform
    base.group?.attr("transform", null);   // …which we immediately cancel — ref layers
                                            // rescale their scales on zoom rather than
                                            // ride a group transform.
    // Enrich the stashed payload with the canvas-rescaled scales for
    // this zoom frame so render() doesn't have to compute them itself.
    // Falls back to a local rescale if the signal was legacy-shaped.
    const xScale = zoomArg?.xScale
      ?? (transform && lastPayload.projector?.raw?.xScale ? transform.rescaleX(lastPayload.projector.raw.xScale) : null);
    const yScale = zoomArg?.yScale
      ?? (transform && lastPayload.projector?.raw?.yScale ? transform.rescaleY(lastPayload.projector.raw.yScale) : null);
    render({ ...lastPayload, xScale, yScale, zoomTransform: transform },
           { ...lastProps, duration: 0 });
  }

  function destroy() {
    // Mirror RefAreaLayer: when there's a duration AND we have everything
    // we need to compute current-scales geometry, slide the exiting lines /
    // paths / labels toward the new viewport AND fade them out, then detach
    // the layer (the d3 transition keeps the elements alive long enough to
    // finish, then removes them). When there's no duration or we can't
    // resolve scales (e.g. the host canvas already tore down its projector),
    // fall back to the cheap synchronous teardown.
    const dur = lastProps?.duration ?? lastPayload?.duration ?? 0;
    let scales = null;
    if (dur > 0 && lastPayload && lastProps) {
      const cm = lastPayload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const m  = lastProps.margin  ?? cm;
      const p  = lastProps.padding ?? lastPayload.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
      scales   = resolveScales(lastPayload, lastProps, m, p);
    }

    if (dur > 0 && scales?.xScale && scales?.yScale && (linesG || labelsG)) {
      const ease = resolveEase(lastProps?.ease ?? lastPayload?.ease);
      const lG = linesG;
      const labG = labelsG;

      if (lG) {
        // 2-point lines
        const tLines = lG.selectAll("line.ref-line")
          .transition().duration(dur).ease(ease)
          .attr("opacity", 0)
          .attr("x1", (d) => lineXy(d, scales).x1)
          .attr("y1", (d) => lineXy(d, scales).y1)
          .attr("x2", (d) => lineXy(d, scales).x2)
          .attr("y2", (d) => lineXy(d, scales).y2);
        tLines.remove();

        // poly-line paths
        const tPaths = lG.selectAll("path.ref-line")
          .transition().duration(dur).ease(ease)
          .attr("opacity", 0)
          .attr("d", (d) => pathDFor(d, scales));
        tPaths.remove();
      }

      if (labG) {
        const tLabels = labG.selectAll("g.ref-label")
          .transition().duration(dur).ease(ease)
          .attr("opacity", 0)
          .attr("transform", (d) => labelToTransform(placeLabel(d, scales)));
        tLabels.remove();
      }

      // Let the transitions finish on their own then tear down the wrapper.
      // base.detach() releases the layer's outer group at the end of the
      // duration, matching RefAreaLayer's contract.
      base.detach();
    } else {
      base.destroy();
    }

    contentG = linesG = labelsG = null;
    lastPayload = lastProps = null;
  }

  return {
    render,
    rerender(props) { if (lastPayload) render(lastPayload, props); },
    onZoom,
    setOrder: (o) => base.setOrder(o),
    destroy,
  };
}
