/**
 * Axis layer designed to animate in lockstep with LineLayer / AreaLayer.
 *
 * Runs the SAME three-phase choreography as the line/area layers: when an
 * edge-only structural change is detected the ticks slide horizontally
 * alongside the line instead of fading out and back in with a delay.
 *
 *   Phase A: ticks at OLD-scale positions (instant)
 *   Phase B: ticks at NEW-scale positions (transition)
 *   Phase C: regular scale, padding ticks dropped (instant)
 *
 * No clip path — tick values come from `scale.ticks(N)` so they always
 * fall inside the visible x-range; clipping the axis would also cut off
 * the leading / trailing label halves at the chart edges.
 */
import { createLayer } from "./layer.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";
import { zoomFromPayload } from "../utils/zoomFromPayload.js";
import {
  isEdgeOnlyChange,
  mergeDataEdges,
} from "../utils/animation/categoryDiff.js";
import { idsEqual } from "./_seriesCommon.js";

export const LINE_AXIS_LAYER_DEFAULTS = {
  side:          "bottom",
  data:          [],
  margin:        { top: 0, right: 0, bottom: 20, left: 0 },
  padding:       { top: 0, right: 0, bottom: 0, left: 0 },
  xScaleType:    "linear",
  parseTime:     null,
  // Tick generation — matches d3.axisBottom's behaviour. `numTicks` is a hint
  // passed to scale.ticks(N); d3 picks a nice round subset close to that count
  // (e.g. 10 → ~8–10 ticks at decade intervals for a 75-year domain).  Pass
  // `tickValues` to override and render exactly those values.
  numTicks:      10,
  tickValues:    null,
  tickFormat:    null,
  tickSize:      6,
  tickColor:     null,
  tickTextColor: null,
  fontSize:      10,
  // Vertical grid lines, one per tick value, spanning the plot height.
  // Mirrors YAxisLayer's grid props (gridColor / gridDasharray / gridOpacity).
  showGrid:      false,
  gridColor:     null,
  gridDasharray: null,
  gridOpacity:   1,
  duration:      GLOBAL_DEFAULTS.duration,
  ease:          GLOBAL_DEFAULTS.ease,
};

// --- helpers ---------------------------------------------------------------

// Read x-scale from a projector and apply the active zoom transform if the
// canvas's `zoomAxes` setting includes "x".  When the canvas declares
// y-only or no zoom, the x-axis ticks stay put.
function readXScale(projector, activeZoomTransform, zoomAxes) {
  if (!projector?.raw?.xScale) return null;
  let xScale = projector.raw.xScale;
  if (activeZoomTransform && (zoomAxes === "xy" || zoomAxes === "x" || zoomAxes === undefined)) {
    xScale = activeZoomTransform.rescaleX(xScale);
  }
  return xScale;
}

// Tick values come from the scale — same logic d3.axisBottom uses internally
// — so the axis shows a nice round subset (1950, 1960, 1970, …) regardless
// of how many data points underlie it.
function computeTickValues(scale, props) {
  if (props.tickValues) return props.tickValues;
  if (typeof scale.ticks === "function") return scale.ticks(props.numTicks ?? 10);
  return scale.domain ? scale.domain() : [];
}

function defaultFormat(scale, props) {
  if (props.tickFormat) return props.tickFormat;
  if (typeof scale.tickFormat === "function") return scale.tickFormat();
  return (v) => v;
}

// Stable join key — numbers and primitives by identity, Dates by timestamp.
function tickKey(v) {
  return v instanceof Date ? +v : v;
}

// --- factory ---------------------------------------------------------------

