import * as d3 from "d3";
import { createLayer } from "./layer.js";
import { resolveFill } from "../fill/resolveFill.js";
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

export const AREA_LAYER_DEFAULTS = {
  data:          [],
  keys:          null,
  color:         {},
  margin:        { top: 0, right: 0, bottom: 20, left: 0 },
  padding:       { top: 0, right: 0, bottom: 0, left: 0 },
  scaleType:     "linear",
  xScaleType:    "linear",
  parseTime:     null,
  max:           null,
  forceValues:   null,
  stacked:       false,
  curve:         "curveLinear",
  opacity:       0.3,
  strokeWidth:   0,
  strokeColor:   null,
  strokeOpacity: 1,
  upperKey:      null,
  lowerKey:      null,
  duration:      GLOBAL_DEFAULTS.duration,
  ease:          GLOBAL_DEFAULTS.ease,
  highlighted:   null,
  defaultColor:  "#9CA3AF",
};

// Single-series "band" wrapper that quacks like a d3.stack series — same
// [{0,1, data}] shape so the render path can consume both stacked and band.
//
// Defensive against swapped keys or inverted data: at each x we pin the
// LARGER value to the top edge (e[1]) and the SMALLER to the bottom edge
// (e[0]), so the band always surrounds the line regardless of which value
// the user fed into `upperKey` vs `lowerKey`.
function buildBandSeries(data, upperKey, lowerKey) {
  if (!data.length || !upperKey) return [];
  const band = data.map((d) => {
    const u = d.values?.[upperKey]?.value;
    const l = lowerKey ? (d.values?.[lowerKey]?.value ?? null) : 0;
    let top, bottom;
    if (u == null || l == null) {
      // Leave nulls alone so the line generator's .defined() drops the point.
      top    = u;
      bottom = l;
    } else {
      top    = Math.max(u, l);
      bottom = Math.min(u, l);
    }
    const e = [bottom, top];
    e.data = d;
    return e;
  });
  band.key = "_band";
  return [band];
}

// Read x/y scales from a projector (current or prev) and apply the active
// zoom transform if any.  Returns null when the projector hasn't been
// wired up yet.
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

function buildScales(data, payload, props, activeZoomTransform) {
  const scales = readScales(payload.projector, activeZoomTransform, payload.zoomAxes);
  if (!scales) return null;

  const isBand = !!props.upperKey;
  const series = isBand
    ? buildBandSeries(data, props.upperKey, props.lowerKey)
    : buildStackedSeries(data, resolveKeys(data, props.keys), props.stacked);

  return { ...scales, series, isBand };
}

function buildScalesForPhase(coreData, allData, projector, props, activeZoomTransform, zoomAxes) {
  const scales = readScales(projector, activeZoomTransform, zoomAxes);
  if (!scales) return null;

  const isBand = !!props.upperKey;
  const renderSeries = isBand
    ? buildBandSeries(allData, props.upperKey, props.lowerKey)
    : buildStackedSeries(allData, resolveKeys(coreData, props.keys), props.stacked);

  return { ...scales, series: renderSeries, isBand };
}

