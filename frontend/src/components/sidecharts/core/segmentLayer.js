import * as d3 from "d3";
import { makeTween, makePartialTween } from "../utils/animation/roseTween";
import { resolveFill } from "../fill/resolveFill";
import { findPredKey } from "../utils/animation/predecessor";
import { computeEnterPhasing, survivingValuesChanged } from "../utils/animation/phaseTiming";
import { buildScale } from "../utils/scale/buildScale.js";
import { createLayer } from "./layer.js";

export const SEGMENT_LAYER_DEFAULTS = {
  data:                null,
  max:                 null,
  scaleType:           null,
  innerRadius:         null,
  innerRadiusFn:       null,
  outerRadiusFn:       null,
  cornerRadius:        0,
  padAngle:            0.1,
  padRadius:           0.25,
  // Draw each segment as a single stroked ARC LINE (just the outer curve) instead
  // of a filled wedge — inner radius is ignored, fill is forced off, cornerRadius
  // has no effect. Same data / angular layout / animations as a normal segment, so
  // it's ideal for value lines and comparison rings on a rose canvas.
  arcLine:             false,
  startAngle:          null,
  endAngle:            null,
  interactive:         false,
  showCursorPointer:   true,
  fillColor:           null,
  hoverColor:          null,
  strokeColor:         "white",
  strokeWidth:         4,
  fillOpacity:         1,
  strokeOpacity:       1,
  useDataColorAsStroke: false,
  mode:                "radius",
  angleValue:          (d) => d.value,
  precomputedAngles:   false,
  order:               undefined,
  layerId:             null,
  series:              null,
  stacked:             false,
};

/**
 * @param callbacks  { onSelect(eventData), onHover(eventData) }
 */
