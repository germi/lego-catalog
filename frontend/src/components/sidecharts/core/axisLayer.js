import * as d3 from "d3";
import { computeMax } from "../utils/scale/computeMax.js";
import { computeEnterPhasing, survivingValuesChanged } from "../utils/animation/phaseTiming.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";

export const AXIS_LAYER_DEFAULTS = {
  side:          "bottom",
  data:          [],
  margin:        { top: 0, right: 0, bottom: 20, left: 0 },
  padding:       { top: 0, right: 0, bottom: 0, left: 0 },
  scale:         null,
  max:           null,
  stacked:       true,
  // Opt in to the ribbon's category enter/exit choreography: exiting ticks fade
  // (phase 1), surviving ticks slide (phase 2), entering ticks fade in last —
  // delays computed with the SAME computeEnterPhasing helper the bars use, so the
  // x-axis labels stay in lockstep. Off → ticks transition straight to position.
  phased:        false,
  tickValues:    null,
  tickFormat:    (d) => d,
  numTicks:      null,
  paddingInner:  0.1,
  paddingOuter:  0.1,
  ease:          GLOBAL_DEFAULTS.ease,
  duration:      GLOBAL_DEFAULTS.duration,
  tickColor:     null,
  tickTextColor: null,
  tickFontSize:  null,
  // Incline the tick labels. User-facing angle in degrees:
  //   > 0 → label ENDS at the tick   (text-anchor "end")   e.g. 45, 90
  //   < 0 → label STARTS at the tick (text-anchor "start") e.g. -45, -90
  //   0   → horizontal, centered (default)
  tickAngle:     0,
  // Stagger horizontal tick labels across N rows to reduce overlap. 1 = off
  // (default). 2 = labels alternate between the normal row and a second row
  // below, with the tick line extended to reach the lower row; 3 = three rows
  // (i % 3); etc. Ignored when tickAngle ≠ 0 (angled labels own the transform).
  tickStagger:   1,
  showGrid:      false,
  gridColor:     "#e5e7eb",
  gridDasharray: null,
  gridOpacity:   1,
};

// Rotate tick labels so the near end of the label always lands at (0, gap) in
// tick-group space, regardless of angle or RTL.
//
// D3 axis *animates* text `y` to tickSizeInner(6) + tickPadding(3) = 9 (bottom)
// or -9 (top) via the transition, so setting y=0 synchronously gets overridden.
// Instead we compensate for D3's y=9 in our own translation.
//
// RTL model: we SET the tick text's `direction` to match the projector's logical
// `rtl` flag (rather than reading the inherited value or forcing ltr). This does
// two jobs at once and is host-page independent:
//   1. Correct bidi rendering of the label CONTENT — multi-word Arabic labels
//      ("السكك الحديدية") need direction:rtl to keep their word order. (This is
//      why we can't force ltr like yAxisLayer, whose ticks are numbers.)
//   2. Makes `text-anchor` deterministic: with direction pinned, logical "end"
//      maps to a KNOWN physical side, so no XOR against an unknown host `dir`.
//
// Under RTL the x-axis is physically mirrored (a horizontal flip), so the
// GEOMETRY mirrors — svgRot = +angle and tx flips sign. But because we also set
// direction:rtl, logical "end" already resolves to the mirrored physical side,
// so the anchor rule stays the plain angle>0→"end". Geometry (rotate/translate)
// is independent of text `direction`; only glyph side depends on it.
function applyTickLabelAngle(axisG, props, rtl) {
  const angle = props?.tickAngle ?? 0;
  const isBottom = props?.side !== "top";
  const sel = axisG.selectAll(".tick text");
  if (!angle) {
    sel
      .attr("text-anchor", null)
      .attr("transform", null)
      .attr("dy", isBottom ? "0.71em" : "0em")
      .attr("dominant-baseline", null)
      .style("direction", null);
    return;
  }
  const el  = sel.node();
  const em  = el ? parseFloat(getComputedStyle(el).fontSize) : 10;
  const dY  = isBottom ? 9 : -9;
  const gap = (isBottom ? 1 : -1) * (6 + em * 0.35);
  // RTL = horizontal flip → mirror the SVG rotation (+angle instead of -angle).
  // The D3-y compensation then follows from the same rotation: transforming the
  // text's local anchor (0, dY) by rotate(svgRot) lands it at (dY·sin, dY·cos),
  // so tx = dY·sin(svgRot) cancels the x-drift and ty targets the gap.
  const svgRot = rtl ? angle : -angle;
  const rot    = svgRot * Math.PI / 180;
  const tx     = dY * Math.sin(rot);
  const ty     = gap - dY * Math.cos(rot);
  sel
    // Pin direction to the chart's logical rtl (fixes Arabic bidi + physical anchor).
    .style("direction", rtl ? "rtl" : "ltr")
    .attr("text-anchor", angle > 0 ? "end" : "start")
    .attr("dy", null)
    .attr("dominant-baseline", "central")
    .attr("transform", `translate(${+tx.toFixed(3)},${+ty.toFixed(3)}) rotate(${svgRot})`);
}