export function createAreaLayer({ onHover = null, onClick = null } = {}) {
  const base = createLayer({ className: "area-layer", prefer: "inner" });

  let contentG    = null;
  let areasG      = null;
  let clipRectSel = null;
  let clipPathId  = null;
  let lastData      = null;
  // Layer-owned previous projector — captured at end of every render.
  let lastProjector = null;
  let lastProps   = null;
  let lastPayload = null;
  let phaseToken  = 0;
  let activeZoomTransform = null;

  function initGroups(payload, layerContainer) {
    const outerG = base.ensureGroup(payload, layerContainer);
    if (contentG) return;
    clipPathId  = `al-clip-${++_clipId}`;
    let defs = d3.select(payload.svgEl).select("defs");
    if (defs.empty()) defs = d3.select(payload.svgEl).insert("defs", ":first-child");
    clipRectSel = defs.append("clipPath").attr("id", clipPathId).append("rect");
    contentG = outerG.append("g");
    areasG   = contentG.append("g").attr("class", "areas").attr("clip-path", `url(#${clipPathId})`);
  }

  function updateClipRect(payload, m, p) {
    if (!clipRectSel) return;
    const innerWidth = Math.max(0, payload.width - m.left - m.right - p.left - p.right);
    clipRectSel
      .attr("x", 0)
      .attr("y", -(m.top + p.top))
      .attr("width",  innerWidth)
      .attr("height", Math.max(0, payload.height));
  }

  function drawSeries({ payload, props, scales, duration }) {
    const { x, y, series, isBand } = scales;
    const svgEl = payload.svgEl;
    const curve = resolveCurve(props.curve);
    const easeFn = resolveEase(props.ease ?? payload.ease);

    const area = d3.area()
      .defined((d) => d[1] != null && d[0] != null)
      .x((d) => xPositionFor(d, x, props))
      .y0((d) => y(d[0]))
      .y1((d) => y(d[1]))
      .curve(curve);

    const baselineArea = d3.area()
      .defined((d) => d[1] != null && d[0] != null)
      .x((d) => xPositionFor(d, x, props))
      .y0(() => y(y.domain()[0]))
      .y1(() => y(y.domain()[0]))
      .curve(curve);

    const fillFor = (key, i) => {
      if (isBand) return resolveFill(props.color, svgEl) ?? props.defaultColor ?? "#9CA3AF";
      const c = typeof props.color?.[key] === "function"
        ? props.color[key](key, i)
        : props.color?.[key];
      return resolveFill(c, svgEl) ?? props.defaultColor ?? "#9CA3AF";
    };
    const strokeFor = (key, i) => {
      if (!props.strokeWidth) return "none";
      if (props.strokeColor != null) return resolveFill(props.strokeColor, svgEl);
      return fillFor(key, i);
    };

    areasG.selectAll("path.area").data(series, (s) => s.key).join(
      (enter) => enter.append("path")
        .attr("class", "area")
        .attr("fill", (s, i) => fillFor(s.key, i))
        .attr("fill-opacity", props.opacity ?? 0.3)
        .attr("stroke", (s, i) => strokeFor(s.key, i))
        .attr("stroke-width", props.strokeWidth ?? 0)
        .attr("stroke-opacity", props.strokeOpacity ?? 1)
        .attr("d", (s) => baselineArea(s))
        .attr("opacity", 0)
        .call((e) => duration > 0
          ? e.transition().duration(duration).ease(easeFn)
              .attr("opacity", 1)
              .attr("d", (s) => area(s))
          : e.attr("opacity", 1).attr("d", (s) => area(s))),
      (update) => update.call((u) => duration > 0
        ? u.transition().duration(duration).ease(easeFn)
            .attr("fill", (s, i) => fillFor(s.key, i))
            .attr("fill-opacity", props.opacity ?? 0.3)
            .attr("stroke", (s, i) => strokeFor(s.key, i))
            .attr("stroke-width", props.strokeWidth ?? 0)
            .attr("stroke-opacity", props.strokeOpacity ?? 1)
            // Re-assert opacity:1.  If an enter transition was still running
            // when this update interrupted it, the element is stuck at the
            // interpolated opacity (e.g. ~0.01) — without this line a
            // subsequent exit would animate from near-zero opacity to zero,
            // making the collapse visually imperceptible.  Mirrors lineLayer.
            .attr("opacity", 1)
            .attr("d", (s) => area(s))
        : u.attr("fill", (s, i) => fillFor(s.key, i))
            .attr("fill-opacity", props.opacity ?? 0.3)
            .attr("stroke", (s, i) => strokeFor(s.key, i))
            .attr("stroke-width", props.strokeWidth ?? 0)
            .attr("stroke-opacity", props.strokeOpacity ?? 1)
            .attr("opacity", 1)
            .attr("d", (s) => area(s))),
      (exit) => exit.call((e) => duration > 0
        ? e.transition().duration(duration).ease(easeFn)
            .attr("opacity", 0)
            .attr("d", (s) => baselineArea(s))
            .remove()
        : e.remove()),
    );
  }

  function render(payload, props) {
    if (!payload?.svgEl) return;
    // Cancel any pending rAF callbacks from a previous three-phase sequence —
    // same pattern as lineLayer.
    ++phaseToken;
    // See lineLayer for the full rationale: only update activeZoomTransform
    // from the payload on a NEW draw — never on a rerender (which passes the
    // cached lastPayload back) — otherwise an onZoom-updated transform gets
    // overwritten by a stale draw-time one, snapping content to pre-pan pos.
    const isNewPayload = payload !== lastPayload;
    lastProps   = props;
    lastPayload = payload;
    // Capture old zoom before updating — Phase A of the 3-phase choreography
    // must use the zoom the user was actually seeing (same pattern as lineLayer).
    const prevZoomTransform = activeZoomTransform;
    if (isNewPayload) {
      activeZoomTransform = zoomFromPayload(payload, activeZoomTransform);
    }

    initGroups(payload, props.layerContainer?.value ?? props.layerContainer ?? null);
    base.group?.attr("transform", null);

    // Universal contentG translate diff (see LineLayer / ref layers for
    // rationale): (chartM + chartP) - canvasM.
    const cm = payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const m  = props.margin  ?? cm;
    const p  = props.padding ?? payload.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const dx = m.left + p.left - cm.left;
    const dy = m.top  + p.top  - cm.top;
    contentG.attr("transform", (dx || dy) ? `translate(${dx}, ${dy})` : null);
    updateClipRect(payload, m, p);

    const currData = props.data ?? [];
    const prevData = lastData;
    // payload.duration FIRST: lets the canvas force a 0-duration redraw
    // (e.g. on resize) regardless of the layer's configured prop duration.
    const dur = payload.duration ?? props.duration ?? 0;

    const scales = buildScales(currData, payload, props, activeZoomTransform);
    if (!scales) return;  // no projector yet

    if (!prevData?.length) {
      drawSeries({ payload, props, scales, duration: dur });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    const prevIds = prevData.map((d) => d.id);
    const currIds = currData.map((d) => d.id);

    if (idsEqual(prevIds, currIds)) {
      drawSeries({ payload, props, scales, duration: dur });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    if (!isEdgeOnlyChange(prevIds, currIds)) {
      drawSeries({ payload, props, scales, duration: dur });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    // Edge-only structural change → 3-phase choreography.
    // Phase A: old projector + OLD zoom (prevZoomTransform) — must match
    // what the user was actually seeing before this render.
    // Phase B / C: current projector + NEW zoom (activeZoomTransform).
    const mergedOld    = mergeDataEdges(prevData, currData);
    const mergedNew    = mergeDataEdges(currData, prevData);
    const phaseAScales = buildScalesForPhase(prevData, mergedOld, lastProjector,    props, prevZoomTransform,   payload.zoomAxes);
    const phaseBScales = buildScalesForPhase(currData, mergedNew, payload.projector, props, activeZoomTransform, payload.zoomAxes);
    const phaseCScales = scales;

    if (!phaseAScales || !phaseBScales) {
      drawSeries({ payload, props, scales: phaseCScales, duration: dur });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    const token = phaseToken;  // snapshot — already incremented at render start


    drawSeries({ payload, props, scales: phaseAScales, duration: 0 });
    requestAnimationFrame(() => {
      if (token !== phaseToken) return;
      drawSeries({ payload, props, scales: phaseBScales, duration: dur });
      setTimeout(() => {
        if (token !== phaseToken) return;
        areasG.selectAll("path.area").interrupt();
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
      const scales = buildScales(lastData ?? lastProps.data ?? [], lastPayload, lastProps, activeZoomTransform);
      if (!scales) return;
      drawSeries({ payload: lastPayload, props: lastProps, scales, duration: 0 });
    }
  }

  function destroy() {
    // Invalidate any in-flight three-phase choreography so its pending rAF /
    // setTimeout callbacks short-circuit instead of running against null groups.
    ++phaseToken;
    if (lastPayload?.svgEl) {
      const svgSel = d3.select(lastPayload.svgEl);
      if (clipPathId) svgSel.select(`#${clipPathId}`).remove();
    }
    base.destroy();
    contentG = areasG = null;
    clipRectSel = null;
    clipPathId  = null;
    lastData = lastProps = lastPayload = null;
    activeZoomTransform = null;
  }

  return {
    render,
    rerender(props) { if (lastPayload) render(lastPayload, props); },
    onZoom,
    setOrder: (o) => base.setOrder(o),
    destroy,
  };
}