export function createSegmentLayer(callbacks = {}) {
  const base = createLayer({ className: "segment-layer" });

  // -- D3 STATE --
  let arcsContainer = null;
  let previousOrder = [];
  let previousRingKeys = new Set();
  let previousCategoryOrders = new Map();
  let previousPositions = new Map();
  // Raw data + scale max from the previous draw — used to detect whether any
  // surviving arc's value actually changed (shared value-static skip).
  let previousData = [];
  let previousMax = null;
  let lastProps = null;

  // -- PURE HELPERS --

  function resolveCategoryOrder(item, series) {
    if (!series?.length) return [];
    const valuesObj = item?.values || {};
    const valueKeyIndex = new Map(Object.keys(valuesObj).map((k, i) => [k, i]));
    const present = [];
    const absent  = [];
    for (let i = 0; i < series.length; i++) {
      const s = series[i];
      if (Object.prototype.hasOwnProperty.call(valuesObj, s.key)) {
        const raw = valuesObj[s.key]?.order;
        const numeric = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
        present.push({ s, rawOrder: numeric, valueIndex: valueKeyIndex.get(s.key) ?? i, seriesIndex: i });
      } else {
        absent.push({ s, rawOrder: null, valueIndex: null, seriesIndex: i });
      }
    }
    present.sort((a, b) => {
      const aKey = a.rawOrder ?? a.valueIndex;
      const bKey = b.rawOrder ?? b.valueIndex;
      if (aKey !== bKey) return aKey - bKey;
      const aNumeric = a.rawOrder !== null;
      const bNumeric = b.rawOrder !== null;
      if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
      return a.seriesIndex - b.seriesIndex;
    });
    return [...present, ...absent];
  }

  function resolveRingOrder(data, ringKey) {
    if (!data?.length) return [];
    const entries = data.map((d, idx) => {
      const raw = d?.values?.[ringKey]?.order;
      const numeric = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
      return { d, idx, rawOrder: numeric };
    });
    entries.sort((a, b) => {
      const aKey = a.rawOrder ?? a.idx;
      const bKey = b.rawOrder ?? b.idx;
      if (aKey !== bKey) return aKey - bKey;
      const aNumeric = a.rawOrder !== null;
      const bNumeric = b.rawOrder !== null;
      if (aNumeric !== bNumeric) return aNumeric ? -1 : 1;
      return a.idx - b.idx;
    });
    return entries;
  }

  function idToCategory(compositeId) {
    const s = String(compositeId);
    const sep = s.lastIndexOf("__");
    return sep >= 0 ? s.slice(0, sep) : s;
  }

  function idToSeries(compositeId) {
    const s = String(compositeId);
    const sep = s.lastIndexOf("__");
    return sep >= 0 ? s.slice(sep + 2) : s;
  }

  // -- PROPS-DEPENDENT HELPERS --

  function computeLocalMax(props) {
    if (props.max !== null) return props.max;
    if (!props.data?.length) return 100;
    if (props.series) {
      let m = 0;
      for (const item of props.data) {
        const orderedSeries = resolveCategoryOrder(item, props.series);
        let offset = 0;
        for (const { s } of orderedSeries) {
          const v = item.values?.[s.key];
          const actual = v?.value ?? 0;
          const outer = props.stacked ? offset + actual : actual;
          m = Math.max(m, outer, v?.max ?? 0);
          if (props.stacked) offset += actual;
        }
      }
      return m || 100;
    }
    return (
      d3.max(props.data, (d) => Math.max(d.value ?? 0, d.min ?? 0, d.max ?? 0)) || 100
    );
  }

  function buildLocalScale(props) {
    const localMax = computeLocalMax(props);
    const rc = props.roseControls;
    const innerFraction = props.innerRadius ?? rc.innerRadius;
    const innerR = innerFraction * rc.radius;
    const scaleType = props.scaleType ?? rc.scaleType;
    return buildScale({
      type:   scaleType === "linear" ? "linear" : "sqrt",
      domain: [0, localMax],
      range:  [innerR, rc.radius],
    });
  }

  function buildFlatArcs(props) {
    const { data, series, mode, stacked, startAngle: pStart, endAngle: pEnd } = props;
    if (!data?.length || !series?.length) return [];
    const rc = props.roseControls;

    const start = ((pStart ?? rc.startAngle) * Math.PI) / 180;
    let end = ((pEnd ?? rc.endAngle) * Math.PI) / 180;
    if (end < start) end += 2 * Math.PI;

    const isAngle = mode === "angle";

    if (isAngle) {
      const result = [];
      for (let ri = 0; ri < series.length; ri++) {
        const s = series[ri];
        const orderedEntries = resolveRingOrder(data, s.key);
        const orderedRawData = orderedEntries.map((e) => e.d);
        const ringPie = d3
          .pie().startAngle(start).endAngle(end)
          .value((d) => d.values?.[s.key]?.value ?? 0)
          .sort(null)(orderedRawData);
        for (let oi = 0; oi < ringPie.length; oi++) {
          const a = ringPie[oi];
          const sv = a.data.values?.[s.key] ?? {};
          result.push({
            ...a,
            data: {
              id: `${a.data.id}__${s.key}`,
              categoryId: a.data.id,
              seriesKey: s.key,
              ringIdx: ri,
              name: a.data.name,
              color: sv.color ?? s.color ?? a.data.color ?? null,
              hoverColor: sv.hoverColor ?? s.hoverColor ?? a.data.hoverColor ?? null,
              value: sv.value ?? 0,
              orderIndex: oi,
              order: orderedEntries[oi].rawOrder,
            },
          });
        }
      }
      return result;
    }

    const localMax = computeLocalMax(props);
    const categoryArcs = d3.pie().startAngle(start).endAngle(end).value(localMax).sort(null)(data);
    const result = [];
    for (let ci = 0; ci < data.length; ci++) {
      const catArc = categoryArcs[ci];
      const item = data[ci];
      let offset = 0;
      const orderedSeries = resolveCategoryOrder(item, series);
      for (let oi = 0; oi < orderedSeries.length; oi++) {
        const { s, rawOrder } = orderedSeries[oi];
        const sv = item.values?.[s.key] ?? {};
        const actual = sv.value ?? 0;
        const stackOffset = stacked ? offset : 0;
        const outerValue  = stacked ? offset + actual : actual;
        result.push({
          data: {
            id: `${item.id}__${s.key}`,
            categoryId: item.id,
            seriesKey: s.key,
            name: item.name,
            value: outerValue,
            stackOffset,
            orderIndex: oi,
            order: rawOrder,
            min: sv.min ?? 0,
            max: sv.max ?? sv.value ?? 0,
            color: sv.color ?? s.color ?? item.color ?? null,
            hoverColor: sv.hoverColor ?? s.hoverColor ?? item.hoverColor ?? null,
          },
          value: catArc.value,
          startAngle: catArc.startAngle,
          endAngle: catArc.endAngle,
          padAngle: catArc.padAngle,
          index: catArc.index,
        });
        if (stacked) offset += actual;
      }
    }
    return result;
  }

  function buildArcs(props) {
    if (!props.data) return [];
    if (props.series) return buildFlatArcs(props);

    if (props.precomputedAngles) {
      return props.data.map((d, i) => ({
        data: d,
        value: d._endAngle - d._startAngle,
        startAngle: d._startAngle,
        endAngle: d._endAngle,
        padAngle: props.padAngle,
        index: i,
      }));
    }

    const rc = props.roseControls;
    const localMax = computeLocalMax(props);
    const start = ((props.startAngle ?? rc.startAngle) * Math.PI) / 180;
    let end = ((props.endAngle ?? rc.endAngle) * Math.PI) / 180;
    if (end < start) end += 2 * Math.PI;

    const valueFn = props.mode === "angle" ? (d) => props.angleValue(d) : localMax;
    return d3.pie().startAngle(start).endAngle(end).value(valueFn).sort(null)(props.data);
  }

  function buildArcOrders(arcData, isAngle) {
    const map = new Map();
    const groupKey  = isAngle ? (d) => String(d.data.seriesKey ?? "") : (d) => String(d.data.categoryId ?? d.data.id);
    const memberKey = isAngle ? (d) => String(d.data.categoryId ?? "") : (d) => String(d.data.seriesKey ?? "");
    for (const d of arcData) {
      const k = groupKey(d);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push({ key: memberKey(d), order: d.data.order ?? null });
    }
    return map;
  }

  function ensureGroups(props) {
    const rc = props.roseControls;
    if (!rc?.svgGroup || !rc?.svgEl) return false;
    if (!arcsContainer) {
      const g = base.ensureGroup({ svgEl: rc.svgEl }, rc.svgGroup.node());
      arcsContainer = g.append("g");
    }
    // Re-apply on every render so a live `interactive` toggle (e.g. a hit-area
    // layer that flips on only at the end of a multi-stage animation) actually
    // updates pointer-event capture instead of being baked in at first mount.
    arcsContainer.attr("class", props.interactive ? null : "pointer-events-none");
    return true;
  }

  function createArc(props) {
    if (props.arcLine) return createArcLine(props);
    const rc = props.roseControls;
    return d3.arc()
      .innerRadius((d) => d.data._innerR ?? 0)
      .outerRadius((d) => d.data._outerR ?? 0)
      .padRadius(props.padRadius * rc.radius)
      .padAngle(props.padAngle)
      .cornerRadius(props.cornerRadius);
  }

  // Single-arc "line" generator — same call signature as d3.arc() (takes an arc
  // datum, returns a path string) so it slots straight into makeTween /
  // makePartialTween and the whole enter/update/exit choreography. It emits ONE
  // `M … A …` (the outer curve only, no return edge, no Z), at radius `_outerR`,
  // so a dash-array renders on a single pass instead of the doubled ring you get
  // from d3.arc() with innerRadius === outerRadius. The padAngle inset replicates
  // d3.arc's exact outer-edge geometry, so an arc line aligns with wedge segments
  // on the same canvas. cornerRadius and innerRadius are intentionally ignored.
  function createArcLine(props) {
    const rc = props.roseControls;
    const padRadius = props.padRadius * rc.radius;
    const pad = props.padAngle ?? 0;
    const pt = (r, a) => `${(r * Math.sin(a)).toFixed(4)},${(-r * Math.cos(a)).toFixed(4)}`;
    return function arcLine(d) {
      const r = +(d.data?._outerR ?? 0);
      let a0 = d.startAngle, a1 = d.endAngle;
      if (!(r > 0) || !(a1 > a0)) return `M${pt(r, (a0 + a1) / 2)}`; // collapsed → a point
      // d3.arc's outer-edge padAngle inset: p = asin((padRadius/r)·sin(padAngle/2)).
      if (pad > 0 && padRadius > 0) {
        const p = Math.asin(Math.min(1, (padRadius / r) * Math.sin(pad / 2))) || 0;
        a0 += p; a1 -= p;
        if (a1 <= a0) return `M${pt(r, (d.startAngle + d.endAngle) / 2)}`; // fully padded away
      }
      const large = a1 - a0 > Math.PI ? 1 : 0;
      return `M${pt(r, a0)}A${r.toFixed(4)},${r.toFixed(4)},0,${large},1,${pt(r, a1)}`;
    };
  }

  function stampRadii(arcs, scale, props) {
    const innerFn = props.innerRadiusFn || (() => 0);
    const outerFn =
      props.outerRadiusFn ||
      (props.interactive ? (_, s) => s.range()[1] : (d, s) => s(d.value ?? 0));
    return arcs.map((a) => ({
      ...a,
      data: {
        ...a.data,
        _innerR: innerFn(a.data, scale),
        _outerR: outerFn(a.data, scale),
      },
    }));
  }

  function normalFill(props) {
    return props.fillColor;
  }

  function resolveHoverFill(props) {
    const rc = props.roseControls;
    const svgEl = rc?.svgEl;
    if (svgEl && typeof props.hoverColor === "object" && props.hoverColor?.register) {
      return resolveFill(props.hoverColor, svgEl, { centerX: 0, centerY: 0, maxRadius: rc.radius });
    }
    return props.hoverColor;
  }

  function resolveColor(color, props) {
    const rc = props.roseControls;
    const svgEl = rc?.svgEl;
    if (svgEl && typeof color === "object" && color?.register) {
      return resolveFill(color, svgEl, { centerX: 0, centerY: 0, maxRadius: rc.radius });
    }
    return color;
  }

  // -- RENDER --

  function render(payload, props) {
    if (!ensureGroups(props) || !props.data) return;
    lastProps = props;
    base.setOrder(props.order);

    const rc = props.roseControls;
    const scale = buildLocalScale(props);
    const isAngle = props.mode === "angle";
    const isPrecomputed = props.precomputedAngles;
    const arc = createArc(props);
    const arcTween = makeTween(arc);
    const perArcStroke = props.useDataColorAsStroke;
    const cursorClass = props.interactive && props.showCursorPointer ? "cursor-pointer" : "";
    const innerR = scale.range()[0];
    const arcData = stampRadii(buildArcs(props), scale, props);
    const dur = payload?.duration ?? rc.duration;

    function fill(d) {
      if (props.arcLine) return "none"; // a stroked line has no fill area
      const categoryId = d.data.categoryId ?? d.data.id;
      const isHighlighted = categoryId === rc.highlighted;
      if (props.interactive && props.fillColor !== null) {
        return isHighlighted ? resolveHoverFill(props) : normalFill(props);
      }
      if (props.hoverColor !== null && isHighlighted) return resolveHoverFill(props);
      const itemColor = isHighlighted ? d.data.hoverColor || d.data.color : d.data.color;
      if (itemColor != null) return resolveColor(itemColor, props);
      if (props.fillColor != null) return resolveColor(props.fillColor, props);
      return null;
    }

    const currentArcsById = new Map(arcData.map((d) => [d.data.id, d]));
    const currentIds = new Set(currentArcsById.keys());
    const currentCategoryOrders = buildArcOrders(arcData, isAngle);

    const prevIdSet = new Set(previousOrder);
    const hasExits  = previousOrder.some((id) => !currentIds.has(id));
    const hasEnters = arcData.some((d) => !prevIdSet.has(d.data.id));
    const isFirstDraw = previousOrder.length === 0;

    const oldCategories = new Set(previousOrder.map(idToCategory));
    const newCategories = new Set(arcData.map((d) => String(d.data.categoryId ?? d.data.id)));
    const categoriesChanged =
      !isFirstDraw &&
      (oldCategories.size !== newCategories.size ||
        [...oldCategories].some((c) => !newCategories.has(c)));

    const currentRingKeys =
      isAngle && props.series
        ? new Set(arcData.map((a) => a.data.seriesKey).filter(Boolean))
        : new Set();
    const ringsChanged =
      isAngle &&
      previousRingKeys.size > 0 &&
      (currentRingKeys.size !== previousRingKeys.size ||
        [...previousRingKeys].some((k) => !currentRingKeys.has(k)));

    const structuralChange = isAngle ? ringsChanged : categoriesChanged;
    // hasSurvivors gates the slide: if EVERY arc exits (complete category/ring
    // change), there is nothing to reposition so entering elements must not wait
    // for a phase-2 that never happens.
    const hasSurvivors = arcData.some((d) => prevIdSet.has(d.data.id));
    const needsSlide = hasSurvivors && structuralChange;

    // Skip the value phase on a pure-enter change where no surviving arc's value
    // moves. `scaleMax` reflects the radius scale, so an auto-scale shift still
    // counts as a change — except in isAngle mode where ring radii come from
    // positional seriesRingInnerFn/outerFn rather than the scale, so a scaleMax
    // shift there has no visual effect.
    const scaleMax = scale.domain()[scale.domain().length - 1];
    const valuesChanged = isAngle
      ? survivingValuesChanged(previousData, props.data)
      : scaleMax !== previousMax || survivingValuesChanged(previousData, props.data);

    const { phase1Dur, enterDelay } = computeEnterPhasing({
      duration:      dur,
      // structuralChange gates phase-1 existence (exits/enters need category-level
      // change to justify a collapse/wait). needsSlide (= hasSurvivors && structural)
      // gates phase-2 (survivors actually reposition). These are two separate guards:
      // complete-category-change has structuralChange=true but needsSlide=false, so
      // exits get phase-1 (collapses) and enters wait, but there is no phase-2 slide.
      hasExits:      structuralChange && hasExits,
      hasEnters:     structuralChange && hasEnters,
      waitForPhase2: needsSlide,
      // Value-first for the enter-only case too, to match RibbonLayer: phase 1
      // updates radii ("data") at the OLD angles, phase 2 slides the angular
      // layout. The update branch keys off phase1Dur (not hasExits), so this
      // alone routes survivors through the same value-then-layout chain.
      phase1OnSlide: true,
      valuesChanged,
    });

    const pieStart = isPrecomputed
      ? 0
      : ((props.startAngle ?? rc.startAngle) * Math.PI) / 180;

    function findExitCollapseR(id, categoryId) {
      if (!props.stacked) return innerR;
      const catKey = String(categoryId);
      const predKey = findPredKey({
        myKey: idToSeries(id), catKey,
        direction: "leave",
        prevOrders: previousCategoryOrders,
        currentOrders: currentCategoryOrders,
      });
      if (!predKey) return innerR;
      return currentArcsById.get(`${catKey}__${predKey}`)?.data._outerR ?? innerR;
    }

    function findEnterCollapseR(id, categoryId, useLive = false) {
      if (!props.stacked) return innerR;
      const catKey = String(categoryId);
      const predKey = findPredKey({
        myKey: idToSeries(id), catKey,
        direction: "enter",
        prevOrders: previousCategoryOrders,
        currentOrders: currentCategoryOrders,
      });
      if (!predKey) return innerR;
      const predId = `${catKey}__${predKey}`;
      if (useLive || phase1Dur === 0) return previousPositions.get(predId)?.outerR ?? innerR;
      return currentArcsById.get(predId)?.data._outerR ?? previousPositions.get(predId)?.outerR ?? innerR;
    }

    function findOldRingRadii(seriesKey) {
      const key = String(seriesKey);
      for (const pid of previousOrder) {
        if (idToSeries(pid) !== key) continue;
        const pos = previousPositions.get(pid);
        if (pos?.innerR !== undefined && pos?.outerR !== undefined)
          return { innerR: pos.innerR, outerR: pos.outerR };
      }
      return null;
    }

    function findOldCategoryAngles(catId) {
      const key = String(catId);
      for (const pid of previousOrder) {
        if (idToCategory(pid) !== key) continue;
        const pos = previousPositions.get(pid);
        if (pos?.startAngle !== undefined && pos?.endAngle !== undefined)
          return { startAngle: pos.startAngle, endAngle: pos.endAngle };
      }
      return null;
    }

    function findEnterAngle(id, useLive = false) {
      const idx = arcData.findIndex((a) => a.data.id === id);
      if (isAngle) {
        const ringKey   = String(arcData[idx]?.data.seriesKey ?? "");
        const memberKey = String(arcData[idx]?.data.categoryId ?? "");
        const predKey = findPredKey({
          myKey: memberKey, catKey: ringKey,
          direction: "enter",
          prevOrders: previousCategoryOrders,
          currentOrders: currentCategoryOrders,
        });
        if (predKey) {
          const predId = `${predKey}__${ringKey}`;
          if (useLive || phase1Dur === 0) {
            const a = previousPositions.get(predId)?.endAngle;
            if (a !== undefined) return a;
          } else {
            const cur = currentArcsById.get(predId);
            if (cur) return cur.endAngle;
            const a = previousPositions.get(predId)?.endAngle;
            if (a !== undefined) return a;
          }
        }
      } else {
        const catId = String(arcData[idx]?.data.categoryId ?? arcData[idx]?.data.id);
        for (let i = idx - 1; i >= 0; i--) {
          const prevCatId = String(arcData[i].data.categoryId ?? arcData[i].data.id);
          if (prevCatId === catId) continue;
          return (
            previousPositions.get(arcData[i].data.id)?.endAngle ?? arcData[i].endAngle
          );
        }
      }
      return pieStart;
    }

    function findRingCollapseAngle(exitingId) {
      const ringKey   = idToSeries(exitingId);
      const memberKey = idToCategory(exitingId);
      const predKey = findPredKey({
        myKey: memberKey, catKey: ringKey,
        direction: "leave",
        prevOrders: previousCategoryOrders,
        currentOrders: currentCategoryOrders,
      });
      if (predKey) {
        const predId = `${predKey}__${ringKey}`;
        const a = currentArcsById.get(predId);
        if (a) return a.endAngle;
      }
      return pieStart;
    }

    const sel = arcsContainer
      .attr("stroke", perArcStroke ? null : props.strokeColor)
      .attr("stroke-width", props.strokeWidth)
      .selectAll("path")
      .data(arcData, (d) => d.data.id);

    sel.join(
      (enter) => {
        const path = enter
          .append("path")
          .attr("fill", fill)
          .attr("fill-opacity", props.fillOpacity)
          .attr("stroke", perArcStroke ? (d) => d.data.color : null)
          .attr("stroke-opacity", props.strokeOpacity ?? 1)
          .attr("class", cursorClass || null)
          .attr("id", props.layerId ? (d) => `arc-${props.layerId}-${d.data.id}` : null)
          .each(function (d) {
            const catId = d.data.categoryId ?? d.data.id;
            if (isAngle) {
              const isSurvivingRing =
                structuralChange && phase1Dur > 0 &&
                previousRingKeys.has(String(d.data.seriesKey));
              const enterAngle = findEnterAngle(d.data.id, isSurvivingRing);
              if (isSurvivingRing) {
                const rr = findOldRingRadii(d.data.seriesKey);
                this._current = {
                  ...d,
                  startAngle: enterAngle,
                  endAngle: enterAngle,
                  data: { ...d.data, _innerR: rr?.innerR ?? d.data._innerR, _outerR: rr?.outerR ?? d.data._outerR },
                };
              } else {
                this._current = { ...d, startAngle: enterAngle, endAngle: enterAngle };
              }
            } else {
              const isSurvivingCat =
                structuralChange && phase1Dur > 0 && oldCategories.has(String(catId));
              const enterR = findEnterCollapseR(d.data.id, catId, isSurvivingCat);
              const catAngles = isSurvivingCat ? findOldCategoryAngles(catId) : null;
              this._current = catAngles
                ? { ...d, startAngle: catAngles.startAngle, endAngle: catAngles.endAngle, data: { ...d.data, _innerR: enterR, _outerR: enterR } }
                : { ...d, data: { ...d.data, _innerR: enterR, _outerR: enterR } };
            }
          })
          .attr("d", function () { return arc(this._current); })
          .call((p) => {
            p.each(function (d) {
              const isSurviving =
                structuralChange && phase1Dur > 0 &&
                (isAngle
                  ? previousRingKeys.has(String(d.data.seriesKey))
                  : oldCategories.has(String(d.data.categoryId ?? d.data.id)));
              const sel = d3.select(this);
              if (isSurviving) {
                sel
                  .attr("opacity", 1)
                  .transition("arc").duration(phase1Dur)
                  .attrTween("d", makePartialTween(arc, { dimension: "data",   mode: props.mode }))
                  .transition().duration(dur)
                  .attrTween("d", makePartialTween(arc, { dimension: "layout", mode: props.mode }));
              } else {
                sel
                  .attr("opacity", enterDelay > 0 ? 0 : 1)
                  .transition("arc").delay(enterDelay).duration(0).attr("opacity", 1)
                  .transition().duration(dur).attrTween("d", arcTween);
              }
            });
          });

        if (props.interactive) {
          path
            .on("mouseenter", function (_, d) {
              callbacks.onHover?.({ target: this, data: d.data });
              // Don't fight an active arc tween — a direct `.attr("fill", …)`
              // would flash for one frame then be overwritten by the next
              // transition tick. Skip the local restyle while animating.
              if (d3.active(this, "arc")) return;
              const hf = props.fillColor !== null
                ? resolveHoverFill(props)
                : resolveColor(d.data.hoverColor || d.data.color, props);
              d3.select(this).attr("fill", hf);
            })
            .on("mouseleave", function (_, d) {
              callbacks.onHover?.(null);
              if (d3.active(this, "arc")) return;
              const nf = props.fillColor !== null
                ? (d.data.categoryId ?? d.data.id) === rc.highlighted
                  ? resolveHoverFill(props)
                  : normalFill(props)
                : resolveColor(d.data.color, props);
              d3.select(this).attr("fill", nf);
            })
            .on("click", function (_, d) {
              callbacks.onSelect?.({ target: this, data: d.data });
            });
        }
        return path;
      },
      (update) => {
        if (!structuralChange) {
          // No structural change → simple single-phase arc transition.
          // Attach style attrs onto that same transition so prop changes
          // (e.g. fillOpacity 0 → 1, colour swaps) animate over `dur`.
          update.call((path) => {
            path.transition("arc").duration(dur)
              .attrTween("d", arcTween)
              .attr("fill", fill)
              .attr("fill-opacity", props.fillOpacity)
              .attr("stroke-opacity", props.strokeOpacity ?? 1)
              .attr("stroke", perArcStroke ? (d) => d.data.color : null);
          });
        } else if (phase1Dur === 0) {
          // Structural change with no surviving overlap — keep style attrs
          // instant; a parallel "style" transition would interleave with
          // the two-phase d-tween chain.
          update.call((path) => {
            path.transition("arc").duration(dur)
              .attrTween("d", makePartialTween(arc, { dimension: "angles", mode: props.mode }))
              .transition().duration(dur)
              .attrTween("d", makePartialTween(arc, { dimension: "layout", mode: props.mode }));
            path
              .attr("fill", fill)
              .attr("fill-opacity", props.fillOpacity)
              .attr("stroke-opacity", props.strokeOpacity ?? 1)
              .attr("stroke", perArcStroke ? (d) => d.data.color : null);
          });
        } else {
          update.call((path) => {
            path.transition("arc").duration(phase1Dur)
              .attrTween("d", makePartialTween(arc, { dimension: "data",   mode: props.mode }))
              .transition().duration(dur)
              .attrTween("d", makePartialTween(arc, { dimension: "layout", mode: props.mode }));
            path
              .attr("fill", fill)
              .attr("fill-opacity", props.fillOpacity)
              .attr("stroke-opacity", props.strokeOpacity ?? 1)
              .attr("stroke", perArcStroke ? (d) => d.data.color : null);
          });
        }
      },
      (exit) =>
        exit.call((path) =>
          path
            .each(function (d) {
              if (isAngle) {
                const target = findRingCollapseAngle(d.data.id);
                d.startAngle = target;
                d.endAngle   = target;
              } else {
                const catId    = String(d.data.categoryId ?? d.data.id);
                const collapseR = findExitCollapseR(d.data.id, catId);
                d.data._innerR = collapseR;
                d.data._outerR = collapseR;
              }
            })
            .transition("arc").duration(phase1Dur || dur)
            .attrTween("d", arcTween)
            .remove(),
        ),
    );

    previousOrder = arcData.map((d) => d.data.id);
    previousRingKeys = currentRingKeys;
    previousCategoryOrders = currentCategoryOrders;
    previousData = props.data;
    previousMax = scaleMax;
    previousPositions = new Map(
      arcData.map((d) => [
        d.data.id,
        { outerR: d.data._outerR, innerR: d.data._innerR, endAngle: d.endAngle, startAngle: d.startAngle },
      ]),
    );
  }

  // -- HIGHLIGHT UPDATE (fill-only, no full redraw) --

  function updateHighlight(newVal, prevVal, props) {
    if (!arcsContainer) return;
    // Arc lines never carry a fill (see fill()); the highlight fill-swap below
    // would otherwise paint the open arc's implied chord region on hover.
    if (props.arcLine) return;

    // Skip the fill write on any path that currently has an "arc" transition
    // running — otherwise an unrelated hover (which propagates here via
    // `roseHighlighted`) would interrupt the in-flight animation by writing
    // directly to the same attribute the transition is tweening.
    const setFill = (sel, fillFn) => sel.each(function (d, i) {
      if (d3.active(this, "arc")) return;
      const v = typeof fillFn === "function" ? fillFn.call(this, d, i) : fillFn;
      d3.select(this).attr("fill", v);
    });
    const matchId = (id) => (d) => (d.data.categoryId ?? d.data.id) === id;

    if ((props.interactive && props.fillColor !== null) || props.hoverColor !== null) {
      if (newVal) {
        setFill(arcsContainer.selectAll("path").filter(matchId(newVal)), resolveHoverFill(props));
        if (prevVal)
          setFill(arcsContainer.selectAll("path").filter(matchId(prevVal)), normalFill(props));
      } else if (prevVal) {
        setFill(arcsContainer.selectAll("path").filter(matchId(prevVal)), normalFill(props));
      }
    } else if (!props.fillColor) {
      const rc  = props.roseControls;
      const svgEl = rc?.svgEl;
      const ctx   = { centerX: 0, centerY: 0, maxRadius: rc?.radius };
      const resolveArcColor = (c) => (svgEl ? resolveFill(c, svgEl, ctx) : null) ?? c;
      if (newVal) {
        setFill(
          arcsContainer.selectAll("path").filter(matchId(newVal)),
          (d) => resolveArcColor(d.data.hoverColor || d.data.color),
        );
        if (prevVal)
          setFill(arcsContainer.selectAll("path").filter(matchId(prevVal)), (d) => resolveArcColor(d.data.color));
      } else if (prevVal) {
        setFill(arcsContainer.selectAll("path").filter(matchId(prevVal)), (d) => resolveArcColor(d.data.color));
      }
    }
  }

  // -- DESTROY (unmount animation) --

  function destroy() {
    if (!arcsContainer) return;
    const g = base.group;
    base.detach();
    const props = lastProps;
    if (!props) {
      g?.remove();
      arcsContainer = null;
      return;
    }
    const rc     = props.roseControls;
    const scale  = buildLocalScale(props);
    const arc    = createArc(props);
    const isAngle = props.mode === "angle";
    const arcTween = makeTween(arc);
    const innerR   = scale.range()[0];

    arcsContainer
      .selectAll("path")
      .each(function (d) {
        if (isAngle) {
          d.endAngle = d.startAngle;
        } else {
          d.data._innerR = innerR;
          d.data._outerR = innerR;
        }
      })
      .transition("arc")
      .duration(rc?.duration ?? 300)
      .attrTween("d", arcTween)
      .attr("opacity", 0)
      .remove()
      .end()
      .catch(() => {})
      .finally(() => {
        g?.remove();
        arcsContainer = null;
      });
  }

  return {
    render(payload, props) { render(payload, props); },
    rerender(props) { if (lastProps) render(null, props); },
    setOrder: (order) => base.setOrder(order),
    updateHighlight,
    destroy,
  };
}
