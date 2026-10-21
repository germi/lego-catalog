import * as d3 from "d3";
import { createLayer } from "./layer.js";
import { resolveFill } from "../fill/resolveFill.js";
import { safeId } from "../utils/safeId.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";
import { resolveEase } from "../utils/ease.js";
import { zoomFromPayload } from "../utils/zoomFromPayload.js";
import {
  isEdgeOnlyChange,
  mergeDataEdges,
} from "../utils/animation/categoryDiff.js";
import {
  resolveCurve,
  resolveKeys,
  buildStackedSeries,
  xPositionFor,
  idsEqual,
  applyZoomToScales,
} from "./_seriesCommon.js";

let _clipId = 0;
let _instanceId = 0;

export const LINE_LAYER_DEFAULTS = {
  data:            [],
  keys:            null,
  color:           {},
  margin:          { top: 0, right: 0, bottom: 20, left: 0 },
  padding:         { top: 0, right: 0, bottom: 0, left: 0 },
  scaleType:       "linear",
  xScaleType:      "linear",
  parseTime:       null,
  max:             null,
  forceValues:     null,
  stacked:         false,
  curve:           "curveLinear",
  strokeWidth:     2,
  strokeOpacity:   1,
  strokeDasharray: null,
  // `dotRadius` accepts either a number or a per-datum function
  // `(datum, key, i) => number`.  0 / falsy disables per-point dots.
  dotRadius:       0,
  // Optional per-datum dot fill — function `(datum, key, i) => fillSpec`
  // OR a per-key map `{ [key]: fillSpec | fn }`.  fillSpec runs through
  // `resolveFill` so textures / gradients / flags work out of the box.
  // null = inherit the line's stroke (default).
  dotColor:        null,
  duration:        GLOBAL_DEFAULTS.duration,
  ease:            GLOBAL_DEFAULTS.ease,
  // Array of series keys to keep at full visibility — anything not listed
  // drops to `dimOpacity`.  Empty / null disables the dimming entirely.
  highlighted:     null,
  // Opacity for non-highlighted lines & dots when `highlighted` is non-empty.
  // `null` falls through to `strokeOpacity` (i.e. no dimming).
  dimOpacity:      null,
  // Optional per-key color overrides applied only when the key is in
  // `highlighted` — e.g. a brighter shade.  Falls back to `props.color[key]`.
  highlightedColor: null,
  defaultColor:    "#9CA3AF",
  // ---- Hover (x-proximity) -----------------------------------------------
  // Opt in to the transparent overlay rect + mousemove handler that emits
  // `{ datum, index, target }`.  `false` = no overlay, no mouse hover.
  // Mount-time only: gated in `initGroups`, which runs once.
  enableXHover:       false,
  showHoverLine:      true,
  hoverLineColor:     "#cbd5e1",
  hoverLineWidth:     1,
  hoverLineDasharray: "3,2",
  // ---- External selection ------------------------------------------------
  // `selectedX` matches a datum's `name`.  When set, draws one selection
  // dot per series at that x and pins the hover line there.  Null +
  // `showLastPoint: true` falls back to the last data point.
  selectedX:              null,
  selectedKey:            null,
  selectedDotRadius:      null,
  selectedDotStroke:      null,
  selectedDotStrokeWidth: 0,
  selectedDotStrokeDasharray: null,
  showLastPoint:          true,
  // Duration (ms) for path-following tween when `selectedX` changes from
  // outside (e.g. a "Pin to 2010" button).  0 = snap.  When the click
  // handler emits and the parent echoes selectedX back, we detect the
  // cursor already being on the new pin and force a snap regardless.
  selectionDuration: 0,
  // Debug: when false, the line clip-path is dropped so you can see
  // phase-A/B's off-range extrapolated tails (the "slide-in/out" edges)
  // that would otherwise be hidden.
  debugClip:        true,
  // ---- Decorative stroke-dashoffset --------------------------------------
  // Same shape as `strokeDasharray` — number|string|function|Object.
  // No animation built in; callers drive it via Vue reactivity.
  strokeDashoffset: null,
};

// x-accessor shared with the layer's series logic — used by the hover
// bisector + selection-dot positioning so they land exactly where the
// rendered line draws each data point.
function xValueFor(datum, props) {
  if (props.xScaleType === "time") {
    const parse = props.parseTime ?? ((name) => new Date(String(name)));
    return parse(datum.name);
  }
  return +datum.name;
}

// Read scales from a projector (current or previous-state) and apply the
// active zoom transform if any, governed by `payload.zoomAxes` (set by
// the host BaseCanvas).  Layers therefore never need a per-axis toggle —
// the canvas declares the zoom mode and every layer follows.
function readScales(projector, activeZoomTransform, zoomAxes) {
  if (!projector?.raw?.xScale || !projector?.raw?.yScale) return null;
  const { x: xScale, y: yScale } =
    applyZoomToScales(projector.raw.xScale, projector.raw.yScale, activeZoomTransform, zoomAxes);
  const xr = xScale.range();
  const yr = yScale.range();
  return {
    x: xScale,
    y: yScale,
    innerWidth:  Math.abs(xr[1] - xr[0]),
    innerHeight: Math.abs(yr[0] - yr[1]),
  };
}

// Regular scales — used outside the three-phase choreography (fresh render,
// same ids, middle-of-range structural change).  Scales come from the
// host chart's current projector; series shape is built from `data`.
function buildScales(data, payload, props, activeZoomTransform) {
  const scales = readScales(payload.projector, activeZoomTransform, payload.zoomAxes);
  if (!scales) return null;
  const keys   = resolveKeys(data, props.keys);
  const series = buildStackedSeries(data, keys, props.stacked);
  return { ...scales, series, keys };
}

// Phase-aware scales for the choreography: `coreData` defines the visible
// range; `allData` is what we actually render (includes padding ids that
// project outside the visible domain via natural d3-scale extrapolation).
function buildScalesForPhase(coreData, allData, projector, props, activeZoomTransform, zoomAxes) {
  const scales = readScales(projector, activeZoomTransform, zoomAxes);
  if (!scales) return null;
  const keys = resolveKeys(coreData, props.keys);
  const renderSeries = buildStackedSeries(allData, keys, props.stacked);
  return { ...scales, series: renderSeries, keys };
}