// Stagger horizontal tick labels across `tickStagger` rows so they overlap less.
// Label i goes to row (i % rows): row 0 stays put, deeper rows are pushed further
// from the axis and their tick LINE is extended to reach them.
//
// Like the angle helper we use `transform` (never touched by D3) instead of the
// `y` / `y2` attrs, which D3 animates on the axis transition and would override:
//   - text  → translate down by row·rowHeight (adds to D3's y).
//   - line  → scaleY so its rendered length grows from 6 to 6 + row·rowHeight
//             (vector-effect keeps the stroke thin under the scale).
// No-op when tickAngle ≠ 0 (the angle helper owns the text transform there).
function applyTickStagger(axisG, props) {
  if (props?.tickAngle) return;
  const rows = Math.max(1, Math.floor(props?.tickStagger ?? 1));
  const isBottom = props?.side !== "top";
  const dir = isBottom ? 1 : -1;
  const ticks = axisG.selectAll(".tick");
  if (rows <= 1) {
    ticks.select("text").attr("transform", null);
    ticks.select("line").attr("transform", null).attr("vector-effect", null);
    return;
  }
  const el   = axisG.selectAll(".tick text").node();
  const em   = el ? parseFloat(getComputedStyle(el).fontSize) : 10;
  const rowH = em * 1.6;   // vertical spacing between rows
  const base = 6;          // D3 tickSizeInner
  ticks.each(function (_d, i) {
    const drop = (i % rows) * rowH;
    const g = d3.select(this);
    g.select("text").attr("transform", drop ? `translate(0,${dir * drop})` : null);
    g.select("line")
      .attr("transform", drop ? `scale(1,${((base + drop) / base).toFixed(3)})` : null)
      .attr("vector-effect", drop ? "non-scaling-stroke" : null);
  });
}

