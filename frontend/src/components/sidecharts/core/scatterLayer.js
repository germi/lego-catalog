import * as d3 from "d3";
import { createLayer } from "./layer.js";
import { resolveFill } from "../fill/resolveFill.js";
import { buildScale } from "../utils/scale/buildScale.js";
import { safeId } from "../utils/safeId.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";

export const SCATTER_LAYER_DEFAULTS = {
  data:             [],
  projector:        null,
  coordAccessor:    null,
  radius:           null,
  rScaleType:       "sqrt",
  dotSize:          [2, 12],
  valueAccessor:    (d) => d.value,
  color:            "#3B82F6",
  colorAccessor:    null,
  dotOpacity:       0.8,
  hoverFill:        null,
  strokeColor:      null,
  strokeWidth:      1,
  strokeOpacity:    0.5,
  hoverStrokeColor: null,
  highlighted:      [],
  selected:         null,
  hoverScale:       1.2,
  fixedSize:        true,
  sortByRadius:     false,
  duration:         GLOBAL_DEFAULTS.duration,
  // Highlight state (dot IS in `highlighted`)
  highlightFill:          null,
  highlightFillOpacity:   1,
  highlightStrokeColor:   null,
  highlightStrokeWidth:   null,
  highlightStrokeOpacity: null,
  // Dim state (highlighting active, dot is NOT in `highlighted`)
  dimFill:          null,
  dimOpacity:       0.15,
  dimStrokeColor:   null,
  dimStrokeWidth:   null,
  dimStrokeOpacity: null,
};

const HOVER_DURATION = 150;

// --- Projection ---

function buildProjectFn(payload, props) {
  const projector = props.projector ?? payload.projector ?? null;
  const acc = props.coordAccessor;

  if (projector) {
    if (projector.type === "geo") {
      const proj = projector.raw?.geoProjection;
      const coordAcc = acc ?? ((d) => [d.longitud, d.latitud]);
      return (d) => {
        const c = coordAcc(d);
        if (!c || !proj) return null;
        const p = proj(c);
        return p && isFinite(p[0]) && isFinite(p[1]) ? p : null;
      };
    }
    if (projector.type === "scale") {
      // Always position via the canvas's LIVE zoomed scales
      // (payload.xScale / payload.yScale) — getters BaseCanvas exposes that
      // return the projector's raw scales already rescaled by the current
      // zoom transform. This is the whole game: dots get their correct
      // on-screen pixel every render, so they follow zoom WITHOUT riding the
      // group CSS transform (which we clear in render). Programmatic zoom +
      // data change both arrive as a draw with these scales already zoomed,
      // so the d3 join's update transition slides each dot from its current
      // pixel to the new pixel. Manual wheel zoom calls onZoom → render(0),
      // which reads the same live getters and snaps each frame.
      //
      // The x/y VALUE for each datum comes from the explicit coordAccessor
      // (geo-on-scatter / map case) OR the projector's own x/y accessors.
      // Falling back to projector.raw keeps non-canvas callers working.
      const xScale = payload.xScale ?? projector.raw?.xScale;
      const yScale = payload.yScale ?? projector.raw?.yScale;
      const xVal = acc ? (d) => acc(d)?.[0] : (projector.xAccessor ?? ((d) => d.x));
      const yVal = acc ? (d) => acc(d)?.[1] : (projector.yAccessor ?? ((d) => d.y));
      return (d) => {
        if (!xScale || !yScale) return null;
        const x = xScale(xVal(d));
        const y = yScale(yVal(d));
        return isFinite(x) && isFinite(y) ? [x, y] : null;
      };
    }
    return projector.fn;
  }

  // No projector wrapper — fall back to the raw geo projection that geo
  // BaseCanvas exposes via payload.projection. Default accessor matches the
  // geoProjector convention: [longitud, latitud].
  if (payload.projection) {
    const proj = payload.projection;
    const coordAcc = acc ?? ((d) => [d.longitud, d.latitud]);
    return (d) => {
      const c = coordAcc(d);
      if (!c) return null;
      const p = proj(c);
      return p && isFinite(p[0]) && isFinite(p[1]) ? p : null;
    };
  }

  return () => null;
}

// --- Radius ---