export function createLineAxisLayer() {
  const base = createLayer({ className: "line-axis-layer", prefer: "inner" });

  let gridG       = null;
  let axisG       = null;
  let domainLine  = null;
  let lastData      = null;
  // Layer-owned previous projector — captured at end of every render.
  let lastProjector = null;
  let lastProps   = null;
  let lastPayload = null;
  let phaseToken  = 0;
  let activeZoomTransform = null;

  function initGroups(payload, layerContainer) {
    const outerG = base.ensureGroup(payload, layerContainer);
    if (axisG) return;
    // gridG appended first so grid lines render behind the axis ticks/labels
    // within this layer's group.  (For grid-behind-line, the preset owns the
    // overall layer order: set it below the line layer's order.)
    gridG = outerG.append("g").attr("class", "line-axis-grid");
    axisG = outerG.append("g").attr("class", "line-axis");
    domainLine = axisG.append("line").attr("class", "domain");
  }

  // ---- Tick rendering -----------------------------------------------------

  function drawTicks({ payload, props, x, duration, m, p }) {
    const isBottom = props.side !== "top";
    // MARGIN-ONLY — the axis's own spine (and its grid) anchors to the fixed
    // plot frame, not the padding-inset data area, mirroring how YAxisLayer's
    // xPos (0 / plotWidth) ignores padding. Padding only insets where the
    // DATA renders (LineLayer's own scale/translate); tick x-positions
    // already read that real, padding-aware scale via `x(v)`.
    const innerHeight = payload.height - m.top - m.bottom;
    const innerWidth  = payload.width  - m.left - m.right  - p.left - p.right;
    const cm = payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const offsetX     = m.left + p.left - cm.left;
    const offsetY     = (isBottom ? (m.top + innerHeight) : m.top) - cm.top;
    const gridOffsetY = m.top - cm.top;  // always anchored to top of plot
    const tickSize = props.tickSize ?? 6;
    const tickEnd  = isBottom ? tickSize : -tickSize;
    const labelY   = isBottom ? tickSize + 3 : -tickSize - 3;
    const labelDy  = isBottom ? "0.71em" : "0em";
    const fontSize = props.fontSize ?? 10;
    const tickColor     = props.tickColor     ?? "currentColor";
    const tickTextColor = props.tickTextColor ?? "currentColor";

    axisG.attr("transform", `translate(${offsetX}, ${offsetY})`);
    if (gridG) gridG.attr("transform", `translate(${offsetX}, ${gridOffsetY})`);

    const tickValues = computeTickValues(x, props);
    const fmt        = defaultFormat(x, props);

    // Grid lines — one vertical line per tick, spanning the plot height.
    // Same data + key as the ticks so they animate in lockstep.
    if (gridG) {
      if (props.showGrid) {
        const gridColor = props.gridColor     ?? "#e5e7eb";
        const gridDash  = props.gridDasharray ?? null;
        const gridOp    = props.gridOpacity   ?? 1;

        const gridSel = gridG.selectAll("line.grid").data(tickValues, tickKey);
        const gridEnter = gridSel.enter().append("line")
          .attr("class", "grid")
          .attr("x1", (v) => x(v))
          .attr("x2", (v) => x(v))
          .attr("y1", 0)
          .attr("y2", Math.max(0, innerHeight))
          .attr("opacity", 0);

        const gridMerged = gridEnter.merge(gridSel);
        if (duration > 0) {
          gridMerged.transition().duration(duration)
            .attr("x1", (v) => x(v))
            .attr("x2", (v) => x(v))
            .attr("opacity", 1);
        } else {
          gridMerged
            .attr("x1", (v) => x(v))
            .attr("x2", (v) => x(v))
            .attr("opacity", 1);
        }
        gridMerged
          .attr("y2", Math.max(0, innerHeight))
          .attr("stroke", gridColor)
          .attr("stroke-dasharray", gridDash)
          .attr("stroke-opacity", gridOp);

        gridSel.exit()
          .call((s) => duration > 0
            ? s.transition().duration(duration).attr("opacity", 0).remove()
            : s.remove());
      } else {
        gridG.selectAll("line.grid").remove();
      }
    }

    const sel = axisG.selectAll("g.tick").data(tickValues, tickKey);

    const enter = sel.enter().append("g")
      .attr("class", "tick")
      .attr("transform", (v) => `translate(${x(v)}, 0)`)
      .attr("opacity", 0);
    enter.append("line")
      .attr("y2", tickEnd)
      .attr("stroke", tickColor);
    enter.append("text")
      .attr("y", labelY)
      .attr("dy", labelDy)
      .attr("text-anchor", "middle")
      .attr("fill", tickTextColor)
      .style("font-size", `${fontSize}px`)
      .text((v) => fmt(v));

    const merged = enter.merge(sel);
    if (duration > 0) {
      merged.transition().duration(duration)
        .attr("transform", (v) => `translate(${x(v)}, 0)`)
        .attr("opacity", 1);
    } else {
      merged
        .attr("transform", (v) => `translate(${x(v)}, 0)`)
        .attr("opacity", 1);
    }

    merged.select("line").attr("stroke", tickColor);
    merged.select("text")
      .attr("fill", tickTextColor)
      .style("font-size", `${fontSize}px`)
      .text((v) => fmt(v));

    sel.exit()
      .call((s) => duration > 0
        ? s.transition().duration(duration).attr("opacity", 0).remove()
        : s.remove());

    domainLine
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", 0)
      .attr("y2", 0)
      .attr("stroke", tickColor)
      .attr("stroke-opacity", 1);
  }

  // ---- Choreography (mirrors LineLayer) -----------------------------------

  function render(payload, props) {
    if (!payload?.svgEl) return;
    // Cancel any pending rAF callbacks from a previous three-phase sequence —
    // same pattern as lineLayer.
    ++phaseToken;
    // Only update activeZoomTransform from the payload on a NEW draw —
    // a rerender (same payload ref) must keep whatever onZoom has cached,
    // otherwise prop-change rerenders snap the axis back to pre-pan pos.
    // See lineLayer.js for the full rationale.
    const isNewPayload = payload !== lastPayload;
    lastProps   = props;
    lastPayload = payload;
    // Capture old zoom before updating — Phase A must use the zoom the
    // user was actually seeing, not the new target zoom (same pattern as lineLayer).
    const prevZoomTransform = activeZoomTransform;
    if (isNewPayload) {
      activeZoomTransform = zoomFromPayload(payload, activeZoomTransform);
    }

    initGroups(payload, props.layerContainer?.value ?? props.layerContainer ?? null);
    base.group?.attr("transform", null);

    // Effective margin / padding (fall back to canvas margin so the layer
    // works whether the canvas owns the margin or the chart does).
    const cm = payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const m  = props.margin  ?? cm;
    const p  = props.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };

    const currData = props.data ?? [];
    const prevData = lastData;
    // payload.duration FIRST: lets the canvas force a 0-duration redraw
    // (e.g. on resize) regardless of the layer's configured prop duration.
    const dur = payload.duration ?? props.duration ?? 0;

    if (typeof window !== "undefined" && window.__ZOOM_DEBUG__) {
      // eslint-disable-next-line no-console
      console.log("[lineAxisLayer] render", {
        payloadDuration: payload.duration,
        propsDuration: props.duration,
        effectiveDur: dur,
        zoomK: activeZoomTransform?.k ?? 1,
        prevCount: prevData?.length ?? 0,
        currCount: currData.length,
      });
    }

    const xCurrent = readXScale(payload.projector, activeZoomTransform, payload.zoomAxes);
    if (!xCurrent) return;  // projector not wired yet

    if (!prevData?.length) {
      drawTicks({ payload, props, x: xCurrent, duration: dur, m, p });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    const prevIds = prevData.map((d) => d.id);
    const currIds = currData.map((d) => d.id);

    if (idsEqual(prevIds, currIds)) {
      drawTicks({ payload, props, x: xCurrent, duration: dur, m, p });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    if (!isEdgeOnlyChange(prevIds, currIds)) {
      drawTicks({ payload, props, x: xCurrent, duration: dur, m, p });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    // Edge-only structural change → 3-phase choreography.  Phase A uses
    // the LAYER's cached prev projector at the OLD zoom (prevZoomTransform)
    // so the ticks start from where the user was actually seeing them.
    // Phase B / C use the current projector + active zoom.
    const xPrev = readXScale(lastProjector, prevZoomTransform, payload.zoomAxes);
    if (!xPrev) {
      drawTicks({ payload, props, x: xCurrent, duration: dur, m, p });
      lastData      = currData;
      lastProjector = payload.projector;
      return;
    }

    const token = phaseToken;  // snapshot — already incremented at render start

    drawTicks({ payload, props, x: xPrev, duration: 0, m, p });

    requestAnimationFrame(() => {
      if (token !== phaseToken) return;
      drawTicks({ payload, props, x: xCurrent, duration: dur, m, p });
      setTimeout(() => {
        if (token !== phaseToken) return;
        axisG.selectAll("g.tick").interrupt();
        gridG?.selectAll("line.grid").interrupt();
        drawTicks({ payload, props, x: xCurrent, duration: 0, m, p });
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
      const cm = lastPayload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const m  = lastProps.margin  ?? cm;
      const p  = lastProps.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };
      const x = readXScale(lastPayload.projector, activeZoomTransform, lastPayload.zoomAxes);
      if (!x) return;
      drawTicks({ payload: lastPayload, props: lastProps, x, duration: 0, m, p });
    }
  }

  function destroy() {
    base.destroy();
    gridG = axisG = domainLine = null;
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