export function createLineLayer({ onHover = null, onClick = null } = {}) {
  const base = createLayer({ className: "line-layer", prefer: "inner" });
  const instanceId = ++_instanceId;
  // Internal id for the visible line path (the one that goes through the
  // three-phase slide choreography).
  const pathIdFor = (key) => `line-layer-${instanceId}-${safeId(key)}`;
  // Public id (returned by `getPathId`) — points at the invisible "label
  // rail" path instead of the visible line.  The rail uses the regular
  // currData scales (no edge extrapolation) and morphs smoothly between
  // renders, so sibling LineLabelLayers / textPath consumers don't see the
  // visible line's path length suddenly change during a data swap.
  const pathIdForRail = (key) => `line-layer-${instanceId}-rail-${safeId(key)}`;

  let contentG        = null;
  let linesG          = null;
  let dotsG           = null;
  let railsG          = null;
  let selectionDotsG  = null;
  let hoverLineEl     = null;
  let overlayEl       = null;
  let isMouseHovering = false;
  // Transient hover state — set on mousemove, cleared on mouseleave.
  // When non-null, the selection dots + persistent hover line snap to
  // this datum (overriding `selectedX` / `showLastPoint`).
  let hoverDatum      = null;
  // Last mouse x in contentG's local coords — used to re-run the hover
  // bisector on zoom so the line + dots stay glued to whatever data
  // point now sits under the cursor.
  let lastMouseX      = null;
  // Previous datum the selection dots were drawn at — when set, a
  // selectedX change can attrTween the dots along the rail from this
  // datum to the new one (vs. snapping in screen coords).
  let prevSelectionDatum = null;
  let clipRectSel     = null;
  let clipPathId      = null;
  let dotsClipRectSel = null;
  let dotsClipPathId  = null;
  let lastData       = null;
  // Layer-owned previous projector — captured at the end of every render.
  // Used as phase-A's scale set the NEXT time render runs with new data.
  // Tracking it here (instead of via chartContext / payload.prevProjector)
  // sidesteps cross-component reactive ordering bugs.
  let lastProjector  = null;
  let lastProps   = null;
  let lastPayload = null;
  let phaseToken  = 0;
  let activeZoomTransform = null;

  function initGroups(payload, layerContainer) {
    const outerG = base.ensureGroup(payload, layerContainer);
    if (contentG) return;
    const id = ++_clipId;
    // Strict clip rect for line paths — keeps phase-A/B's off-range
    // extrapolated tails hidden no matter how the user zooms or pans.
    clipPathId     = `line-layer-clip-${id}`;
    // Looser clip rect for dots — extended by `dotRadius` on all four
    // sides so a dot sitting on the chart edge isn't half-cropped.
    dotsClipPathId = `line-layer-dots-clip-${id}`;
    let defs = d3.select(payload.svgEl).select("defs");
    if (defs.empty()) defs = d3.select(payload.svgEl).insert("defs", ":first-child");
    clipRectSel     = defs.append("clipPath").attr("id", clipPathId).append("rect");
    dotsClipRectSel = defs.append("clipPath").attr("id", dotsClipPathId).append("rect");
    contentG = outerG.append("g");
    // Hover line is appended FIRST so it renders behind the lines/dots —
    // it's a faint background marker, not a foreground element.
    hoverLineEl = contentG.append("line")
      .attr("class", "x-hover-line")
      .attr("pointer-events", "none")
      .attr("display", "none");
    linesG   = contentG.append("g").attr("class", "lines");
    dotsG    = contentG.append("g").attr("class", "dots");
    // Clip-paths set in updateClipRect — gated on the `debugClip` prop so
    // the user can see phase-A/B's off-range tails when debugging.
    // Invisible rail container for label textPath anchors.  No clip — the
    // rail uses non-extrapolated scales so it always stays within innerWidth.
    railsG   = contentG.append("g").attr("class", "label-rails").attr("aria-hidden", "true");
    // Selection dots (driven by `selectedX` / hover override) — kept ABOVE
    // the lines / per-point dots so they remain the focal marker.
    selectionDotsG = contentG.append("g").attr("class", "selection-dots");

    // Overlay rect (x-proximity hover) — last so it sits on top in
    // z-order and captures mouse events.  Transparent.
    if (lastProps?.enableXHover) {
      overlayEl = contentG.append("rect")
        .attr("class", "hover-overlay")
        .attr("fill", "transparent")
        .attr("pointer-events", "all");
      attachHoverHandlers();
    }
  }

  // Translate a screen-x in contentG's local space into the closest data
  // point along the current x-scale, then position the hover line and emit
  // the hover payload.
  function attachHoverHandlers() {
    if (!overlayEl) return;
    overlayEl
      .on("mousemove", function (event) {
        if (!lastPayload || !lastProps) return;
        const data = lastData ?? lastProps.data ?? [];
        if (!data.length) return;
        const scales = readScales(lastPayload.projector, activeZoomTransform, lastPayload.zoomAxes);
        if (!scales) return;
        const [mx] = d3.pointer(event, contentG.node());
        lastMouseX = mx;
        const xValue = scales.x.invert(mx);
        const bisect = d3.bisector((d) => xValueFor(d, lastProps)).center;
        const index = bisect(data, xValue);
        const datum = data[index];
        if (!datum) return;
        isMouseHovering = true;
        hoverDatum = datum;
        const screenX = scales.x(xValueFor(datum, lastProps));
        positionHoverLine(screenX);
        // Snap the selection dots to the hovered datum (no animation —
        // dots move with the cursor, not lagging through a transition).
        refreshSelection();
        onHover?.({ datum, index, target: hoverLineEl.node() });
      })
      .on("mouseleave", function () {
        isMouseHovering = false;
        hoverDatum = null;
        lastMouseX = null;
        // Snap back to selectedX (or nothing) — refreshSelection drives
        // both the dots and the line position via currentSelectedDatum.
        refreshSelection();
        onHover?.(null);
      })
      .on("click", function (event) {
        if (!lastPayload || !lastProps) return;
        const data = lastData ?? lastProps.data ?? [];
        if (!data.length) return;
        const scales = readScales(lastPayload.projector, activeZoomTransform, lastPayload.zoomAxes);
        if (!scales) return;
        const [mx] = d3.pointer(event, contentG.node());
        const xValue = scales.x.invert(mx);
        const bisect = d3.bisector((d) => xValueFor(d, lastProps)).center;
        const index = bisect(data, xValue);
        const datum = data[index];
        if (!datum) return;
        onClick?.({ datum, index, target: hoverLineEl.node() });
      });
  }

  // Resolve which datum the selection dots (and persistent hover line)
  // currently track.  Priority:
  //   1. live mouse hover (transient — cleared on mouseleave)
  //   2. `selectedX` matches a datum.name (pinned)
  //   3. `selectedX` is null + `showLastPoint` true → last datum
  //   4. otherwise → null
  // showLastPoint's automatic "current value" marker is redundant — an exact
  // visual duplicate stacked on top of the regular per-point dot — once
  // per-point dots (`dotRadius`) are already drawn at every point, including
  // the last one, with no selection-dot styling to tell them apart. Only
  // suppress the fallback in that specific case; a consumer who sets
  // `selectedDotRadius` / `selectedDotStroke*` clearly wants an
  // always-visible marker distinct from the per-point dots, so keep it.
  function hasVisiblePerPointDots(props) {
    return typeof props.dotRadius === "function" || (!!props.dotRadius && props.dotRadius > 0);
  }

  function hasCustomSelectionDotStyle(props) {
    return (
      props.selectedDotRadius != null ||
      (props.selectedDotStroke != null && props.selectedDotStroke !== "transparent") ||
      (props.selectedDotStrokeWidth != null && props.selectedDotStrokeWidth > 0)
    );
  }

  function currentSelectedDatum(data, props) {
    if (hoverDatum) return hoverDatum;
    if (props.selectedX != null) {
      return data.find((d) => d.name === props.selectedX) ?? null;
    }
    const wouldDuplicateLastDot =
      hasVisiblePerPointDots(props) && !hasCustomSelectionDotStyle(props);
    if (props.showLastPoint && !wouldDuplicateLastDot && data.length) {
      return data[data.length - 1];
    }
    return null;
  }

  function positionHoverLine(screenX) {
    if (!hoverLineEl) return;
    if (screenX == null || !lastPayload || !lastProps?.showHoverLine) {
      hoverLineEl.attr("display", "none");
      return;
    }
    const cm = lastPayload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const m  = lastProps.margin   ?? cm;
    const p  = lastProps.padding  ?? { top: 0, right: 0, bottom: 0, left: 0 };
    // Vertical extent: from the very top of the SVG down to the x-axis
    // domain line.  We respect margin-bottom (the line shouldn't bleed
    // into the axis labels) but ignore margin-top — the marker reads
    // better when it punches all the way to the top edge.
    const innerHeight = lastPayload.height - m.top - m.bottom - p.top - p.bottom;
    hoverLineEl
      .attr("display", null)
      .attr("x1", screenX)
      .attr("x2", screenX)
      .attr("y1", -(m.top + p.top))
      .attr("y2", Math.max(0, innerHeight))
      .attr("stroke", lastProps.hoverLineColor ?? "#cbd5e1")
      .attr("stroke-width", lastProps.hoverLineWidth ?? 1)
      .attr("stroke-dasharray", lastProps.hoverLineDasharray ?? "3,2");
  }

  function updateClipRect(payload, m, p) {
    if (!clipRectSel) return;

    // `debugClip: false` strips the clip-paths so phase-A/B's off-range
    // extrapolated tails (and out-of-bounds dots) become visible.
    const debugClip = lastProps?.debugClip !== false;
    linesG.attr("clip-path", debugClip ? `url(#${clipPathId})` : null);
    dotsG.attr("clip-path",  debugClip ? `url(#${dotsClipPathId})` : null);

    const innerWidth = payload.width - m.left - m.right - p.left - p.right;
    clipRectSel
      .attr("x", 0)
      .attr("y", -(m.top + p.top))
      .attr("width",  Math.max(0, innerWidth))
      .attr("height", Math.max(0, payload.height));

    // Dots get the same rect inflated by `dotRadius` on every side so a dot
    // sitting at the very edge isn't half-cropped by the strict line clip.
    if (dotsClipRectSel) {
      // `dotRadius` can be a per-datum function `(datum, key, i) => number`.
      // Using it raw makes `-r` / `2 * r` NaN, which corrupts the clip rect and
      // hides every dot. Fall back to `selectedDotRadius` (the fixed radius of
      // the largest dot actually rendered) as a conservative inflation bound.
      const rawR = lastProps?.dotRadius ?? 0;
      const r = typeof rawR === "function" ? (lastProps?.selectedDotRadius ?? 0) : rawR;
      dotsClipRectSel
        .attr("x", -r)
        .attr("y", -(m.top + p.top) - r)
        .attr("width",  Math.max(0, innerWidth + 2 * r))
        .attr("height", Math.max(0, payload.height + 2 * r));
    }

    // Hover overlay — full canvas height, plot width.
    if (overlayEl) {
      overlayEl
        .attr("x", 0)
        .attr("y", -(m.top + p.top))
        .attr("width",  Math.max(0, innerWidth))
        .attr("height", Math.max(0, payload.height));
    }
  }

  // Cached final-state geometry of the label rail, indexed by series key.
  // Repopulated on every drawLabelRails call so `computeAnchorOffset` can
  // measure against the END of the in-flight transition (the rail's actual
  // DOM `d` attribute is still at the OLD shape during phase A/B).
  //
  // Each entry: { dString, totalLength, xByDataId: { [dataId]: screenX } }
  const railFinalGeom = new Map();

  // Invisible "label rail" path per series — used as the textPath href for
  // sibling LineLabelLayers.  Always built from currData on regular scales
  // (no edge extrapolation), so its length and shape evolve smoothly between
  // renders and labels don't jump when the visible line goes through the
  // three-phase slide choreography.
  function drawLabelRails({ payload, props, scales, duration, currData }) {
    if (!railsG) return;
    const { x, y, series } = scales;
    const curve = resolveCurve(props.curve);
    const line = d3.line()
      .defined((d) => d[1] != null)
      .x((d) => xPositionFor(d, x, props))
      .y((d) => y(d[1]))
      .curve(curve);

    railsG.selectAll("path.rail").data(series, (s) => s.key).join(
      (enter) => enter.append("path")
        .attr("class", "rail")
        .attr("id", (s) => pathIdForRail(s.key))
        .attr("fill", "none")
        .attr("stroke", "none")
        .attr("d", (s) => line(s)),
      (update) => duration > 0
        ? update.transition().duration(duration).attr("d", (s) => line(s))
        : update.attr("d", (s) => line(s)),
      (exit) => exit.remove(),
    );

    // Cache the final d-string + each data point's screen x for each series
    // so `computeAnchorOffset` can answer offset queries against the
    // end-of-transition geometry without re-running the line generator.
    railFinalGeom.clear();
    for (const s of series) {
      const dString = line(s);
      if (!dString) continue;
      const xByDataId = {};
      let endPoint = null;          // screen coords of the LAST defined point
      for (const e of s) {
        if (!e?.data) continue;
        xByDataId[e.data.id] = xPositionFor(e, x, props);
        if (e[1] != null) endPoint = { x: xPositionFor(e, x, props), y: y(e[1]) };
      }
      railFinalGeom.set(s.key, { dString, xByDataId, endPoint, totalLength: null });
    }
  }

  /**
   * Returns the length-offset along the (final-state) label-rail path of
   * series `seriesKey` where the data point with id `dataId` sits.
   *
   * Used by sibling LineLabelLayers to anchor a label to a specific data
   * point (e.g. "year 1994") instead of a relative position — so the label
   * surfs the curve when the dataset is swapped.
   *
   * Returns null when the series or data id is unknown (caller should fall
   * back to the label's own `startOffset`).
   */
  function computeAnchorOffset(seriesKey, dataId) {
    const geom = railFinalGeom.get(seriesKey);
    if (!geom) return null;
    const screenX = geom.xByDataId[dataId];
    if (screenX == null || !isFinite(screenX)) return null;

    // Measure the final rail geometry on a temp <path> — getTotalLength /
    // getPointAtLength work on detached SVG elements in all modern browsers.
    let tmp = computeAnchorOffset._tmp;
    if (!tmp) {
      tmp = document.createElementNS("http://www.w3.org/2000/svg", "path");
      computeAnchorOffset._tmp = tmp;
    }
    tmp.setAttribute("d", geom.dString);
    if (geom.totalLength == null) geom.totalLength = tmp.getTotalLength();
    const totalLength = geom.totalLength;
    if (!totalLength) return 0;

    // Binary search — 24 iterations gives sub-pixel precision on any path.
    let lo = 0, hi = totalLength;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const pt = tmp.getPointAtLength(mid);
      if (pt.x < screenX) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /**
   * Screen coords (in the rail's contentG space, i.e. margin+padding-relative)
   * of a series' LAST defined data point — the visual end of its line. Used by
   * sibling LineLabelLayers in `anchor="lineEnd"` mode to place an end-of-line
   * label at the series' final value before force-relaxing the vertical stack.
   *
   * Reads the final-state geometry cache so the answer reflects the END of an
   * in-flight transition, matching how labels animate in lockstep with the rail.
   * Returns null when the series is unknown or fully undefined.
   */
  function getSeriesEndPoint(seriesKey) {
    return railFinalGeom.get(seriesKey)?.endPoint ?? null;
  }

  function drawSeries({ payload, props, scales, duration }) {
    const { x, y, series } = scales;
    const svgEl = payload.svgEl;
    const curve = resolveCurve(props.curve);
    const easeFn = resolveEase(props.ease ?? payload.ease);

    const line = d3.line()
      .defined((d) => d[1] != null)
      .x((d) => xPositionFor(d, x, props))
      .y((d) => y(d[1]))
      .curve(curve);

    // Initial baseline path — line at y=domain[0] across the same x positions.
    // Used for fresh enters (line "grows up" from the bottom) and animated exits.
    const baselineLine = d3.line()
      .defined((d) => d[1] != null)
      .x((d) => xPositionFor(d, x, props))
      .y(() => y(y.domain()[0]))
      .curve(curve);

    const hl = Array.isArray(props.highlighted) ? props.highlighted : [];
    const isHighlighted = (key) => hl.includes(key);
    const dimming = hl.length > 0 && props.dimOpacity != null;

    const strokeFor = (key, i) => {
      // Highlighted keys can opt into a different colour via highlightedColor.
      if (isHighlighted(key) && props.highlightedColor?.[key] != null) {
        const hc = typeof props.highlightedColor[key] === "function"
          ? props.highlightedColor[key](key, i)
          : props.highlightedColor[key];
        const resolved = resolveFill(hc, svgEl);
        if (resolved) return resolved;
      }
      const c = typeof props.color?.[key] === "function"
        ? props.color[key](key, i)
        : props.color?.[key];
      return resolveFill(c, svgEl) ?? props.defaultColor ?? "#9CA3AF";
    };
    const strokeWidthFor = (key, i) =>
      typeof props.strokeWidth === "function"
        ? props.strokeWidth(key, i)
        : props.strokeWidth ?? 2;
    const dashFor = (key, i) =>
      typeof props.strokeDasharray === "function"
        ? props.strokeDasharray(key, i)
        : props.strokeDasharray ?? null;
    const dashOffsetFor = (key, i) =>
      typeof props.strokeDashoffset === "function"
        ? props.strokeDashoffset(key, i)
        : (typeof props.strokeDashoffset === "object" && props.strokeDashoffset != null)
          ? (props.strokeDashoffset[key] ?? null)
          : props.strokeDashoffset ?? null;
    // Per-key opacity: highlighted (or no highlight at all) → strokeOpacity;
    // non-highlighted while something is highlighted → dimOpacity.
    const strokeOpacityFor = (key) => {
      if (!dimming || isHighlighted(key)) return props.strokeOpacity ?? 1;
      return props.dimOpacity;
    };

    linesG.selectAll("path.line").data(series, (s) => s.key).join(
      (enter) => enter.append("path")
        .attr("class", "line")
        .attr("id", (s) => pathIdFor(s.key))
        .attr("fill", "none")
        .attr("stroke", (s, i) => strokeFor(s.key, i))
        .attr("stroke-width", (s, i) => strokeWidthFor(s.key, i))
        .attr("stroke-opacity", (s) => strokeOpacityFor(s.key))
        .attr("stroke-dasharray", (s, i) => dashFor(s.key, i))
        .attr("stroke-dashoffset", (s, i) => dashOffsetFor(s.key, i))
        .attr("d", (s) => baselineLine(s))
        .attr("opacity", 0)
        .call((e) => duration > 0
          ? e.transition().duration(duration).ease(easeFn)
              .attr("opacity", 1)
              .attr("d", (s) => line(s))
          : e.attr("opacity", 1).attr("d", (s) => line(s))),
      (update) => update.call((u) => duration > 0
        ? u.transition().duration(duration).ease(easeFn)
            .attr("stroke", (s, i) => strokeFor(s.key, i))
            .attr("stroke-width", (s, i) => strokeWidthFor(s.key, i))
            .attr("stroke-opacity", (s) => strokeOpacityFor(s.key))
            .attr("stroke-dasharray", (s, i) => dashFor(s.key, i))
            .attr("stroke-dashoffset", (s, i) => dashOffsetFor(s.key, i))
            // Re-assert opacity:1.  D3's default-transition starts here cancel
            // the enter's in-flight opacity 0→1 animation, leaving paths stuck
            // at an interpolated value (e.g. ~0.001) if a re-render fires
            // while enter is still tweening — common when a parent component
            // creates fresh inline `:color="{...}"` / `:keys="[...]"` objects
            // on every render.  Animating opacity here forces convergence to 1
            // regardless of what the canceled enter transition left behind.
            .attr("opacity", 1)
            .attr("d", (s) => line(s))
        : u.attr("stroke", (s, i) => strokeFor(s.key, i))
            .attr("stroke-width", (s, i) => strokeWidthFor(s.key, i))
            .attr("stroke-opacity", (s) => strokeOpacityFor(s.key))
            .attr("stroke-dasharray", (s, i) => dashFor(s.key, i))
            .attr("stroke-dashoffset", (s, i) => dashOffsetFor(s.key, i))
            .attr("opacity", 1)
            .attr("d", (s) => line(s))),
      (exit) => exit.call((e) => duration > 0
        ? e.transition().duration(duration).ease(easeFn)
            .attr("opacity", 0)
            .attr("d", (s) => baselineLine(s))
            .remove()
        : e.remove()),
    );

    drawDots({ payload, props, scales, duration, strokeFor, strokeOpacityFor });
  }

  function drawDots({ payload, props, scales, duration, strokeFor, strokeOpacityFor }) {
    const isFn = typeof props.dotRadius === "function";
    if (!isFn && (!props.dotRadius || props.dotRadius <= 0)) {
      dotsG.selectAll("circle.dot").remove();
      return;
    }
    const { x, y, series } = scales;
    const radiusFor = isFn
      ? (d) => +props.dotRadius(d.e.data, d.key, d.si) || 0
      : () => +props.dotRadius || 0;

    const flat = series.flatMap((s, si) =>
      s
        .filter((e) => e[1] != null)
        .map((e) => ({ key: s.key, si, e })),
    );

    // Series-level base fill (texture / gradient resolved by drawSeries'
    // strokeFor when provided — keeps dots in lockstep with their line).
    const svgEl = payload?.svgEl ?? null;
    const baseFor = strokeFor ?? ((key, si) => {
      const c = typeof props.color?.[key] === "function"
        ? props.color[key](key, si)
        : props.color?.[key];
      return resolveFill(c, svgEl) ?? props.defaultColor ?? "#9CA3AF";
    });
    // Per-datum override: `dotColor` (function or per-key map / function).
    // Falls through to series baseFor when unset.
    const fillFor = (d) => {
      const raw = typeof props.dotColor === "function"
        ? props.dotColor(d.e.data, d.key, d.si)
        : props.dotColor?.[d.key];
      if (raw != null) {
        const resolved = resolveFill(typeof raw === "function" ? raw(d.e.data, d.key, d.si) : raw, svgEl);
        if (resolved) return resolved;
      }
      return baseFor(d.key, d.si);
    };
    const opacityFor = strokeOpacityFor ?? (() => 1);

    // Fresh enters start at the same y=domain[0] baseline the line grows up
    // from (see drawSeries' baselineLine) — dots "rise" into place alongside
    // their line instead of appearing instantly at their final position.
    const baselineY = y(y.domain()[0]);

    dotsG.selectAll("circle.dot").data(flat, (d) => `${d.key}_${d.e.data.id}`).join(
      (enter) => enter.append("circle")
        .attr("class", "dot")
        .attr("r", (d) => radiusFor(d))
        .attr("cx", (d) => xPositionFor(d.e, x, props))
        .attr("cy", (d) => duration > 0 ? baselineY : y(d.e[1]))
        .attr("fill", (d) => fillFor(d))
        .attr("opacity", 0)
        .call((e) => duration > 0
          ? e.transition().duration(duration)
              .attr("cy", (d) => y(d.e[1]))
              .attr("opacity", (d) => opacityFor(d.key))
          : e.attr("opacity", (d) => opacityFor(d.key))),
      (update) => duration > 0
        ? update.transition().duration(duration)
            .attr("r",       (d) => radiusFor(d))
            .attr("fill",    (d) => fillFor(d))
            .attr("opacity", (d) => opacityFor(d.key))
            .attr("cx", (d) => xPositionFor(d.e, x, props))
            .attr("cy", (d) => y(d.e[1]))
        : update
            .attr("r",       (d) => radiusFor(d))
            .attr("fill",    (d) => fillFor(d))
            .attr("opacity", (d) => opacityFor(d.key))
            .attr("cx", (d) => xPositionFor(d.e, x, props))
            .attr("cy", (d) => y(d.e[1])),
      (exit) => exit.remove(),
    );
  }

  // Selection dots — one circle per series at the currently selected x.
  // Conceptually separate from the per-point dots driven by `dotRadius`
  // (those render at every data point along every line); selection dots
  // are a focal marker for one x column.
  //
  // `tween` (optional) — when true and we have a `prevSelectionDatum`
  // (different from `selected`), the dots are tweened along the cached
  // label-rail path so they LITERALLY ride the line from old → new.
  // Otherwise dots are positioned via `cx`/`cy` either snap or with
  // duration-bounded linear interpolation.
  function drawSelectionDots({ payload, props, scales, duration, tween }) {
    if (!selectionDotsG) return;
    const data = props.data ?? [];
    const selected = currentSelectedDatum(data, props);

    if (!selected) {
      selectionDotsG.selectAll("circle.sel-dot").remove();
      // Hide the persistent hover-line marker if the mouse isn't currently
      // dragging it elsewhere.  (Active hover wins.)
      if (!isMouseHovering) positionHoverLine(null);
      prevSelectionDatum = null;
      return;
    }

    const idx = data.indexOf(selected);
    const { x, y, series } = scales;

    // For each series, find the stack entry parallel to `idx` in data.
    // Using the stack output directly guarantees the dot sits exactly on
    // the line (including stacked tops).
    const dots = series
      .map((s, si) => {
        const e = s[idx];
        if (!e || e[1] == null) return null;
        return { key: s.key, si, e };
      })
      .filter(Boolean)
      .filter((d) => props.selectedKey == null || d.key === props.selectedKey);

    // Per-datum radius — `selectedDotRadius` wins; otherwise inherit
    // `dotRadius`, which itself can be a function `(datum, key, i) => n`.
    // A radius of 0 (or fn returning 0) just renders an invisible circle.
    const baseRadius = props.selectedDotRadius ?? props.dotRadius;
    const radiusFor = typeof baseRadius === "function"
      ? (d) => +baseRadius(d.e.data, d.key, d.si) || 0
      : () => +baseRadius || 0;
    // Bail entirely when there's no plausible dot size anywhere — same
    // semantics as before for the "user didn't opt in" case.
    if (typeof baseRadius !== "function" && (!baseRadius || baseRadius <= 0)) {
      selectionDotsG.selectAll("circle.sel-dot").remove();
      if (!isMouseHovering) {
        if (props.selectedX != null) {
          positionHoverLine(x(xValueFor(selected, props)));
        } else {
          positionHoverLine(null);
        }
      }
      prevSelectionDatum = selected;
      return;
    }

    const svgEl = payload.svgEl;
    const hl = Array.isArray(props.highlighted) ? props.highlighted : [];
    const dimming = hl.length > 0 && props.dimOpacity != null;
    const isHighlighted = (key) => hl.includes(key);
    // Per-datum fill: `dotColor` (per-key or function) takes priority for
    // dots; otherwise fall through to the line's stroke (incl.
    // highlightedColor overrides + texture/gradient via resolveFill).
    const baseFor = (key, i) => {
      if (isHighlighted(key) && props.highlightedColor?.[key] != null) {
        const hc = typeof props.highlightedColor[key] === "function"
          ? props.highlightedColor[key](key, i)
          : props.highlightedColor[key];
        const resolved = resolveFill(hc, svgEl);
        if (resolved) return resolved;
      }
      const c = typeof props.color?.[key] === "function"
        ? props.color[key](key, i)
        : props.color?.[key];
      return resolveFill(c, svgEl) ?? props.defaultColor ?? "#9CA3AF";
    };
    const fillFor = (d) => {
      const raw = typeof props.dotColor === "function"
        ? props.dotColor(d.e.data, d.key, d.si)
        : props.dotColor?.[d.key];
      if (raw != null) {
        const resolved = resolveFill(typeof raw === "function" ? raw(d.e.data, d.key, d.si) : raw, svgEl);
        if (resolved) return resolved;
      }
      return baseFor(d.key, d.si);
    };
    // Selection dots dim alongside their line when `highlighted` is set
    // and a `dimOpacity` is provided.  Visual coherence with drawSeries.
    const opacityFor = (key) => {
      if (!dimming || isHighlighted(key)) return 1;
      return props.dimOpacity;
    };

    // Decide whether to ride the rail.  Needs:
    //   - explicit `tween` request from the caller
    //   - a prev datum that's still part of the current data (i.e. the
    //     dot is at a known position on the same rail)
    //   - a real movement (prev != next)
    const wantRailTween = tween
      && prevSelectionDatum
      && prevSelectionDatum !== selected
      && data.includes(prevSelectionDatum);

    // Per-series tween factory.  Reads the live rail `<path>` and uses
    // `computeAnchorOffset` to find the start/end arc-length offsets.
    // Falls back to a plain transform interpolation if anything fails
    // (rail not in DOM yet, offset uncomputable).
    const railTweenFor = (d) => {
      if (!wantRailTween) return null;
      const railEl = lastPayload?.svgEl
        ? d3.select(lastPayload.svgEl).select(`#${pathIdForRail(d.key)}`).node()
        : null;
      if (!railEl) return null;
      const fromOff = computeAnchorOffset(d.key, prevSelectionDatum.id);
      const toOff   = computeAnchorOffset(d.key, selected.id);
      if (fromOff == null || toOff == null) return null;
      return function () {
        const interp = d3.interpolateNumber(fromOff, toOff);
        return (t) => {
          const pt = railEl.getPointAtLength(interp(t));
          return `translate(${pt.x}, ${pt.y})`;
        };
      };
    };

    // Final transform: sits at the datum's (x, y).  Used for enter,
    // non-tween updates, and as the "end state" tweens land on.
    const transformFor = (d) => `translate(${xPositionFor(d.e, x, props)}, ${y(d.e[1])})`;

    const stroke       = props.selectedDotStroke ?? "transparent";
    const strokeWidth  = props.selectedDotStrokeWidth ?? 0;
    const strokeDash   = props.selectedDotStrokeDasharray ?? null;

    selectionDotsG.selectAll("circle.sel-dot")
      .data(dots, (d) => d.key)
      .join(
        (enter) => enter.append("circle")
          .attr("class", "sel-dot")
          .attr("r", (d) => radiusFor(d))
          .attr("fill", (d) => fillFor(d))
          .attr("stroke", stroke)
          .attr("stroke-width", strokeWidth)
          .attr("stroke-dasharray", strokeDash)
          .attr("transform", (d) => transformFor(d))
          .attr("opacity", 0)
          .call((e) => duration > 0
            ? e.transition().duration(duration).attr("opacity", (d) => opacityFor(d.key))
            : e.attr("opacity", (d) => opacityFor(d.key))),
        (update) => {
          // Always sync the cheap attrs immediately — radius / fill /
          // opacity aren't part of the spatial tween.
          update
            .attr("r", (d) => radiusFor(d))
            .attr("fill", (d) => fillFor(d))
            .attr("stroke", stroke)
            .attr("stroke-width", strokeWidth)
            .attr("stroke-dasharray", strokeDash)
            .attr("opacity", (d) => opacityFor(d.key));
          if (duration > 0) {
            const t = update.transition().duration(duration);
            if (wantRailTween) {
              t.attrTween("transform", function (d) {
                const factory = railTweenFor(d);
                return factory
                  ? factory.call(this, d)
                  : d3.interpolateTransformSvg(this.getAttribute("transform") ?? "", transformFor(d));
              });
            } else {
              t.attr("transform", (d) => transformFor(d));
            }
          } else {
            update.attr("transform", (d) => transformFor(d));
          }
          return update;
        },
        (exit) => exit.remove(),
      );

    // Persistent hover line: only when `selectedX` is explicitly set.
    // The `showLastPoint` fallback shows dots but no vertical line
    // (it's a passive "current value" marker, not an active selection).
    // Mouse-driven hover wins regardless.
    if (!isMouseHovering) {
      if (props.selectedX != null) {
        positionHoverLine(x(xValueFor(selected, props)));
      } else {
        positionHoverLine(null);
      }
    }

    // Remember where the dots landed so the next selectedX change can
    // tween from this datum.  Crucial: this happens AFTER the join, so
    // a follow-up `Pin to 2010` knows to ride the curve from here.
    prevSelectionDatum = selected;
  }

  function render(payload, props) {
    if (!payload?.svgEl) return;
    // Cancel any pending rAF callbacks from a previous three-phase sequence.
    // Every render replaces the in-progress choreography, whether or not the
    // new render itself triggers three-phase.
    ++phaseToken;
    // Distinguish a real new draw from a rerender (a prop watcher calls
    // `rerender(props)` which dispatches `render(lastPayload, props)` — same
    // payload ref).  Only NEW payloads carry an authoritative zoom snapshot
    // from `fireDraw`; for a rerender we must keep whatever `onZoom` has
    // updated `activeZoomTransform` to in the meantime — otherwise an
    // unrelated prop change (e.g. a colour object literal that changed ref)
    // would overwrite the live post-pan transform with the stale draw-time
    // one and snap the lines back to their pre-pan position.
    const isNewPayload = payload !== lastPayload;
    lastProps   = props;
    lastPayload = payload;
    // Capture the zoom that was active during the PREVIOUS render before
    // we update it.  Phase A of the 3-phase choreography must represent
    // what the user was actually seeing (old data at old zoom) — using the
    // new zoom for Phase A would snap the old lines to the new zoom
    // position before the animation starts.
    const prevZoomTransform = activeZoomTransform;
    // Sync our cached transform from whatever d3-zoom is currently at
    // (canvas stamps it onto every draw payload).  Critical for
    // programmatic zoom, which no longer fires onZoom — without this the
    // 3-phase choreography would build scales from a stale identity
    // transform and the lines would end up at pre-zoom positions.
    if (isNewPayload) {
      activeZoomTransform = zoomFromPayload(payload, activeZoomTransform);
    }

    if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[lineLayer] render", {
        payloadDuration: payload.duration,
        propsDuration: props.duration,
        zoomK: activeZoomTransform?.k ?? 1,
        dataCount: (props.data ?? []).length,
      });
    }

    initGroups(payload, props.layerContainer?.value ?? props.layerContainer ?? null);
    base.group?.attr("transform", null);

    // Universal contentG translate diff: (chartM + chartP) - canvasM.
    //   - LineChart-style (canvasM = 0): translate = chartM + chartP.
    //   - Scatter-style (canvasM = chartM): translate = chartP.
    const cm = payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const m  = props.margin  ?? cm;
    const p  = props.padding ?? payload.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const dx = m.left + p.left - cm.left;
    const dy = m.top  + p.top  - cm.top;
    contentG.attr("transform", (dx || dy) ? `translate(${dx}, ${dy})` : null);
    updateClipRect(payload, m, p);

    const currData = props.data ?? [];
    const prevData = lastData;

    // Label rail morphs once per render at the chart's transition tempo —
    // never goes through the three-phase slide.  Always built from currData
    // on regular scales so label startOffsets map to a stable position.
    const railScales = buildScales(currData, payload, props, activeZoomTransform);
    // No projector yet (e.g., first frame before the canvas reported its
    // size).  Bail; the next draw signal will redo this with a real
    // projector in scope.
    if (!railScales) return;
    // payload.duration FIRST: lets the canvas force a 0-duration redraw
    // (e.g. on resize) regardless of the layer's configured prop duration.
    const dur = payload.duration ?? props.duration ?? 0;
    const railDur = !prevData?.length ? dur : dur;
    drawLabelRails({ payload, props, scales: railScales, duration: railDur, currData });
    // Selection dots track the FINAL state (railScales) regardless of the
    // 3-phase choreography below, so they morph smoothly from old → new
    // position in lockstep with the rail / labels.  Fresh enters use the
    // full duration too.
    drawSelectionDots({ payload, props, scales: railScales, duration: dur });

    // No previous data → fresh render.
    if (!prevData?.length) {
      drawSeries({ payload, props, scales: railScales, duration: dur });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    const prevIds = prevData.map((d) => d.id);
    const currIds = currData.map((d) => d.id);

    // Same ids → value morph only.
    if (idsEqual(prevIds, currIds)) {
      drawSeries({ payload, props, scales: railScales, duration: dur });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    // Structural change but not edge-only → single-phase fallback.
    if (!isEdgeOnlyChange(prevIds, currIds)) {
      drawSeries({ payload, props, scales: railScales, duration: dur });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    // Edge-only structural change → three-phase choreography.
    const mergedOld    = mergeDataEdges(prevData, currData);
    const mergedNew    = mergeDataEdges(currData, prevData);
    // Phase A: layer's CACHED previous projector + mergedOld.  The prev
    // projector's xDomain is the old data's extent, so mergedOld's new-only
    // padding ids project off the right edge naturally (their x-values
    // fall outside the prev xDomain).
    // IMPORTANT: use prevZoomTransform (zoom at time of last render) not
    // activeZoomTransform (new zoom).  Phase A must match what the user was
    // actually seeing — applying the new zoom here would snap the old lines
    // to the new zoom position before the animation can play.
    // Phase B: current projector + mergedNew + NEW zoom.  Old-only ids project
    // off-screen left.
    // Phase C: current projector + currData.
    const phaseAScales = buildScalesForPhase(prevData, mergedOld, lastProjector,    props, prevZoomTransform,   payload.zoomAxes);
    const phaseBScales = buildScalesForPhase(currData, mergedNew, payload.projector, props, activeZoomTransform, payload.zoomAxes);
    const phaseCScales = railScales;

    // Layer hasn't seen a previous render (first frame after mount) — no
    // prev projector to slide from.  Single-phase update.
    if (!phaseAScales || !phaseBScales) {
      drawSeries({ payload, props, scales: phaseCScales, duration: dur });
      lastData = currData;
      lastProjector = payload.projector;
      return;
    }

    const token = phaseToken;  // snapshot — already incremented at render start


    // Phase A: instant render of mergedOld on prev scales.
    drawSeries({ payload, props, scales: phaseAScales, duration: 0 });

    requestAnimationFrame(() => {
      if (token !== phaseToken) return;
      // Phase B: animate to mergedNew on current scales.
      drawSeries({ payload, props, scales: phaseBScales, duration: dur });
      setTimeout(() => {
        if (token !== phaseToken) return;
        linesG.selectAll("path.line").interrupt();
        if (dotsG) dotsG.selectAll("circle.dot").interrupt();
        drawSeries({ payload, props, scales: phaseCScales, duration: 0 });
      }, dur);
    });

    lastData      = currData;
    lastProjector = payload.projector;
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    activeZoomTransform = (transform.k === 1 && transform.x === 0 && transform.y === 0) ? null : transform;
    base.onZoom(transform);
    base.group?.attr("transform", null);
    if (lastPayload && lastProps) {
      const data = lastData ?? lastProps.data ?? [];
      const scales = buildScales(data, lastPayload, lastProps, activeZoomTransform);
      if (!scales) return;
      drawSeries({ payload: lastPayload, props: lastProps, scales, duration: 0 });
      // Keep the rail in sync with the zoomed line so anchored labels follow.
      drawLabelRails({ payload: lastPayload, props: lastProps, scales, duration: 0, currData: data });
      // If the mouse is currently over the chart, re-run the bisector
      // against the zoomed x-scale so the hover line + emit follow the
      // data point now sitting under the cursor.  This keeps tooltips
      // aligned during wheel-zoom.
      if (isMouseHovering && lastMouseX != null && data.length) {
        const xValue = scales.x.invert(lastMouseX);
        const bisect = d3.bisector((d) => xValueFor(d, lastProps)).center;
        const index = bisect(data, xValue);
        const datum = data[index];
        if (datum) {
          hoverDatum = datum;
          positionHoverLine(scales.x(xValueFor(datum, lastProps)));
          onHover?.({ datum, index, target: hoverLineEl.node() });
        }
      }
      // Selection dots + persistent hover line must also follow the zoomed
      // x-scale so they stay glued to their data point during pan/zoom.
      drawSelectionDots({ payload: lastPayload, props: lastProps, scales, duration: 0 });
    }
  }

  function destroy() {
    // Invalidate any in-flight three-phase choreography so its pending rAF /
    // setTimeout callbacks short-circuit (their `token !== phaseToken` guard)
    // instead of running drawSeries against the now-null groups after unmount.
    ++phaseToken;
    if (lastPayload?.svgEl) {
      const svgSel = d3.select(lastPayload.svgEl);
      if (clipPathId)     svgSel.select(`#${clipPathId}`).remove();
      if (dotsClipPathId) svgSel.select(`#${dotsClipPathId}`).remove();
    }
    base.destroy();
    contentG = linesG = dotsG = railsG = null;
    selectionDotsG = hoverLineEl = overlayEl = null;
    isMouseHovering = false;
    hoverDatum = null;
    lastMouseX = null;
    prevSelectionDatum = null;
    clipRectSel = dotsClipRectSel = null;
    clipPathId  = dotsClipPathId  = null;
    lastData = lastProps = lastPayload = null;
    activeZoomTransform = null;
  }

  // Repaint the selection dots + persistent hover line at the current
  // `selectedX` value WITHOUT going through a full render — used by the
  // Vue wrapper's selectedX-only watcher.
  //
  // Tween policy:
  //   - `selectionDuration > 0` AND the new pin doesn't match the
  //     cursor's current hover datum  →  ride the rail from the prev
  //     pin to the new one over `selectionDuration` ms.
  //   - otherwise  →  snap (duration 0).
  //
  // The "matches cursor" check makes click-to-pin snap (a click is by
  // definition "where the cursor is" — tweening there would visibly lag).
  // Programmatic sets — "Pin to 2010" button, synced charts — flow
  // through the tween path.
  //
  // Accepts a `propsOverride` because the caller (Vue's small watcher)
  // sends a fresh snapshot of props.  Without this, `lastProps` (also a
  // snapshot, captured at the last big-watcher / render call) would
  // still hold the OLD `selectedX` value — the dots would redraw at the
  // previous pin instead of the just-clicked one.
  function refreshSelection(propsOverride) {
    if (propsOverride) lastProps = propsOverride;
    if (!lastPayload || !lastProps) return;
    const data = lastData ?? lastProps.data ?? [];
    const scales = buildScales(data, lastPayload, lastProps, activeZoomTransform);
    if (!scales) return;

    const selectedXDatum = lastProps.selectedX != null
      ? data.find((d) => d.name === lastProps.selectedX)
      : null;
    const isAtCursor = hoverDatum && selectedXDatum && hoverDatum === selectedXDatum;
    const dur = (!isAtCursor && (lastProps.selectionDuration ?? 0) > 0)
      ? lastProps.selectionDuration
      : 0;
    drawSelectionDots({
      payload: lastPayload,
      props:   lastProps,
      scales,
      duration: dur,
      tween:   dur > 0,
    });
  }

  return {
    render,
    rerender(props) { if (lastPayload) render(lastPayload, props); },
    refreshSelection,
    onZoom,
    setOrder: (o) => base.setOrder(o),
    destroy,
    /**
     * Returns the SVG `<path id>` for the invisible label-rail path of the
     * given series key.  Sibling LineLabelLayers build their `<textPath
     * href>` from this so labels stay anchored to a stable curve even when
     * the visible line goes through the three-phase slide choreography.
     */
    getPathId: pathIdForRail,
    /**
     * Returns the length-offset on the final-state rail of `seriesKey`
     * where the data point `dataId` sits — letting labels anchor to a
     * concrete data point (e.g. "y-1994") instead of a relative position.
     * Returns null when the series or data id is unknown.
     */
    computeAnchorOffset,
    /**
     * Returns { x, y } screen coords of a series' last defined point — the
     * visual end of its line — for `anchor="lineEnd"` end-of-line labels.
     * Returns null when the series is unknown or fully undefined.
     */
    getSeriesEndPoint,
  };
}