// Per-zoom size multiplier shared by radius + stroke-width. The two zoom models
// scale sizes differently, so we resolve to ONE factor up front and multiply by
// it everywhere:
//
//   scaleZoom = true  → SCALE canvas (scatter/line). Zoom is baked into
//     payload.xScale/yScale and positions are redrawn; the group carries NO
//     transform, so a stored size is already its on-screen size.
//       fixedSize       → 1   (constant on-screen px)
//       fixedSize:false → k   (grow with zoom)
//
//   scaleZoom = false → GEO map. Zoom IS a group <g> transform that scales the
//     whole layer (positions AND sizes) by k. To keep a size constant on screen
//     we pre-divide by k so the transform cancels it.
//       fixedSize       → 1/k (constant on-screen px — the classic "inverse-scale")
//       fixedSize:false → 1   (let the transform grow it with the map)
function sizeFactorFor(props, lastK, scaleZoom) {
  const k = lastK || 1;
  if (props.fixedSize === false) return scaleZoom ? k : 1;
  return scaleZoom ? 1 : 1 / k;
}

function resolveR(d, props, rScale, sizeFactor) {
  const base =
    d.radius != null                      ? d.radius
    : typeof props.radius === "function"  ? props.radius((props.valueAccessor ?? ((x) => x.value))(d))
    : rScale                              ? rScale((props.valueAccessor ?? ((x) => x.value))(d))
    : typeof props.radius === "number"    ? props.radius
    :                                       4;
  return Math.max(0, base * sizeFactor);
}

function buildRScale(props, data) {
  if (!data?.length) return null;
  if (typeof props.radius === "function" || typeof props.radius === "number") return null;
  const va = props.valueAccessor;
  if (!va) return null;
  const domain = d3.extent(data, va);
  if (domain[0] == null || domain[0] === domain[1]) return null;
  return buildScale({ type: props.rScaleType ?? "sqrt", domain, range: props.dotSize ?? [2, 12] });
}

// --- Fill & stroke ---

function resolveColorProp(prop, d, svgEl, props) {
  if (prop == null) return null;
  if (typeof prop === "function") {
    const ca = props.colorAccessor ?? props.valueAccessor;
    return ca ? prop(ca(d)) : prop;
  }
  return resolveFill(prop, svgEl);
}

function fillFn(d, svgEl, props) {
  const perDatum = resolveFill(d.color, svgEl);
  if (perDatum) return perDatum;
  return resolveColorProp(props.color, d, svgEl, props) ?? "#3B82F6";
}

function hoverFillFn(d, svgEl, props) {
  if (d.hoverFill != null) return resolveFill(d.hoverFill, svgEl);
  return resolveColorProp(props.hoverFill, d, svgEl, props);
}

function baseStrokeFn(d, svgEl, props, isHighlighted) {
  if (isHighlighted) {
    if (d.hoverStrokeColor != null) return resolveFill(d.hoverStrokeColor, svgEl);
    if (d.strokeColor != null)      return resolveFill(d.strokeColor, svgEl);
    return resolveColorProp(props.hoverStrokeColor ?? props.strokeColor, d, svgEl, props);
  }
  if (d.strokeColor != null) return resolveFill(d.strokeColor, svgEl);
  return resolveColorProp(props.strokeColor, d, svgEl, props);
}

