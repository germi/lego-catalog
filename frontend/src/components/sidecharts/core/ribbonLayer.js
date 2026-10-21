import * as d3 from "d3";
import { buildCategoryOrders, findPredKey } from "../utils/animation/predecessor";
import { computeEnterPhasing, survivingValuesChanged } from "../utils/animation/phaseTiming";
import { resolveFill } from "../fill/resolveFill";
import { buildScale } from "../utils/scale/buildScale.js";
import { createLayer } from "./layer.js";
import { safeId } from "../utils/safeId.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";

export const RIBBON_LAYER_DEFAULTS = {
  data:              [],
  color:             {},
  rectStyle:         {},
  margin:            { top: 0, right: 0, bottom: 20, left: 0 },
  padding:           { top: 0, right: 0, bottom: 0, left: 0 },
  max:               null,
  duration:          GLOBAL_DEFAULTS.duration,
  ease:              GLOBAL_DEFAULTS.ease,
  paddingInner:      0.1,
  paddingOuter:      0.1,
  bgColor:           null,
  format:            (d) => d,
  stacked:           true,
  scaleType:         "linear",
  keys:              null,
  showLinks:         true,
  useCurves:         true,
  useLines:          false,
  linkOpacity:       0.5,
  // Link dim opacity when highlighting is active and a link is not highlighted
  // (a link is highlighted only when BOTH its source and target are). Smaller
  // than linkOpacity.
  linkDimOpacity:    0.05,
  // Highlight / dim — mirrors ScatterLayer. When `highlighted` is non-empty,
  // matching segments stay vivid and the rest dim. A segment matches an id by
  // its SERIES (key / values[key].id) OR its CATEGORY (data.id), or per-datum
  // `values[key].highlighted`. Per-segment overrides (values[key].highlightFill,
  // .dimFill, …) take precedence over these layer-level props. Links are not
  // affected.
  highlighted:            null,
  highlightFill:          null,
  highlightFillOpacity:   1,
  highlightStrokeColor:   null,
  highlightStrokeWidth:   null,
  highlightStrokeOpacity: null,
  dimFill:                null,
  dimOpacity:             0.15,
  dimStrokeColor:         null,
  dimStrokeWidth:         null,
  dimStrokeOpacity:       null,
  projector:         null,
  fixedBarWidth:     8,
  fixedMaxBarHeight: 50,
  getCoordinates:    (d) => [d.longitud, d.latitud],
  ignoreProjection:  false,
};

// Highlight / dim resolvers for the bars (rects) — mirrors ScatterLayer's
// buildResolvers, adapted to the ribbon's (category × series) rects. Each rect's
// datum `d` is a stacked segment (d.data.id = category); the series `key` comes
// from the parent <g>'s bound data, so these are regular functions reading
// `this.parentNode.__data__.key`. The per-segment object is d.data.values[key];
// its fields override the layer-level props. A segment is highlighted when an id
// in `highlighted` matches its SERIES (key / values[key].id) OR its CATEGORY
// (data.id), or it sets values[key].highlighted. Links are not touched.
function buildRectResolvers(props, fillFor, data) {
  const hlArr = Array.isArray(props.highlighted)
    ? props.highlighted
    : (props.highlighted != null ? [props.highlighted] : []);
  const hlSet = new Set(hlArr.map(String));
  const isHighlighting = hlSet.size > 0;

  const segOf = (d, key) => d?.data?.values?.[key];
  const isHL = (d, key) => {
    const seg = segOf(d, key);
    return hlSet.has(String(d?.data?.id))
        || hlSet.has(String(seg?.id ?? key))
        || !!seg?.highlighted;
  };

  // Link highlight: a link (series `key`, category sourceId → targetId) is
  // highlighted only when BOTH its end segments are. catById gives O(1) lookup
  // of a category to test its (catId, key) segment the same way isHL does.
  const catById = new Map((data ?? []).map((c) => [String(c.id), c]));
  const endHL = (catId, key) => {
    const seg = catById.get(String(catId))?.values?.[key];
    return hlSet.has(String(catId))
        || hlSet.has(String(seg?.id ?? key))
        || !!seg?.highlighted;
  };
  function linkOpacity(d) {
    const base = props.linkOpacity ?? 0.5;
    if (!isHighlighting) return base;
    return (endHL(d.sourceId, d.key) && endHL(d.targetId, d.key))
      ? base
      : (props.linkDimOpacity ?? 0.05);
  }

  function fill(d) {
    const key = this.parentNode.__data__.key;
    const seg = segOf(d, key);
    if (isHighlighting) {
      const c = isHL(d, key)
        ? (seg?.highlightFill ?? props.highlightFill)
        : (seg?.dimFill ?? props.dimFill);
      if (c != null) return fillFor(c);
    }
    return fillFor((seg?.color) || props.color[key]);
  }
  function fillOpacity(d) {
    const key = this.parentNode.__data__.key;
    const seg = segOf(d, key);
    if (isHighlighting) {
      return isHL(d, key)
        ? (seg?.highlightFillOpacity ?? props.highlightFillOpacity ?? 1)
        : (seg?.dimOpacity ?? props.dimOpacity ?? 0.15);
    }
    return seg?.fillOpacity ?? 1;
  }
  function stroke(d) {
    const key = this.parentNode.__data__.key;
    const seg = segOf(d, key);
    if (isHighlighting) {
      const c = isHL(d, key)
        ? (seg?.highlightStrokeColor ?? props.highlightStrokeColor)
        : (seg?.dimStrokeColor ?? props.dimStrokeColor);
      if (c != null) return fillFor(c);
    }
    return seg?.strokeColor != null ? fillFor(seg.strokeColor) : null;
  }
  function strokeWidth(d) {
    const key = this.parentNode.__data__.key;
    const seg = segOf(d, key);
    if (isHighlighting) {
      const w = isHL(d, key)
        ? (seg?.highlightStrokeWidth ?? props.highlightStrokeWidth)
        : (seg?.dimStrokeWidth ?? props.dimStrokeWidth);
      if (w != null) return w;
    }
    return seg?.strokeWidth ?? 0;
  }
  function strokeOpacity(d) {
    const key = this.parentNode.__data__.key;
    const seg = segOf(d, key);
    if (isHighlighting) {
      const o = isHL(d, key)
        ? (seg?.highlightStrokeOpacity ?? props.highlightStrokeOpacity)
        : (seg?.dimStrokeOpacity ?? props.dimStrokeOpacity);
      if (o != null) return o;
    }
    return seg?.strokeOpacity ?? 1;
  }
  return { fill, fillOpacity, stroke, strokeWidth, strokeOpacity, linkOpacity, isHighlighting };
}