export function createAxisLayer() {
  let lastPayload    = null;
  let lastProps      = null;
  let lastProjector  = null;
  let lastTransform  = null;
  let lastRenderData = null;
  let axisLayer      = null;
  let axisG          = null;
  let gridG          = null;
  let lastOrder      = undefined;
  let usingInnerEl   = false;
  let lastBandScale  = null;
  let lastBarWidth   = 0;
  let lastBarHeight  = 0;

  // Returns the base (unzoomed) scale for this axis.
  // Priority: explicit props.scale > projector.raw.xScale (scatter mode) > null (band mode).
  function getBaseScale(props, projector) {
    if (props?.scale) return props.scale;
    if (projector?.type === "scale") return projector.raw?.xScale ?? null;
    return null;
  }

  function initGroups(svgEl, innerEl) {
    if (axisLayer) return;
    // Append into innerEl when available so we're DOM-siblings with scatter /
    // voronoi layers — data-order sorting only works across siblings.
    const parentNode = innerEl ?? svgEl;
    usingInnerEl = !!innerEl;
    axisLayer = d3.select(parentNode).append("g").attr("class", "axis-layer");
    gridG     = axisLayer.append("g").attr("class", "x-axis-grid");
    axisG     = axisLayer.append("g").attr("class", "axis-line");
  }

  function render(payload, props) {
    if (!payload?.svgEl || !axisLayer) return;
    lastPayload   = payload;
    lastProps     = props;
    lastProjector = payload.projector ?? null;
    // Pick up the canvas's current zoom transform (set by fireDraw).  This
    // is how programmatic zoom delivers the new transform to the axis
    // without going through onZoom — the cartesian path below applies it
    // to baseScale so ticks transition to the post-zoom positions.
    lastTransform = payload.zoomTransform ?? lastTransform ?? null;

    const m = props.margin;
    const p = props.padding;

    const plotWidth  = payload.width  - m.left - m.right;
    const plotHeight = payload.height - m.top  - m.bottom;
    const barWidth   = plotWidth  - p.left - p.right;
    const barHeight  = plotHeight - p.top  - p.bottom;
    const duration   = payload.duration ?? 0;

    // When inside innerEl, only the residual margin not already provided by
    // innerEl's own translate needs to be applied. innerEl.translate = canvas
    // margin (payload.margin); layer margin may differ (e.g. ribbon chart where
    // BaseCanvas has no margin but AxisLayer has margin.top=12, bottom=20).
    const cm = usingInnerEl ? (payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 }) : { top: 0, right: 0, bottom: 0, left: 0 };
    const dl = m.left - cm.left;
    const dt = m.top  - cm.top;
    axisLayer.attr("transform", (dl || dt) ? `translate(${dl}, ${dt})` : null);

    renderHorizontal(plotWidth, plotHeight, barWidth, barHeight, duration, props);

    lastRenderData = props.data;
  }

  // `plotHeight` here is the MARGIN-ONLY inner height — the axis's own spine
  // (and its grid) anchors to the fixed plot frame, not the padding-inset data
  // area, mirroring how yAxisLayer's `xPos` (0 / plotWidth) ignores padding.
  // Padding only insets where the DATA renders (via the scale's own range);
  // tick positions already read that real, padding-aware scale.
  function applyXGrid(xScale, isBottom, plotHeight, p, duration, props) {
    if (!props.showGrid) {
      gridG.selectAll("*").transition().duration(duration).attr("opacity", 0).remove();
      return;
    }
    const gridSpan = isBottom ? -plotHeight : plotHeight;
    const gridFn   = (isBottom ? d3.axisBottom(xScale) : d3.axisTop(xScale))
      .tickSize(gridSpan).tickFormat("");
    if (props.tickValues) gridFn.tickValues(props.tickValues);
    else if (props.numTicks) gridFn.ticks(props.numTicks);

    gridG
      .attr("transform", `translate(${p.left - 0.5}, ${isBottom ? plotHeight : 0})`)
      .transition().duration(duration)
      .call(gridFn);

    gridG.select(".domain").attr("display", "none");
    gridG.selectAll(".tick line")
      .attr("stroke", props.gridColor ?? "#e5e7eb")
      .attr("stroke-dasharray", props.gridDasharray ?? null)
      .attr("stroke-opacity", props.gridOpacity ?? 1);
  }

  function renderHorizontal(plotWidth, plotHeight, barWidth, barHeight, duration, props) {
    const isBottom = props.side !== "top";
    const p        = props.padding;

    // --- Continuous scale path (scatter / XY mode) ---
    const baseScale = getBaseScale(props, lastProjector);
    if (baseScale && typeof baseScale.bandwidth !== "function") {
      // Prefer the canvas's already-zoomed x-scale (`payload.xScale`) — the SAME
      // scale the dots use — so the axis stays glued to them, mirroring the y-axis.
      // It keeps the projector's range (RTL mirror included) and already honours
      // `zoomAxes`. Fall back to rescaling the base scale ourselves for
      // standalone/no-projector use. Never re-stamp the range (would drop RTL).
      const projX = (lastProjector?.type === "scale") ? lastPayload?.xScale : null;
      let x;
      if (projX && typeof projX.bandwidth !== "function") {
        x = projX;
      } else {
        x = baseScale.copy();
        if (lastTransform && lastTransform.k !== 1) x = lastTransform.rescaleX(x);
      }
      const yPos = isBottom ? plotHeight : 0;
      const fn   = (isBottom ? d3.axisBottom(x) : d3.axisTop(x))
        .tickFormat(props.tickFormat)
        .tickValues(props.tickValues ?? null);
      if (props.numTicks) fn.ticks(props.numTicks);

      axisG
        .attr("transform", `translate(${p.left - 0.5}, ${yPos})`)
        .transition().duration(duration)
        .call(fn);

      if (props.tickColor)     axisG.selectAll(".tick line").attr("stroke", props.tickColor);
      if (props.tickTextColor) axisG.selectAll(".tick text").attr("fill", props.tickTextColor);
      if (props.tickFontSize)  axisG.selectAll(".tick text").style("font-size", `${props.tickFontSize}px`);
      applyTickLabelAngle(axisG, props, !!lastProjector?.rtl);
      applyTickStagger(axisG, props);

      applyXGrid(x, isBottom, plotHeight, p, duration, props);

      lastRenderData = props.data;
      return;
    }

    // --- Band scale path (bar/ribbon charts) ---
    const prevData = lastRenderData ?? [];
    const prevIds  = new Set(prevData.map((d) => String(d.id)));
    const currIds  = new Set(props.data.map((d) => String(d.id)));

    const hasExitingCats  = prevData.length > 0 && [...prevIds].some((id) => !currIds.has(id));
    const hasEnteringCats = prevData.length > 0 && [...currIds].some((id) => !prevIds.has(id));

    // Use the projector's band scale when available — it already has the correct
    // range and, under RTL, the reversed domain (so ticks mirror the bars).
    // Fall back to building our own only when there's no projector (e.g. standalone use).
    const projBand = getBaseScale(props, lastProjector);
    const hasProjBand = projBand?.bandwidth != null;
    const x = hasProjBand
      ? projBand
      : d3.scaleBand()
          .domain(props.data.map((d) => d.id))
          .range([0, barWidth])
          .paddingInner(props.paddingInner)
          .paddingOuter(props.paddingOuter);

    // Phasing: when `props.phased`, mirror RibbonLayer EXACTLY so the labels move
    // in lockstep with the bars — same computeEnterPhasing helper, same
    // `waitForPhase2: needsSlide` input. needsSlide = did the bandwidth change or
    // any SURVIVING category move? (If not, entering ticks don't wait for a slide
    // phase, matching the bars.)
    //
    // Use lastBandScale as xPrev — it holds the band from the PREVIOUS render
    // (already RTL-aware if RTL was active). We cannot use lastProjector here
    // because lastProjector is updated to the CURRENT projector before
    // renderHorizontal is called, so it would give the new band (wrong).
    const xPrev = lastBandScale
      ?? (prevData.length
          ? d3.scaleBand()
              .domain(prevData.map((d) => d.id))
              .range([0, barWidth])
              .paddingInner(props.paddingInner)
              .paddingOuter(props.paddingOuter)
          : x);

    // needsSlide must match RibbonLayer EXACTLY (see ribbonLayer.js): with zero
    // surviving categories there is no phase-2 slide to wait for, even though the
    // bandwidth changes when the category COUNT changes — so guard on having at
    // least one survivor, otherwise entering ticks wait for a slide that never
    // happens (all-categories-change case).
    const survivingIds = props.data.map((d) => d.id).filter((id) => prevIds.has(String(id)));
    const needsSlide = survivingIds.length > 0 && (
      Math.abs((x.bandwidth?.() ?? 0) - (xPrev.bandwidth?.() ?? 0)) > 0.5 ||
      survivingIds.some((id) => {
        const pv = xPrev(id);
        const cv = x(id);
        return pv != null && cv != null && Math.abs(pv - cv) > 0.5;
      })
    );

    // Mirror RibbonLayer's value-static skip EXACTLY (same survivingValuesChanged
    // helper + same max-change guard) so the ticks make the identical phase1Dur
    // decision and stay glued to the bars when the value phase is dropped.
    const valuesChanged =
      computeMax(props.data, { max: props.max, stacked: props.stacked }) !==
        computeMax(prevData, { max: props.max, stacked: props.stacked }) ||
      survivingValuesChanged(prevData, props.data);

    const { phase1Dur, enterDelay } = props.phased
      ? computeEnterPhasing({
          duration,
          hasExits:      hasExitingCats,
          hasEnters:     hasEnteringCats,
          waitForPhase2: needsSlide,
          // Match RibbonLayer: ticks delay their slide by phase1Dur even with no
          // exits, so they reposition in lockstep with the bars' phase-2 slide.
          phase1OnSlide: true,
          valuesChanged,
        })
      : { phase1Dur: 0, enterDelay: 0 };

    lastBandScale = x;
    lastBarWidth  = barWidth;
    lastBarHeight = barHeight;

    const y = d3.scaleLinear()
      .domain([0, computeMax(props.data, { max: props.max, stacked: props.stacked })])
      .nice()
      .range([barHeight, 0]);

    const yPos = isBottom ? plotHeight : 0;

    axisG
      .attr("transform", `translate(${p.left - 0.5}, ${yPos})`)
      .transition()
      .delay(phase1Dur)
      .duration(duration)
      .ease(d3[props.ease])
      .call(
        (isBottom ? d3.axisBottom(x) : d3.axisTop(x))
          .tickFormat(props.tickFormat)
          .tickValues(props.tickValues ?? null),
      );

    if (hasExitingCats && phase1Dur > 0) {
      axisG.selectAll(".tick")
        .filter((d) => prevIds.has(String(d)) && !currIds.has(String(d)))
        .interrupt()
        .transition()
        .duration(phase1Dur)
        .ease(d3[props.ease])
        .attr("opacity", 0)
        .remove();
    }

    if (hasEnteringCats && duration > 0) {
      axisG.selectAll(".tick")
        .filter((d) => !prevIds.has(String(d)))
        .interrupt()
        .attr("opacity", 0)
        .transition()
        .delay(enterDelay)
        .duration(duration)
        .ease(d3[props.ease])
        .attr("opacity", 1);
    }

    if (props.tickColor)     axisG.selectAll(".tick line").attr("stroke", props.tickColor);
    if (props.tickTextColor) axisG.selectAll(".tick text").attr("fill", props.tickTextColor);
    if (props.tickFontSize)  axisG.selectAll(".tick text").style("font-size", `${props.tickFontSize}px`);
    applyTickLabelAngle(axisG, props, !!lastProjector?.rtl);
    applyTickStagger(axisG, props);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    const baseScale = getBaseScale(lastProps, lastProjector);
    const isBottom  = lastProps?.side !== "top";

    // --- Continuous scale (scatter / XY mode) ---
    if (baseScale && typeof baseScale.bandwidth !== "function") {
      // Prefer the canvas's freshly-zoomed x-scale (same one the dots get);
      // fall back to rescaling the raw scale for legacy events / no projector.
      const rescaled = (lastProjector?.type === "scale" && zoomArg?.xScale
                        && typeof zoomArg.xScale.bandwidth !== "function")
        ? zoomArg.xScale
        : transform.rescaleX(baseScale);
      const fn = (isBottom ? d3.axisBottom(rescaled) : d3.axisTop(rescaled))
        .tickFormat(lastProps?.tickFormat ?? ((d) => d))
        .tickValues(lastProps?.tickValues ?? null);
      if (lastProps?.numTicks) fn.ticks(lastProps.numTicks);

      axisG.call(fn);
      if (lastProps?.tickColor)     axisG.selectAll(".tick line").attr("stroke", lastProps.tickColor);
      if (lastProps?.tickTextColor) axisG.selectAll(".tick text").attr("fill", lastProps.tickTextColor);
      if (lastProps?.tickFontSize)  axisG.selectAll(".tick text").style("font-size", `${lastProps.tickFontSize}px`);
      applyTickLabelAngle(axisG, lastProps, !!lastProjector?.rtl);
      applyTickStagger(axisG, lastProps);

      if (lastProps?.showGrid && lastPayload) {
        const m         = lastProps.margin;
        const p         = lastProps.padding;
        const plotH     = lastPayload.height - m.top - m.bottom;
        applyXGrid(rescaled, isBottom, plotH, p, 0, lastProps);
      }
      return;
    }

    // --- Band scale (ribbon / bar charts) — stretch the range proportionally ---
    if (!lastBandScale || !lastProps || !axisG) return;
    const p      = lastProps.padding;
    const m      = lastProps.margin;
    const yPos   = isBottom ? (lastPayload.height - m.top - m.bottom) : 0;
    // Use the scale's own range endpoints rather than hardcoded 0/lastBarWidth so
    // RTL domain-reversed bands (whose range is still [0,W]) zoom correctly.
    const [r0, r1] = lastBandScale.range();
    const zoomedX = lastBandScale.copy().range([transform.applyX(r0), transform.applyX(r1)]);
    axisG
      .attr("transform", `translate(${p.left - 0.5}, ${yPos})`)
      .call(
        (isBottom ? d3.axisBottom(zoomedX) : d3.axisTop(zoomedX))
          .tickFormat(lastProps.tickFormat ?? ((d) => d))
          .tickValues(lastProps.tickValues ?? null),
      );
    if (lastProps.tickColor)     axisG.selectAll(".tick line").attr("stroke", lastProps.tickColor);
    if (lastProps.tickTextColor) axisG.selectAll(".tick text").attr("fill", lastProps.tickTextColor);
    if (lastProps.tickFontSize)  axisG.selectAll(".tick text").style("font-size", `${lastProps.tickFontSize}px`);
    applyTickLabelAngle(axisG, lastProps, !!lastProjector?.rtl);
    applyTickStagger(axisG, lastProps);
  }

  return {
    render(payload, props) {
      if (!payload?.svgEl) return;
      initGroups(payload.svgEl, payload.innerEl ?? null);
      lastPayload = payload;
      render(payload, props);
      // Re-apply order on every render (mirrors old applyOrder-in-render pattern).
      if (props?.order !== undefined && axisLayer) {
        lastOrder = props.order;
        applyOrderToGroup(axisLayer.node());
      }
    },
    rerender(duration, props) {
      if (lastPayload) render({ ...lastPayload, duration }, props);
    },
    onZoom,
    setOrder(order) {
      lastOrder = order;
      if (axisLayer) applyOrderToGroup(axisLayer.node());
    },
    destroy() {
      axisLayer?.remove();
      axisLayer      = null;
      axisG          = null;
      gridG          = null;
      lastRenderData = null;
      lastProps      = null;
      lastProjector  = null;
      lastOrder      = undefined;
      lastBandScale  = null;
      lastBarWidth   = 0;
      lastBarHeight  = 0;
    },
  };

  function applyOrderToGroup(node) {
    node.dataset.order = lastOrder;
    const parent = node.parentNode;
    if (parent) {
      const ordered = [...parent.querySelectorAll(":scope > [data-order]")];
      ordered.sort((a, b) => +a.dataset.order - +b.dataset.order);
      ordered.forEach((el) => parent.appendChild(el));
    }
  }
}