// Builds highlight-/dim-aware resolver closures for a single render call.
// Each resolver is datum-callable: resolver(d) → value.
// Datum fields (d.highlightFill, d.dimFill, etc.) take priority over props.
function buildResolvers(props, svgEl, sizeFactor) {
  const hlArr = Array.isArray(props.highlighted) ? props.highlighted : (props.highlighted ? [props.highlighted] : []);
  const hlSet = new Set(hlArr);
  const isHighlighting = hlSet.size > 0;
  const isHL = (d) => hlSet.has(d.id) || !!d.highlighted;

  function fill(d) {
    if (isHighlighting) {
      const hl = isHL(d);
      const c = hl ? (d.highlightFill ?? props.highlightFill) : (d.dimFill ?? props.dimFill);
      if (c != null) return resolveColorProp(c, d, svgEl, props) ?? resolveFill(c, svgEl);
    }
    return fillFn(d, svgEl, props);
  }

  function fillOpacity(d) {
    if (isHighlighting) {
      return isHL(d)
        ? (props.highlightFillOpacity ?? 1)
        : (props.dimOpacity ?? 0.15);
    }
    // No highlighting active — original dotOpacity logic.
    if (d.highlighted) return 1;
    return props.dotOpacity ?? 0.8;
  }

  function stroke(d) {
    if (isHighlighting) {
      const hl = isHL(d);
      const c = hl
        ? (d.highlightStrokeColor ?? props.highlightStrokeColor)
        : (d.dimStrokeColor ?? props.dimStrokeColor);
      if (c != null) return resolveColorProp(c, d, svgEl, props) ?? resolveFill(c, svgEl);
    }
    return baseStrokeFn(d, svgEl, props, isHL(d));
  }

  function strokeWidth(d) {
    if (isHighlighting) {
      const hl = isHL(d);
      const w = hl
        ? (d.highlightStrokeWidth ?? props.highlightStrokeWidth)
        : (d.dimStrokeWidth ?? props.dimStrokeWidth);
      if (w != null) return w * sizeFactor;
    }
    return strokeWidthFn(d, props, sizeFactor);
  }

  function strokeOpacity(d) {
    if (isHighlighting) {
      const hl = isHL(d);
      const o = hl
        ? (d.highlightStrokeOpacity ?? props.highlightStrokeOpacity)
        : (d.dimStrokeOpacity ?? props.dimStrokeOpacity);
      if (o != null) return o;
    }
    return props.strokeOpacity ?? 0.5;
  }

  return { fill, fillOpacity, stroke, strokeWidth, strokeOpacity, isHL, isHighlighting };
}

function hoverStrokeFn(d, svgEl, props) {
  if (d.hoverStrokeColor != null) return resolveFill(d.hoverStrokeColor, svgEl);
  if (d.strokeColor != null)      return resolveFill(d.strokeColor, svgEl);
  return resolveColorProp(props.hoverStrokeColor ?? props.strokeColor, d, svgEl, props);
}

function strokeWidthFn(d, props, sizeFactor) {
  const sel = props.selected;
  const isSelected = sel != null && (sel === d.id || sel?.includes?.(d.id));
  const datumW = d.strokeWidth;
  const base = datumW != null ? datumW : (isSelected ? 2 : (props.strokeWidth ?? 1));
  // Same per-zoom factor as resolveR (see sizeFactorFor): on a scale canvas the
  // stored width is the on-screen width; on a geo map it's divided by k so the
  // group transform leaves it constant.
  return base * sizeFactor;
}

// --- Sort ---

function sortData(data, props) {
  if (!props.sortByRadius || !props.valueAccessor) return data ?? [];
  return [...(data ?? [])].sort((a, b) => {
    const va = props.valueAccessor(a) ?? 0;
    const vb = props.valueAccessor(b) ?? 0;
    return vb - va; // largest value first → paints behind smaller ones
  });
}

// --- Factory ---