/**
 * @param callbacks  { onSelect(eventData), onHover(eventData) }
 */
export function createRibbonLayer(callbacks = {}) {
  const base = createLayer({ className: "ribbon-layer" });

  let lastRenderData      = null;
  let lastPayload         = null;
  let lastProps           = null;
  let lastHadEnters       = false;

  let contentG     = null;
  let rectsColorBg = null;
  let rects        = null;
  let linksG       = null;
  let rectsBg      = null;

  function getComputedKeys(data, props) {
    return data.length ? props.keys || Object.keys(data[0].values) : [];
  }

  function processData(data) {
    return data.map((e) => {
      const result = { ...e };
      Object.keys(e.values).forEach((key) => { result[key] = e.values[key].value; });
      return result;
    });
  }

  function createOrderedStack(rawData, props) {
    const computedKeys = getComputedKeys(rawData, props);
    const perCategory = rawData.map((year) => {
      const sortedKeys = Object.values(year.values)
        .sort((a, b) => a.order - b.order)
        .map((e) => e.id);
      return d3.stack().keys(sortedKeys)([year]);
    });
    return computedKeys.map((key) => {
      const seriesArr = perCategory.map((cat) => {
        const found = cat.find((s) => s.key === key);
        found[0].key = key;
        return found[0];
      });
      seriesArr.key = key;
      return seriesArr;
    });
  }

  function initGroups(payload, layerContainer) {
    const outerG = base.ensureGroup(payload, layerContainer);
    if (contentG) return;
    contentG     = outerG.append("g");
    rectsColorBg = contentG.append("g").attr("class", "bars-color-bg");
    rects        = contentG.append("g").attr("class", "bars");
    linksG       = contentG.append("g").attr("class", "links");
    rectsBg      = contentG.append("g").attr("class", "bars-bg");
  }

  function render(payload, props) {
    if (!payload?.svgEl || !contentG) return;
    lastProps = props;
    // X-zoom is baked into payload.xScaleUncentered by BaseCanvas (Part C2); the
    // outer group must not also carry the canvas zoom transform.
    base.group?.attr("transform", null);

    const controls = props.controls ?? null;
    const proj    = props.ignoreProjection ? null : (props.projector ?? controls?.projection ?? null);
    const isFixed = !!proj;

    const prevData = lastRenderData ?? [];
    const m        = props.margin;
    const p        = props.padding;
    const rawDuration = payload.duration ?? props.duration;
    const duration    = (rawDuration === 0 && lastHadEnters) ? props.duration : rawDuration;
    const svgEl    = payload.svgEl;
    const fillFor  = (color) => resolveFill(color, svgEl) ?? color;

    contentG.attr("transform", `translate(${m.left + p.left}, ${m.top + p.top})`);

    const data = props.data;

    let series     = createOrderedStack(processData(data), props);
    let seriesPrev = createOrderedStack(processData(prevData.length ? prevData : data), props);

    if (!props.stacked) {
      const unstack = (arr) =>
        arr.forEach((d) => d.forEach((e) => { e[1] = e[1] - e[0]; e[0] = 0; }));
      unstack(series);
      unstack(seriesPrev);
    }

    const computedMax     = props.max ?? d3.max(series,     (d) => d3.max(d, (e) => e[1]));
    const computedMaxPrev = props.max ?? d3.max(seriesPrev, (d) => d3.max(d, (e) => e[1]));

    let x, xPrev, y, yPrev, innerWidth, innerHeight, bottom;
    let hScale, anchor, hW;

    if (!isFixed) {
      innerWidth  = payload.width  - m.left - m.right  - p.left - p.right;
      innerHeight = payload.height - m.top  - m.bottom - p.top  - p.bottom;
      bottom      = innerHeight;

      // CURRENT x comes from the canvas projector (Part C2): payload.xScaleUncentered
      // is the band's LEFT-EDGE scale with X-zoom already baked in by BaseCanvas
      // (`_zoomBand` stretches the band RANGE — algebraically identical to the old
      // internal `applyX(0..innerWidth)` path, since the projector's raw band
      // range is [0, innerWidth] with the same domain + paddings). The ribbon no
      // longer applies zoom itself.
      if (payload.xScaleUncentered) {
        x = payload.xScaleUncentered;
      } else {
        // No-projector host (e.g. React RibbonChart, or RibbonLayer used
        // standalone): build the band locally and apply the canvas zoom
        // transform to its range, exactly as before Part C. Once every host
        // exposes a projector (Part A for React) this branch can go.
        const t = payload.zoomTransform;
        const xRange = t && (t.k !== 1 || t.x !== 0)
          ? [t.applyX(0), t.applyX(innerWidth)]
          : [0, innerWidth];
        x = d3
          .scaleBand()
          .domain(data.map((e) => e.id))
          .range(xRange)
          .paddingInner(props.paddingInner)
          .paddingOuter(props.paddingOuter);
      }

      // y stays INTERNAL on purpose. computedMax is taken over the SELECTED
      // `props.keys`, whereas the projector's y-domain is computed over ALL keys
      // — so payload.yScale would shift bar heights whenever `keys` is a subset.
      // y is never zoomed here (zoomAxes:"x"), so there's nothing to gain from
      // the payload for it.
      y = buildScale({
        type:   props.scaleType,
        domain: [0, computedMax],
        range:  [innerHeight, 0],
        nice:   true,
      });

      // PREV scales stay bespoke — the ribbon's synchronous data-snapshot prev
      // (xPrev / yPrev) drives the entering/leaving-category choreography and is
      // intentionally NOT the canvas's deferred prev (see
      // ribbon-chart-projector-partC-plan.md, "Finding 2"). C2 only takes the
      // CURRENT x from the payload.
      yPrev = buildScale({
        type:   props.scaleType,
        domain: [0, computedMaxPrev],
        range:  [innerHeight, 0],
        nice:   true,
      });

      xPrev = prevData.length
        ? d3
            .scaleBand()
            .domain(prevData.map((e) => e.id))
            .range([0, innerWidth])
            .paddingInner(props.paddingInner)
            .paddingOuter(props.paddingOuter)
        : x;
    } else {
      hW     = props.fixedBarWidth;
      hScale = d3.scaleLinear().domain([0, computedMax]).range([0, props.fixedMaxBarHeight]);
      anchor = (rawDatum) => proj(props.getCoordinates(rawDatum)) ?? [0, 0];
    }

    const hScalePrev = isFixed
      ? d3.scaleLinear().domain([0, computedMaxPrev]).range([0, props.fixedMaxBarHeight])
      : null;

    const resolveX     = isFixed
      ? (d) => anchor(d.data)[0] - hW / 2
      : (d) => x(d.data.id);

    const resolveXPrev = isFixed
      ? (d) => anchor(d.data)[0] - hW / 2
      : (d) => xPrev(d.data.id) ?? x(d.data.id);

    const resolveW     = isFixed ? () => hW : () => x.bandwidth();
    const resolveWPrev = isFixed ? () => hW : () => xPrev.bandwidth();

    const resolveY     = isFixed
      ? (d) => anchor(d.data)[1] - hScale(d[1])
      : (d) => y(d[1]);

    function resolveH(d) {
      if (isFixed) return hScale(d[1]) - hScale(d[0]);
      const key = this.parentNode.__data__.key;
      return d.data.values[key].style === "line" && !props.stacked
        ? 2
        : y(d[0]) - y(d[1]);
    }

    const currentCategoryOrders = buildCategoryOrders(data);
    const prevCategoryOrders    = prevData.length ? buildCategoryOrders(prevData) : new Map();

    const prevIds = new Set(prevData.map((d) => String(d.id)));
    const currIds = new Set(data.map((d) => String(d.id)));
    const hasExits  = prevData.length > 0 && [...prevIds].some((id) => !currIds.has(id));
    const hasEnters = prevData.length > 0 && [...currIds].some((id) => !prevIds.has(id));
    const structuralChange = hasExits || hasEnters;

    const survivingRawIds = data.map(d => d.id).filter(id => prevIds.has(String(id)));
    // needsSlide = do SURVIVING categories reposition (so entering ones must wait
    // for that phase-2 slide)? With zero survivors there is nothing to slide —
    // even though the bandwidth changes when the category COUNT changes — so the
    // entering elements shouldn't wait for a phase 2 that doesn't happen. Guard
    // the whole test on having at least one survivor.
    const needsSlide = !isFixed && survivingRawIds.length > 0 && (
      Math.abs((x?.bandwidth?.() ?? 0) - (xPrev?.bandwidth?.() ?? 0)) > 0.5 ||
      survivingRawIds.some(id => {
        const pv = xPrev?.(id);
        const cv = x?.(id);
        return pv != null && cv != null && Math.abs(pv - cv) > 0.5;
      })
    );

    // Special case: a pure-enter change where every survivor keeps the same bar
    // height has nothing to animate in the value phase — skip it (back to 2
    // windows). "Same height" means same raw value AND same scale, so a max
    // shift (auto-scale) still counts as a change and keeps phase 1.
    const valuesChanged =
      computedMax !== computedMaxPrev || survivingValuesChanged(prevData, data);

    const { phase1Dur, enterDelay } = computeEnterPhasing({
      duration,
      hasExits,
      hasEnters,
      waitForPhase2: needsSlide,
      // Even with no exits, give survivors a phase-1 window so they update
      // vertically at their OLD x before sliding (same choreography as the exit
      // case). The bar/link branches below no longer special-case hasExits.
      phase1OnSlide: true,
      valuesChanged,
    });
    const phase2Dur = duration;

    function findEnterPredKey(key, catId) {
      return findPredKey({
        myKey:         key,
        catKey:        String(catId),
        direction:     "enter",
        prevOrders:    prevCategoryOrders,
        currentOrders: currentCategoryOrders,
      });
    }
    function findLeavePredKey(key, catId) {
      return findPredKey({
        myKey:         key,
        catKey:        String(catId),
        direction:     "leave",
        prevOrders:    prevCategoryOrders,
        currentOrders: currentCategoryOrders,
      });
    }

    const resolveEnterY = (d) => {
      const catId   = d.data.id;
      const predKey = findEnterPredKey(d.key, catId);
      const ps      = predKey ? seriesPrev.find((e) => e.key === predKey) : null;
      const psBar   = ps?.find((bar) => String(bar.data.id) === String(catId));
      if (isFixed) {
        return anchor(d.data)[1] - hScalePrev(psBar?.[1] ?? 0);
      }
      const result = yPrev(psBar?.[1] ?? 0);
      return isNaN(result) ? bottom : result;
    };

    const resolveLeaveY = (d) => {
      const catId   = d.data.id;
      if (!isFixed) {
        const prevCat = prevData.find((pv) => String(pv.id) === String(catId));
        if (!prevCat?.values[d.key]) return y(0);
      }
      const predKey = findLeavePredKey(d.key, catId);
      const cs      = predKey ? series.find((e) => e.key === predKey) : null;
      const csBar   = cs?.find((bar) => String(bar.data.id) === String(catId));
      if (isFixed) {
        return anchor(d.data)[1] - hScale(csBar?.[1] ?? 0);
      }
      const result = y(csBar?.[1] ?? 0);
      return isNaN(result) ? bottom : result;
    };

    if (!isFixed && props.bgColor) {
      rectsColorBg
        .selectAll("rect")
        .data(data, (d) => d.id)
        .join("rect")
        .attr("id",     (d) => safeId(`bg-${d.id}`))
        .attr("fill",   fillFor(props.bgColor))
        .attr("x",      (d) => x(d.id))
        .attr("y",      () => y(y.domain()[1]))
        .attr("height", bottom)
        .attr("width",  x.bandwidth());
    } else if (isFixed) {
      rectsColorBg.selectAll("*").remove();
    }

    if (!isFixed) {
      const bgRectBounds = (d) => {
        const idx    = data.findIndex((item) => item.id === d.id);
        const center = (id) => x(id) + x.bandwidth() / 2;
        const left   = idx === 0               ? 0          : (center(data[idx - 1].id) + center(d.id)) / 2;
        const right  = idx === data.length - 1 ? innerWidth : (center(d.id) + center(data[idx + 1].id)) / 2;
        return { x: left, width: right - left };
      };

      rectsBg
        .selectAll("rect")
        .data(data, (d) => d.id)
        .join("rect")
        .attr("id",     (d) => safeId(`bg-${d.id}`))
        .attr("fill",   "transparent")
        .attr("x",      (d) => bgRectBounds(d).x)
        .attr("y",      () => y(computedMax))
        .attr("height", bottom)
        .attr("width",  (d) => bgRectBounds(d).width)
        .on("click", (event, itemData) => {
          const topKey = Object.values(itemData.values).reduce((a, b) => a.order > b.order ? a : b).id;
          const id     = safeId(`${topKey}-${itemData.id}`);
          const target = rects.node().querySelector(`#${id}`) ?? event.target;
          callbacks.onSelect?.({ target, event, data: itemData });
        })
        .on("mouseover", (event, itemData) => {
          const topKey = Object.values(itemData.values).reduce((a, b) => a.order > b.order ? a : b).id;
          const id     = safeId(`${topKey}-${itemData.id}`);
          const target = rects.node().querySelector(`#${id}`) ?? event.target;
          callbacks.onHover?.({ target, event, data: itemData });
        })
        .on("mouseout", () => callbacks.onHover?.(null));
    } else {
      rectsBg
        .selectAll("rect")
        .data(data, (d) => d.id)
        .join("rect")
        .attr("fill",   "transparent")
        .attr("x",      (d) => anchor(d)[0] - hW / 2)
        .attr("y",      (d) => anchor(d)[1] - props.fixedMaxBarHeight)
        .attr("height", props.fixedMaxBarHeight)
        .attr("width",  hW)
        .on("click",     (event, itemData) => callbacks.onSelect?.({ target: event.target, event, data: itemData }))
        .on("mouseover", (event, itemData) => callbacks.onHover?.({ target: event.target, event, data: itemData }))
        .on("mouseout",  () => callbacks.onHover?.(null));
    }

    const groups = rects.selectAll("g").data(series, (d) => d.key);

    const groupsMerged = groups
      .enter()
      .append("g")
      .attr("class", (d) => safeId(d.key))
      .attr("id",    (d) => safeId(d.key))
      .merge(groups);

    const bars = groupsMerged.selectAll("rect").data(
      (d) => d,
      (d) => d.data.id,
    );

    if (structuralChange) {
      bars
        .exit()
        .transition()
        .duration(phase1Dur)
        .ease(d3[props.ease])
        .attr("x",      resolveXPrev)
        .attr("width",  resolveWPrev)
        .attr("y",      isFixed ? resolveEnterY : () => bottom)
        .attr("height", 0)
        .remove();
    } else {
      bars.exit().remove();
    }

    // Highlight/dim-aware bar resolvers (mirrors ScatterLayer). `styleBars`
    // applies ALL the visual attributes together — fill + fill-opacity + stroke
    // — so the dim/highlight rides the SAME transition as position and animates
    // on every data change, zoom and toggle (like ScatterLayer; no separate
    // styling pass that could fight the category choreography). A non-highlighting
    // render resolves to fill-opacity 1 / no stroke, so it's a visual no-op.
    // Links are intentionally left untouched.
    const R         = buildRectResolvers(props, fillFor, data);
    const barFill   = R.fill;
    const styleBars = (sel) => sel
      .attr("fill",           barFill)
      .attr("fill-opacity",   R.fillOpacity)
      .attr("stroke",         R.stroke)
      .attr("stroke-width",   R.strokeWidth)
      .attr("stroke-opacity", R.strokeOpacity);

    const barsEnter = bars
      .enter()
      .append("rect")
      .attr("id", function (d) {
        return safeId(`${this.parentNode.__data__.key}-${d.data.id}`);
      })
      .attr("x",      resolveX)
      .attr("y",      resolveEnterY)
      .attr("height", 0)
      .attr("width",  resolveW)
      .call(styleBars);

    if (structuralChange) {
      // Vertical-then-horizontal for surviving bars, whether or not anything
      // exits. Phase 1 (phase1Dur): settle heights at the OLD x. Phase 2
      // (phase2Dur): slide to the new x. With no exits, phase1Dur is still
      // non-zero (phase1OnSlide above), so the heights animate in place before
      // the slide instead of sliding first. Entering bars wait until after the
      // slide (enterDelay).
      bars
        .transition()
        .duration(phase1Dur)
        .ease(d3[props.ease])
        .attr("x",      resolveXPrev)
        .attr("width",  resolveWPrev)
        .attr("y",      resolveY)
        .attr("height", resolveH)
        .call(styleBars)
        .transition()
        .duration(phase2Dur)
        .ease(d3[props.ease])
        .attr("x",     resolveX)
        .attr("width", resolveW);

      barsEnter
        .filter((d) => prevIds.has(String(d.data.id)))
        .attr("x",     resolveXPrev)
        .attr("width", resolveWPrev)
        .transition()
        .duration(phase1Dur)
        .ease(d3[props.ease])
        .attr("y",      resolveY)
        .attr("height", resolveH)
        .call(styleBars)
        .transition()
        .duration(phase2Dur)
        .ease(d3[props.ease])
        .attr("x",     resolveX)
        .attr("width", resolveW);

      barsEnter
        .filter((d) => !prevIds.has(String(d.data.id)))
        .transition()
        .delay(enterDelay)
        .duration(phase2Dur)
        .ease(d3[props.ease])
        .attr("y",      resolveY)
        .attr("height", resolveH)
        .call(styleBars);
    } else {
      barsEnter
        .merge(bars)
        .transition()
        .duration(duration)
        .ease(d3[props.ease])
        .attr("y",      resolveY)
        .attr("height", resolveH)
        .call(styleBars)
        .attr("x",      resolveX)
        .attr("width",  resolveW);
    }

    // An exiting SERIES (whole key leaving) collapses in place at its OLD x
    // during phase 1 — value-first, like every other exit now. (It used to
    // slide-then-collapse in the no-exits case, which left it sliding along in
    // phase 1 and only collapsing after D — inconsistent with the bars.)
    const groupsExit = groups.exit();
    groupsExit
      .selectAll("rect")
      .transition()
      .duration(duration)
      .ease(d3[props.ease])
      .attr("y",      resolveLeaveY)
      .attr("height", 0)
      .remove();
    groupsExit.transition().delay(duration).remove();

    if (!isFixed && props.showLinks) {
      drawLinks();
    } else {
      linksG.selectAll("*").remove();
    }

    lastHadEnters  = !barsEnter.empty();
    lastRenderData = props.data;

    function drawLinks() {
      const linkMixBlendMode = "multiply";

      function buildLinks(d, yScale = y, xScale = x) {
        return d
          .map((curr, i, arr) => {
            const next = arr[i + 1];
            if (!next) return null;
            const sxBase = xScale(curr.data.id);
            const tx     = xScale(next.data.id);
            if (sxBase == null || tx == null) return null;
            const sx = sxBase + xScale.bandwidth();
            return {
              key:          d.key,
              id:           safeId(`${d.key}-${curr.data.id}__${next.data.id}`),
              sourceId:     curr.data.id,
              targetId:     next.data.id,
              source:       { x: sx, y: yScale(curr[1]) ?? yScale(0) },
              target:       { x: tx, y: yScale(next[1]) ?? yScale(0) },
              verticalEnd:  { x: tx, y: yScale(next[0]) },
              returnTarget: { x: sx, y: yScale(curr[0]) },
            };
          })
          .filter(Boolean);
      }

      function linkPath({ source, target, verticalEnd, returnTarget }) {
        const g = d3.path();
        g.moveTo(source.x, source.y);
        if (props.useCurves) {
          const mx = (source.x + target.x) / 2;
          g.bezierCurveTo(mx, source.y, mx, target.y, target.x, target.y);
        } else {
          g.bezierCurveTo(source.x, source.y, target.x, target.y, target.x, target.y);
        }
        let vex = verticalEnd.x,  vey = verticalEnd.y;
        let rtx = returnTarget.x, rty = returnTarget.y;
        if (props.useLines) { vex = target.x; vey = target.y; rtx = source.x; rty = source.y; }
        g.lineTo(vex, vey);
        if (props.useCurves) {
          const mx = (vex + rtx) / 2;
          g.bezierCurveTo(mx, vey, mx, rty, rtx, rty);
        } else {
          g.bezierCurveTo(vex, vey, rtx, rty, rtx, rty);
        }
        g.closePath();
        return g.toString();
      }

      function linkPathPhase1(d) {
        const sx = xPrev(d.sourceId);
        const tx = xPrev(d.targetId);
        if (sx == null || tx == null) return linkPath(d);
        const sxR = sx + xPrev.bandwidth();
        return linkPath({
          source:       { x: sxR, y: d.source.y },
          target:       { x: tx,  y: d.target.y },
          verticalEnd:  { x: tx,  y: d.verticalEnd.y },
          returnTarget: { x: sxR, y: d.returnTarget.y },
        });
      }

      function makeLinkPathEnter(xOverride) {
        return function ({ key, sourceId, targetId, source, target, verticalEnd, returnTarget }) {
          const pks    = findEnterPredKey(key, sourceId);
          const pss    = pks ? seriesPrev.find((e) => e.key === pks) : null;
          const psBarS = pss?.find((b) => String(b.data.id) === String(sourceId));
          let startTop = psBarS ? yPrev(psBarS[1]) : y(0);
          if (isNaN(startTop)) startTop = bottom;

          const pke    = findEnterPredKey(key, targetId);
          const pse    = pke ? seriesPrev.find((e) => e.key === pke) : null;
          const psBarE = pse?.find((b) => String(b.data.id) === String(targetId));
          let endTop   = psBarE ? yPrev(psBarE[1]) : y(0);
          if (isNaN(endTop)) endTop = bottom;

          const sxR = xOverride ? (xOverride(sourceId) ?? 0) + xOverride.bandwidth() : source.x;
          const tx  = xOverride ?  xOverride(targetId) ?? 0                           : target.x;

          return linkPath({
            source:       { x: sxR, y: startTop },
            target:       { x: tx,  y: endTop   },
            verticalEnd:  { x: tx,  y: endTop   },
            returnTarget: { x: sxR, y: startTop },
          });
        };
      }

      const linkPathEnter     = makeLinkPathEnter(null);
      const linkPathEnterPrev = makeLinkPathEnter(xPrev);

      function linkPathSurvivingEnter({ key, sourceId, targetId }) {
        const sxR    = (xPrev(sourceId) ?? 0) + xPrev.bandwidth();
        const tx     =  xPrev(targetId) ?? 0;
        const sSeries = seriesPrev.find((s) => s.key === key);
        const sBarS   = sSeries?.find((b) => String(b.data.id) === String(sourceId));
        const sBarE   = sSeries?.find((b) => String(b.data.id) === String(targetId));
        let startY = sBarS ? yPrev(sBarS[1]) : yPrev(0);
        let endY   = sBarE ? yPrev(sBarE[1]) : yPrev(0);
        if (isNaN(startY)) startY = bottom;
        if (isNaN(endY))   endY   = bottom;
        return linkPath({
          source:       { x: sxR, y: startY },
          target:       { x: tx,  y: endY   },
          verticalEnd:  { x: tx,  y: endY   },
          returnTarget: { x: sxR, y: startY },
        });
      }

      function linkPathLeave({ key, sourceId, targetId, source, target, verticalEnd, returnTarget }) {
        const pks    = findLeavePredKey(key, sourceId);
        const css    = pks ? series.find((e) => e.key === pks) : null;
        const csBarS = css?.find((b) => String(b.data.id) === String(sourceId));
        let startTop = csBarS ? y(csBarS[1]) : y(0);
        if (isNaN(startTop)) startTop = bottom;

        const pke    = findLeavePredKey(key, targetId);
        const cse    = pke ? series.find((e) => e.key === pke) : null;
        const csBarE = cse?.find((b) => String(b.data.id) === String(targetId));
        let endTop   = csBarE ? y(csBarE[1]) : y(0);
        if (isNaN(endTop)) endTop = bottom;

        return linkPath({
          source:       { x: source.x,       y: startTop },
          target:       { x: target.x,       y: endTop   },
          verticalEnd:  { x: verticalEnd.x,  y: endTop   },
          returnTarget: { x: returnTarget.x, y: startTop },
        });
      }

      function linkPathPhase1Enter({ key, sourceId, targetId }) {
        const sxBase = x(sourceId);
        const tx     = x(targetId);
        if (sxBase == null || tx == null) return null;
        const sxR    = sxBase + x.bandwidth();
        const cs     = seriesPrev.find((s) => s.key === key);
        const srcBar = cs?.find((b) => String(b.data.id) === String(sourceId));
        const tgtBar = cs?.find((b) => String(b.data.id) === String(targetId));
        return linkPath({
          source:       { x: sxR, y: srcBar ? yPrev(srcBar[1]) : yPrev(0) },
          target:       { x: tx,  y: tgtBar ? yPrev(tgtBar[1]) : yPrev(0) },
          verticalEnd:  { x: tx,  y: tgtBar ? yPrev(tgtBar[0]) : yPrev(0) },
          returnTarget: { x: sxR, y: srcBar ? yPrev(srcBar[0]) : yPrev(0) },
        });
      }

      function linkPathSlide({ key, sourceId, targetId }) {
        const sxBase = x(sourceId);
        const tx     = x(targetId);
        if (sxBase == null || tx == null) return null;
        const sxR    = sxBase + x.bandwidth();
        const cs     = series.find((s) => s.key === key);
        const srcBar = cs?.find((b) => String(b.data.id) === String(sourceId));
        const tgtBar = cs?.find((b) => String(b.data.id) === String(targetId));
        return linkPath({
          source:       { x: sxR, y: srcBar ? y(srcBar[1]) : y(0) },
          target:       { x: tx,  y: tgtBar ? y(tgtBar[1]) : y(0) },
          verticalEnd:  { x: tx,  y: tgtBar ? y(tgtBar[0]) : y(0) },
          returnTarget: { x: sxR, y: srcBar ? y(srcBar[0]) : y(0) },
        });
      }

      function linkPathExitCat({ key, sourceId, targetId }) {
        const sxR    = (xPrev(sourceId) ?? 0) + xPrev.bandwidth();
        const tx     =  xPrev(targetId) ?? 0;
        const srcOld = currIds.has(String(sourceId));
        const tgtOld = currIds.has(String(targetId));
        let srcTop, srcBot, tgtTop, tgtBot;

        if (srcOld) {
          const cs  = series.find((s) => s.key === key);
          const bar = cs?.find((b) => String(b.data.id) === String(sourceId));
          srcTop = y(bar?.[1] ?? 0); srcBot = y(bar?.[0] ?? 0);
        } else { srcTop = y(0); srcBot = y(0); }

        if (tgtOld) {
          const cs  = series.find((s) => s.key === key);
          const bar = cs?.find((b) => String(b.data.id) === String(targetId));
          tgtTop = y(bar?.[1] ?? 0); tgtBot = y(bar?.[0] ?? 0);
        } else { tgtTop = y(0); tgtBot = y(0); }

        return linkPath({
          source:       { x: sxR, y: srcTop },
          target:       { x: tx,  y: tgtTop },
          verticalEnd:  { x: tx,  y: tgtBot },
          returnTarget: { x: sxR, y: srcBot },
        });
      }

      const linkGroups = linksG.selectAll("g").data(series, (d) => d.key);

      const linkGroupsMerged = linkGroups
        .enter()
        .append("g")
        .attr("class", (d) => safeId(d.key))
        .attr("id",    (d) => safeId(`links-${d.key}`))
        .merge(linkGroups);

      const paths = linkGroupsMerged.selectAll("path").data(
        (d) => buildLinks(d),
        (d) => d.id,
      );

      const pathsEnter = paths
        .enter()
        .append("path")
        .attr("class",           "link")
        .attr("id",              (d) => safeId(`link-${d.id}`))
        .style("mix-blend-mode", linkMixBlendMode)
        .attr("d",               linkPathEnter)
        .attr("fill",            (d) => fillFor(props.color[d.key]))
        .attr("stroke",          (d) => fillFor(props.color[d.key]))
        .attr("opacity",         R.linkOpacity)
        .attr("stroke-width",    0);

      {
        const seriesKeysWithLinks = new Set(
          series.filter(s => buildLinks(s).length > 0).map(s => s.key),
        );
        const exitSel      = paths.exit();
        const exitFade     = exitSel.filter(d =>  seriesKeysWithLinks.has(d.key));
        const exitNoFade   = exitSel.filter(d => !seriesKeysWithLinks.has(d.key));
        if (!structuralChange) {
          exitFade.transition().duration(duration).ease(d3[props.ease])
            .attr("opacity", 0).remove();
          exitNoFade.remove();
        } else if (phase1Dur > 0) {
          exitFade.transition().duration(phase1Dur).ease(d3[props.ease])
            .attr("d", linkPathExitCat).attr("opacity", 0).remove();
          exitNoFade.transition().duration(phase1Dur).ease(d3[props.ease])
            .attr("d", linkPathExitCat).remove();
        } else {
          exitFade.transition().duration(phase2Dur).ease(d3[props.ease])
            .attr("d", linkPathPhase1Enter).attr("opacity", 0).remove();
          exitNoFade.transition().duration(phase2Dur).ease(d3[props.ease])
            .attr("d", linkPathPhase1Enter).remove();
        }
      }

      const isSeriesEnteringLink  = (d) => prevIds.has(String(d.sourceId)) && prevIds.has(String(d.targetId));
      const seriesPrevKeys        = new Set(seriesPrev.map((s) => s.key));
      const isSurvivingSeriesLink = (d) =>  isSeriesEnteringLink(d) &&  seriesPrevKeys.has(d.key);
      const isEnteringSeriesLink  = (d) =>  isSeriesEnteringLink(d) && !seriesPrevKeys.has(d.key);

      const prevAdjSet = new Set(
        prevData.slice(0, -1).map((e, i) => `${e.id}__${prevData[i + 1].id}`),
      );
      const wasAdjacent = (d) =>
        prevAdjSet.has(`${d.sourceId}__${d.targetId}`) ||
        prevAdjSet.has(`${d.targetId}__${d.sourceId}`);

      if (structuralChange) {
        // Links mirror the bars: phase-1 settle at the OLD x with new heights,
        // then phase-2 slide — applied to every structural change, exits or not
        // (the no-exits case used to slide first; now it settles first).
        {
          paths
            .transition()
            .duration(phase1Dur)
            .ease(d3[props.ease])
            .attr("d", linkPathPhase1)
            .transition()
            .duration(phase2Dur)
            .ease(d3[props.ease])
            .attr("d",            linkPath)
            .attr("opacity",      R.linkOpacity)
            .attr("stroke-width", props.useLines ? 2 : 0);

          pathsEnter
            .filter((d) => isSurvivingSeriesLink(d) && wasAdjacent(d))
            .attr("d",       linkPathSurvivingEnter)
            .attr("opacity", 0)
            .transition()
            .duration(phase1Dur)
            .ease(d3[props.ease])
            .attr("d",       linkPathPhase1)
            .attr("opacity", R.linkOpacity)
            .transition()
            .duration(phase2Dur)
            .ease(d3[props.ease])
            .attr("d",            linkPath)
            .attr("stroke-width", props.useLines ? 2 : 0);

          pathsEnter
            .filter((d) => isSurvivingSeriesLink(d) && !wasAdjacent(d))
            .attr("d",       linkPath)
            .attr("opacity", 0)
            .transition()
            .delay(phase1Dur + phase2Dur)
            .duration(phase2Dur)
            .ease(d3[props.ease])
            .attr("opacity",      R.linkOpacity)
            .attr("stroke-width", props.useLines ? 2 : 0);

          pathsEnter
            .filter((d) => isEnteringSeriesLink(d) && wasAdjacent(d))
            .attr("d",       linkPathEnterPrev)
            .attr("opacity", 0)
            .transition()
            .duration(phase1Dur)
            .ease(d3[props.ease])
            .attr("d",       linkPathPhase1)
            .attr("opacity", R.linkOpacity)
            .transition()
            .duration(phase2Dur)
            .ease(d3[props.ease])
            .attr("d",            linkPath)
            .attr("stroke-width", props.useLines ? 2 : 0);

          pathsEnter
            .filter((d) => isEnteringSeriesLink(d) && !wasAdjacent(d))
            .attr("d",       linkPath)
            .attr("opacity", 0)
            .transition()
            .delay(phase1Dur + phase2Dur)
            .duration(phase2Dur)
            .ease(d3[props.ease])
            .attr("opacity",      R.linkOpacity)
            .attr("stroke-width", props.useLines ? 2 : 0);

          pathsEnter
            .filter((d) => !isSeriesEnteringLink(d))
            .attr("opacity", 0)
            .attr("d", (d) => {
              const srcOld = prevIds.has(String(d.sourceId));
              const tgtOld = prevIds.has(String(d.targetId));
              return linkPath({
                source:       { x: d.source.x,       y: srcOld ? d.source.y       : y(0) },
                target:       { x: d.target.x,       y: tgtOld ? d.target.y       : y(0) },
                verticalEnd:  { x: d.verticalEnd.x,  y: tgtOld ? d.verticalEnd.y  : y(0) },
                returnTarget: { x: d.returnTarget.x, y: srcOld ? d.returnTarget.y : y(0) },
              });
            })
            .transition()
            .delay(enterDelay)
            .duration(phase2Dur)
            .ease(d3[props.ease])
            .attr("d",            linkPath)
            .attr("opacity",      R.linkOpacity)
            .attr("stroke-width", props.useLines ? 2 : 0);
        }

      } else {
        pathsEnter
          .merge(paths)
          .transition()
          .duration(duration)
          .delay(enterDelay)
          .attr("d",            linkPath)
          .attr("opacity",      R.linkOpacity)
          .attr("stroke-width", props.useLines ? 2 : 0);
      }

      // Exiting series links collapse in place (value-first), matching the
      // exiting series rects above — no slide-then-collapse in the no-exits case.
      const linkGroupsExit = linkGroups.exit();
      linkGroupsExit
        .selectAll("path")
        .transition()
        .duration(duration)
        .attr("d",            linkPathLeave)
        .attr("stroke-width", 0)
        .remove();
      linkGroupsExit.transition().delay(duration).remove();
    }
  }

  return {
    render(payload, props) {
      if (!payload?.svgEl) return;
      initGroups(payload, props.layerContainer?.value ?? null);
      lastPayload = payload;
      render(payload, props);
    },
    rerender(duration, props) {
      if (lastPayload) render({ ...lastPayload, duration }, props);
    },
    onZoom() {
      // Manual zoom fires onZoom (not a full draw). Re-render with the live
      // payload scales: spreading lastPayload re-evaluates its xScaleUncentered
      // getter at the CURRENT transform, so the bars follow the gesture. Zoom is
      // applied entirely by BaseCanvas now — no internal transform bookkeeping.
      if (lastPayload && lastProps) render({ ...lastPayload, duration: 0 }, lastProps);
    },
    setOrder: (order) => base.setOrder(order),
    destroy() {
      base.destroy();
      contentG            = null;
      rectsColorBg        = null;
      rects               = null;
      linksG              = null;
      rectsBg             = null;
      lastRenderData      = null;
      lastProps           = null;
      lastHadEnters       = false;
    },
  };
}
