import * as d3 from "d3";
import { buildScale } from "../utils/scale/buildScale.js";
import { computeMax } from "../utils/scale/computeMax.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";

export const YAXIS_LAYER_DEFAULTS = {
  side:             "left",
  scale:            null,
  scaleType:        "linear",
  max:              null,
  min:              0,
  nice:             true,
  data:             [],
  stacked:          true,
  margin:           { top: 0, right: 0, bottom: 20, left: 0 },
  padding:          { top: 0, right: 0, bottom: 0, left: 0 },
  showGrid:         false,
  tickValues:       null,
  tickFormat:       (d) => d,
  numTicks:         null,
  tickSize:         6,
  tickColor:        null,
  tickTextColor:    null,
  gridColor:        "#e5e7eb",
  gridDasharray:    null,
  gridOpacity:      1,
  ease:             GLOBAL_DEFAULTS.ease,
  duration:         GLOBAL_DEFAULTS.duration,
  textTicksInside:  true,
  rtl:              false,
};

export function createYAxisLayer() {
  let lastPayload   = null;
  let lastProps     = null;
  let lastProjector = null;
  let axisLayer     = null;
  let gridG         = null;
  let axisG         = null;
  let lastOrder     = undefined;
  let usingInnerEl  = false;

  // Returns the base (unzoomed) scale for this axis.
  // Priority: explicit props.scale > projector.raw.yScale (scatter mode) > null (computed mode).
  function getBaseScale(props, projector) {
    if (props?.scale) return props.scale;
    if (projector?.type === "scale") return projector.raw?.yScale ?? null;
    return null;
  }

  function initGroups(svgEl, innerEl) {
    if (axisLayer) return;
    // Append into innerEl when available so we're DOM-siblings with scatter /
    // voronoi layers — data-order sorting only works across siblings.
    const parentNode = innerEl ?? svgEl;
    usingInnerEl = !!innerEl;
    axisLayer = d3.select(parentNode).append("g").attr("class", "y-axis-layer");
    gridG     = axisLayer.append("g").attr("class", "y-axis-grid");
    axisG     = axisLayer.append("g").attr("class", "y-axis-line");
  }

  // Applies (or resets) the "inside" text-tick style on every call so newly
  // created or removed ticks (e.g. during zoom) always get the right style.
  function applyTextTickStyle(g, isLeft, props) {
    const sel = g.selectAll(".tick text")
      .attr("fill", props.tickTextColor ?? "currentColor")
      // Pin the writing direction to LTR so `text-anchor` start/end keep their
      // literal left/right meaning. The library does RTL by mirroring positions
      // physically (yAxisSide "start"→right via resolveInline), so anchoring is
      // PHYSICAL — but a HOST app that sets `dir="rtl"` on <html> (e.g. an Arabic
      // locale) leaks `direction: rtl` into the SVG and would flip start/end,
      // pushing the right-side axis numbers off-canvas. Forcing ltr here makes
      // anchoring deterministic regardless of the host page; numeric ticks render
      // identically under either direction.
      .style("direction", "ltr");
    // text-anchor is PHYSICAL (see above). `side` (hence `isLeft`) already
    // encodes the RTL mirror: a right-side axis correctly anchors "end" and reads
    // leftward into the plot.
    if (props.textTicksInside) {
      const labelX = isLeft ? 3 : -3;
      sel
        .style("transform", `translateX(${labelX}px)`)
        .attr("dy", "-0.35em")
        .attr("text-anchor", isLeft ? "start" : "end");
    } else {
      sel
        .style("transform", null)
        .attr("dy", "0.32em")
        .attr("text-anchor", isLeft ? "end" : "start");
    }
  }

  function render(payload, props) {
    if (!payload?.svgEl || !axisLayer) return;
    lastProps     = props;
    lastProjector = payload.projector ?? null;

    const m = props.margin;
    const p = props.padding;

    const plotWidth  = payload.width  - m.left - m.right;
    const plotHeight = payload.height - m.top  - m.bottom;
    const barHeight  = plotHeight - p.top - p.bottom;
    const duration   = payload.duration ?? 0;

    // When inside innerEl, only the residual margin not already provided by
    // innerEl's own translate needs to be applied. innerEl.translate = canvas
    // margin (payload.margin); layer margin may differ (e.g. ribbon chart where
    // BaseCanvas has no margin but YAxisLayer has margin.top=12, bottom=20).
    const cm = usingInnerEl ? (payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 }) : { top: 0, right: 0, bottom: 0, left: 0 };
    const dl = m.left - cm.left;
    const dt = m.top  - cm.top;
    axisLayer.attr("transform", (dl || dt) ? `translate(${dl}, ${dt})` : null);

    const isLeft = props.side !== "right";
    const xPos   = isLeft ? 0 : plotWidth;

    // --- Scale resolution ---
    // Priority: explicit props.scale > projector.raw.yScale > computed from data.
    const baseScale = getBaseScale(props, lastProjector);
    const domainMax = computeMax(props.data, { max: props.max, stacked: props.stacked });

    // Prefer the canvas's already-zoomed y-scale (`payload.yScale`) — the SAME
    // scale the dots use — so the axis rescales in lockstep. Its range already
    // encodes any `rangePad` padding, so we must NOT re-range to [barHeight,0] and
    // add a `p.top` group translate: that leaves the padding OUTSIDE the zoom
    // transform, drifting by (k−1)·p.top as you zoom. `yTranslate` compensates only
    // the residual — `p.top − rangeTop`, which is 0 for rangePad presets (scatter,
    // rangeTop = pad.top) and p.top for range-[0,h] presets (line/ribbon, rangeTop
    // = 0). `payload.yScale` already honours `zoomAxes` (x-only charts get the raw
    // scale), so no separate wantY guard is needed on this path.
    const projY = (lastProjector?.type === "scale") ? payload.yScale : null;
    let y, yTranslate;
    if (projY && typeof projY.bandwidth !== "function") {
      y = projY;
      yTranslate = p.top - (projY.range()[1] ?? 0);
    } else {
      y = baseScale
        ? baseScale.copy().range([barHeight, 0])
        : buildScale({
            type:   props.scaleType,
            domain: [props.min, domainMax],
            range:  [barHeight, 0],
            nice:   props.nice,
          });
      // No projector (standalone use): apply the draw-payload zoom ourselves.
      const zt = payload.zoomTransform;
      const zoomAxes = payload.zoomAxes ?? "xy";
      const wantY = zoomAxes === "xy" || zoomAxes === "y";
      if (y && wantY && zt && zt.k !== 1 && typeof y.bandwidth !== "function") {
        y = zt.rescaleY(y);
      }
      yTranslate = p.top;
    }

    if (props.showGrid) {
      const gridSpan = plotWidth;
      const gridFn   = isLeft ? d3.axisRight(y) : d3.axisLeft(y);
      gridFn.tickSize(gridSpan).tickFormat("");
      if (props.tickValues) gridFn.tickValues(props.tickValues);
      else if (props.numTicks) gridFn.ticks(props.numTicks);

      gridG
        .attr("transform", `translate(${xPos}, ${yTranslate})`)
        .transition()
        .duration(duration)
        .ease(d3[props.ease])
        .call(gridFn);

      gridG.select(".domain").attr("display", "none");
      gridG
        .selectAll(".tick line")
        .attr("stroke", props.gridColor)
        .attr("stroke-dasharray", props.gridDasharray ?? null)
        .attr("stroke-opacity", props.gridOpacity);
    } else {
      gridG.selectAll("*").transition().duration(duration).attr("opacity", 0).remove();
    }

    const mainFn = isLeft ? d3.axisLeft(y) : d3.axisRight(y);
    mainFn.tickSize(props.tickSize);
    if (props.tickValues) mainFn.tickValues(props.tickValues);
    else if (props.numTicks) mainFn.ticks(props.numTicks);
    mainFn.tickFormat(props.tickFormat);

    axisG
      .attr("transform", `translate(${xPos}, ${yTranslate})`)
      .transition()
      .duration(duration)
      .ease(d3[props.ease])
      .call(mainFn);

    axisG.select(".domain").attr("display", "none");
    axisG.selectAll(".tick line").attr("stroke", props.tickColor ?? "currentColor");
    applyTextTickStyle(axisG, isLeft, props);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    // Honour the canvas-declared zoom axes: if y isn't being zoomed we
    // don't rescale, so the y ticks stay put when the user pans/zooms
    // along x.
    const zoomAxes = lastPayload?.zoomAxes ?? "xy";
    if (zoomAxes !== "xy" && zoomAxes !== "y") return;

    if (!lastPayload) return;
    const isLeft = lastProps?.side !== "right";

    // Prefer the canvas's freshly-zoomed y-scale (same one the dots get) so the
    // axis stays glued to them. render() already set axisG's y-translate off this
    // scale's range (rangePad-aware), and that translate is unchanged by zoom, so
    // onZoom only swaps the scale. Fall back to re-ranging the raw scale when the
    // rich event carries no yScale (legacy) or there's no scale projector.
    let rescaled = null;
    if (lastProjector?.type === "scale" && zoomArg?.yScale
        && typeof zoomArg.yScale.bandwidth !== "function") {
      rescaled = zoomArg.yScale;
    } else {
      const baseScale = getBaseScale(lastProps, lastProjector);
      if (!baseScale) return;
      const m = lastProps.margin  ?? { top: 0, bottom: 0 };
      const p = lastProps.padding ?? { top: 0, bottom: 0 };
      const barHeight = (lastPayload.height - m.top - m.bottom) - p.top - p.bottom;
      const boxed = typeof baseScale.bandwidth === "function"
        ? baseScale
        : baseScale.copy().range([barHeight, 0]);
      rescaled = transform.rescaleY(boxed);
    }
    const mainFn   = (isLeft ? d3.axisLeft(rescaled) : d3.axisRight(rescaled))
      .tickSize(lastProps?.tickSize ?? 6)
      .tickFormat(lastProps?.tickFormat ?? ((d) => d));
    if (lastProps?.tickValues) mainFn.tickValues(lastProps.tickValues);
    else if (lastProps?.numTicks) mainFn.ticks(lastProps.numTicks);

    axisG.call(mainFn);
    axisG.select(".domain").attr("display", "none");
    axisG.selectAll(".tick line").attr("stroke", lastProps?.tickColor ?? "currentColor");
    applyTextTickStyle(axisG, isLeft, lastProps);

    if (lastProps?.showGrid) {
      const gridSpan = lastPayload.width - lastProps.margin.left - lastProps.margin.right;
      const gridFn   = (isLeft ? d3.axisRight(rescaled) : d3.axisLeft(rescaled))
        .tickSize(gridSpan).tickFormat("");
      if (lastProps?.tickValues) gridFn.tickValues(lastProps.tickValues);
      else if (lastProps?.numTicks) gridFn.ticks(lastProps.numTicks);
      gridG.call(gridFn);
      gridG.select(".domain").attr("display", "none");
      gridG.selectAll(".tick line")
        .attr("stroke", lastProps?.gridColor ?? "#e5e7eb")
        .attr("stroke-dasharray", lastProps?.gridDasharray ?? null)
        .attr("stroke-opacity", lastProps?.gridOpacity ?? 1);
    }
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
      axisLayer     = null;
      gridG         = null;
      axisG         = null;
      lastProps     = null;
      lastProjector = null;
      lastOrder     = undefined;
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