export function createScatterLayer({ onHover = null, onClick = null } = {}) {
  const base = createLayer({ className: "scatter-layer", prefer: "inner" });
  let lastPayload = null;
  let lastProps   = null;
  let lastK       = 1;

  function render(payload, props, durationOverride) {
    if (!payload?.svgEl) return;
    // First-time render = the layer is just mounting. The cached payload
    // duration reflects whatever the canvas last did (e.g. `draw(0)` after a
    // resize) and is irrelevant to a fresh enter — use the layer's own
    // duration prop instead so the dots animate in properly.
    const isFirstRender = !lastPayload;
    lastPayload = payload;
    lastProps   = props;

    // Accept layerContainer as either a Vue ref ({ value }) or a raw DOM node.
    const layerContainer = props.layerContainer?.value ?? props.layerContainer ?? null;
    const g = base.ensureGroup(payload, layerContainer);

    // Read the zoom scale AFTER ensureGroup (which refreshes base.transform
    // from the live d3 zoom transform). Reading it before would give the
    // stale pre-zoom k. Prefer the payload's own transform when present —
    // a programmatic-zoom draw carries the post-zoom transform directly.
    lastK = payload.zoomTransform?.k ?? base.transform.k;

    // Which zoom model is this canvas using? A SCALE canvas bakes the zoom into
    // payload.xScale/yScale (so it exposes them); a GEO map has none and zooms
    // via a group <g> transform instead.
    const scaleZoom  = !!payload.xScale;
    const sizeFactor = sizeFactorFor(props, lastK, scaleZoom);

    // ensureGroup stamps the current zoom transform on the group on every render.
    //   SCALE canvas: dots get their on-screen position from the zoomed scales,
    //     so a group transform on top would DOUBLE the zoom — clear it.
    //   GEO map: the group transform IS the zoom (positions come from the static
    //     projection) — keep it; the dots ride it and sizeFactor (1/k) keeps
    //     their radius/stroke constant on screen.
    if (scaleZoom) base.group?.attr("transform", null);

    // The canvas owns projection: for the common case just consume
    // `payload.project` / `payload.prevProject` (each pairs the right projector's
    // accessors with the right zoom-rescaled scales). Only when this layer
    // OVERRIDES the projector or supplies its own coordAccessor (e.g. plotting
    // geo points on a map canvas) do we build a layer-local project fn.
    const overridesProjection = props.projector || props.coordAccessor;
    // Consume the canvas's pre-paired `payload.project` ONLY on a SCALE canvas —
    // it pairs the projector's accessors with the zoomed scales. On a GEO map
    // the canvas has no projector, so payload.project is `() => null` (every dot
    // → 0,0). There we build our own project fn, which falls back to
    // payload.projection + our coordAccessor (the path ArcLayer uses). Also build
    // locally whenever this layer overrides the projector / coordAccessor.
    const useCanvasProject = !overridesProjection && payload.projector?.type === "scale";
    const project = useCanvasProject ? payload.project : buildProjectFn(payload, props);
    // Entering dots start where they WOULD have been under the PREVIOUS frame
    // (so a new dot flies in alongside the survivors' slide instead of growing
    // in place); exiting dots travel toward the new frame as they shrink. This
    // is a SCALE-canvas concept (payload.prevProject pairs prev scales); on a geo
    // canvas / override path there's no canvas prev → null → grow in place.
    const projectPrev = useCanvasProject ? (payload.prevProject ?? null) : null;
    const svgEl     = payload.svgEl;
    // `durationOverride` lets onZoom force a 0-duration redraw without
    // mutating the payload (which would freeze its live xScale/yScale
    // getters). Resize / data-swap drives still read from payload.duration.
    const duration  = durationOverride !== undefined
      ? durationOverride
      : isFirstRender
        ? (props.duration ?? 300)
        : (payload.duration ?? props.duration ?? 300);
    const rScale    = buildRScale(props, props.data);
    const sorted    = sortData(props.data, props);
    const R         = buildResolvers(props, svgEl, sizeFactor);

    // When duration is 0 (per-frame zoom redraw, instant prop change), we
    // set cx/cy/r DIRECTLY via .attr() instead of going through a d3
    // transition. Two reasons:
    //   1. duration(0) transitions still defer to the next animation
    //      frame, so a rapid wheel-zoom can chain-interrupt and the dots
    //      never settle on a position — that's the "circles don't move
    //      on zoom" symptom.
    //   2. .attr() is synchronous, which matters during wheel-zoom where
    //      we want the dots locked to the cursor every frame.
    // For duration > 0 (data swap, initial mount) we still use a
    // transition so the dots interpolate between scales smoothly.
    const sel = g.selectAll("circle.scatter-dot")
      .data(sorted, (d) => d.id);

    sel.join(
      (enter) =>
        enter.append("circle")
          .attr("class", "scatter-dot")
          .attr("id", (d) => `scatter-circle-${safeId(d.id)}`)
          // Start at the previous-scale position (or current on first render).
          .attr("cx", (d) => (projectPrev ?? project)(d)?.[0] ?? 0)
          .attr("cy", (d) => (projectPrev ?? project)(d)?.[1] ?? 0)
          .attr("r", 0)
          .attr("opacity", 0)
          .attr("fill", R.fill)
          .attr("fill-opacity", R.fillOpacity)
          .attr("stroke", R.stroke)
          .attr("stroke-width", R.strokeWidth)
          .attr("stroke-opacity", R.strokeOpacity)
          .attr("cursor", "pointer")
          // …then grow AND slide to the current-scale position.
          .call((s) =>
            duration > 0
              ? s.transition("scatter-enter").duration(duration)
                  .attr("opacity", 1)
                  .attr("r", (d) => resolveR(d, props, rScale, sizeFactor))
                  .attr("cx", (d) => project(d)?.[0] ?? 0)
                  .attr("cy", (d) => project(d)?.[1] ?? 0)
              : s.attr("opacity", 1)
                  .attr("r", (d) => resolveR(d, props, rScale, sizeFactor))
                  .attr("cx", (d) => project(d)?.[0] ?? 0)
                  .attr("cy", (d) => project(d)?.[1] ?? 0),
          ),
      (update) =>
        update.call((u) =>
          duration > 0
            ? u.transition().duration(duration)
                .attr("cx", (d) => project(d)?.[0] ?? 0)
                .attr("cy", (d) => project(d)?.[1] ?? 0)
                .attr("r", (d) => resolveR(d, props, rScale, sizeFactor))
                .attr("fill", R.fill)
                .attr("fill-opacity", R.fillOpacity)
                .attr("stroke", R.stroke)
                .attr("stroke-width", R.strokeWidth)
                .attr("stroke-opacity", R.strokeOpacity)
            : u.attr("cx", (d) => project(d)?.[0] ?? 0)
                .attr("cy", (d) => project(d)?.[1] ?? 0)
                .attr("r", (d) => resolveR(d, props, rScale, sizeFactor))
                .attr("fill", R.fill)
                .attr("fill-opacity", R.fillOpacity)
                .attr("stroke", R.stroke)
                .attr("stroke-width", R.strokeWidth)
                .attr("stroke-opacity", R.strokeOpacity),
        ),
      (exit) =>
        duration > 0
          // Slide to the new-scale position (alongside the survivors) while
          // shrinking + fading out — the symmetric counterpart of the enter.
          ? exit.transition().duration(duration)
              .attr("cx", (d) => project(d)?.[0] ?? 0)
              .attr("cy", (d) => project(d)?.[1] ?? 0)
              .attr("r", 0)
              .attr("opacity", 0)
              .on("end", function () { this.remove(); })
          : exit.remove(),
    )
      .on("click", (event, d) => onClick?.({ event, datum: d }))
      .on("mouseenter", function (event, d) {
        // Read lastProps/lastPayload/lastK at call time — not the render-scope
        // closure — so that a `highlighted` change (updateStyle) is visible here
        // without requiring a full re-render to re-attach handlers.
        if (!lastProps || !lastPayload) return;
        const sf = sizeFactorFor(lastProps, lastK, !!lastPayload.xScale);
        const freshRScale = buildRScale(lastProps, lastProps.data);
        const hoverScale = lastProps.hoverScale ?? SCATTER_LAYER_DEFAULTS.hoverScale;
        const sel = d3.select(this).raise();
        // NAMED "hover" transition so it co-tweens r/fill/stroke CONCURRENTLY
        // with the position (default-namespace) transition instead of
        // interrupting it. An unnamed transition here shares d3's default
        // namespace with the render update's cx/cy transition — so a hover
        // (or the mouseleave fired when a refocus slides the dot out from
        // under the cursor) would cancel the in-flight cx/cy tween and freeze
        // the dot mid-move until the next duration-0 redraw.
        const tr = sel.transition("hover").duration(HOVER_DURATION)
          .attr("r", resolveR(d, lastProps, freshRScale, sf) * hoverScale)
          .attr("stroke", hoverStrokeFn(d, lastPayload.svgEl, lastProps));
        const hf = hoverFillFn(d, lastPayload.svgEl, lastProps);
        if (hf != null) tr.attr("fill", hf);
        onHover?.({ event, datum: d });
      })
      .on("mouseleave", function (event, d) {
        if (!lastProps || !lastPayload) return;
        const sf = sizeFactorFor(lastProps, lastK, !!lastPayload.xScale);
        const freshR = buildResolvers(lastProps, lastPayload.svgEl, sf);
        const freshRScale = buildRScale(lastProps, lastProps.data);
        // NAMED "hover" transition (see mouseenter) — must NOT interrupt the
        // position cx/cy transition. This is the exact culprit behind "the
        // clicked dot stays still during refocus": mouseleave fires as the dot
        // slides out from under the cursor, and an unnamed transition here
        // would cancel its in-flight cx/cy tween.
        d3.select(this).transition("hover").duration(HOVER_DURATION)
          .attr("r", resolveR(d, lastProps, freshRScale, sf))
          .attr("fill", freshR.fill(d))
          .attr("fill-opacity", freshR.fillOpacity(d))
          .attr("stroke", freshR.stroke(d));
        onHover?.(null);
      });

    // When a highlight set is active, raise the highlighted dots above the rest
    // so they're never occluded by their dimmed neighbours (paint order
    // otherwise follows the data / sortByRadius order). Re-selecting picks up
    // any dots that just entered in this render.
    if (R.isHighlighting) {
      g.selectAll("circle.scatter-dot").filter(R.isHL).raise();
    }
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    lastK = transform.k;
    base.onZoom(transform);   // updates base.transform; ensureGroup re-stamps it on render
    // SCALE canvas: don't ride the group transform — zoom is baked into the
    // payload scales, so we clear it and the duration-0 re-render redraws each
    // dot at its pre-zoomed pixel (the contract LineLayer uses; also what lets a
    // concurrent data swap + interactive zoom resolve cleanly).
    // GEO map: zoom IS the group transform (base.onZoom just stamped it) — keep
    // it so the dots ride it; the re-render only inverse-scales radius/stroke.
    const scaleZoom = !!lastPayload?.xScale;
    if (scaleZoom) base.group?.attr("transform", null);
    if (lastPayload && lastProps) {
      render(lastPayload, lastProps, 0);
    }
  }

  // Style-only highlight/dim update — re-applies fill / fill-opacity / stroke
  // / stroke-width / stroke-opacity to the EXISTING circles WITHOUT touching
  // cx / cy / r. This is what a `highlighted` prop change should trigger:
  // instant visual feedback that never re-projects positions. A full
  // render(0) would snap every dot to its newly-computed position — fine
  // when only `highlighted` changed (positions identical), but catastrophic
  // when `highlighted` changes IN THE SAME TICK as data / zoom (every scene
  // transition in a story), because it interrupts the in-flight position
  // transition and snaps. Keeping it style-only sidesteps that entirely.
  // Style-only update — re-applies every visual attribute (fill, fill-opacity,
  // stroke, stroke-width, stroke-opacity, radius) to the EXISTING circles
  // WITHOUT re-projecting positions (cx/cy). This is the path for ANY visual
  // prop change (colour, stroke, opacity, radius, highlight/dim …): it
  // transitions the change over `duration` via a NAMED transition ("style")
  // so it runs CONCURRENTLY with the default position transition (cx/cy from
  // a data/zoom draw) without either interrupting the other — d3 keeps
  // independently-named transitions alive together. A full render(0) would
  // instead snap positions whenever a style prop changed at the same time as
  // data/zoom (every story scene transition). duration 0 → instant.
  function updateStyle(props) {
    if (!base.group || !lastPayload) return;
    lastProps = props;
    const sizeFactor = sizeFactorFor(props, lastK, !!lastPayload.xScale);
    const R = buildResolvers(props, lastPayload.svgEl, sizeFactor);
    const rScale = buildRScale(props, props.data);
    const dur = props.styleDuration ?? props.duration ?? lastPayload.duration ?? 0;
    const sel = base.group.selectAll("circle.scatter-dot");
    const target = dur > 0 ? sel.transition("style").duration(dur) : sel;
    target
      .attr("fill",           R.fill)
      .attr("fill-opacity",   R.fillOpacity)
      .attr("stroke",         R.stroke)
      .attr("stroke-width",   R.strokeWidth)
      .attr("stroke-opacity", R.strokeOpacity)
      .attr("r",              (d) => resolveR(d, props, rScale, sizeFactor));
  }

  return {
    render,
    updateStyle,
    rerender(duration, props) {
      // Use the duration-override arg instead of spreading lastPayload —
      // the spread would freeze its live xScale/yScale getters into
      // snapshots, defeating the "read current zoom on access" contract
      // that lets a layer redraw correctly into an already-zoomed canvas.
      if (lastPayload) render(lastPayload, props, duration);
    },
    onZoom,
    setVisible: base.setVisible,
    setOrder: (order) => base.setOrder(order),
    /** Returns the SVG circle element for the datum with the given id, or null. */
    getDotEl(id) {
      return base.group
        ?.selectAll("circle.scatter-dot")
        .filter((d) => d.id === id)
        .node() ?? null;
    },
    destroy() {
      base.destroy();
      lastPayload = null;
      lastProps   = null;
    },
  };
}
