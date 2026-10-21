import * as d3 from "d3";
import { createLayer } from "./layer.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";

export const ARC_LAYER_DEFAULTS = {
  data:              [],
  projector:         null,
  color:             "#6366F1",
  width:             1.5,
  opacity:           1,
  curvature:         2,
  fixedSize:         false,
  duration:          GLOBAL_DEFAULTS.duration,
  dashArray:         null,
  animate:           false,
  animateSpeed:      0.5,
  // Label — text follows the arc curve via <textPath>
  labelFontSize:     11,
  labelColor:        null,   // falls back to arc color per datum
  labelBgColor:      "#fff", // halo stroke behind glyphs for legibility
  labelBgWidth:      3,
  labelDy:           -4,    // lift off the path (negative = above)
  // Highlight / dim
  highlighted:        [],
  highlightOpacity:   1,
  highlightColor:     null,
  highlightWidth:     null,
  highlightDashArray: null,
  dimOpacity:         0.15,
  dimColor:           null,
  dimWidth:           null,
  dimDashArray:       null,
};

// Resolves a coordinate-level project function: (coord) => [svgX, svgY] | null.
// Works for scale (cartesian) projectors, geo projectors, and the legacy raw
// geo projection that geo BaseCanvas exposes via payload.projection.
// xScaleOverride / yScaleOverride let callers inject the canvas's zoom-baked
// scales (payload.xScale / payload.prevXScale) instead of the raw unzoomed ones
// stored on projector.raw — same pattern ScatterLayer uses for dot positioning.
function projectFnFromProjector(projector, geoFallback, xScaleOverride, yScaleOverride) {
  if (projector?.type === "scale") {
    const xScale = xScaleOverride ?? projector.raw?.xScale;
    const yScale = yScaleOverride ?? projector.raw?.yScale;
    return (coord) => {
      if (!coord || !xScale || !yScale) return null;
      const x = xScale(coord[0]);
      const y = yScale(coord[1]);
      return isFinite(x) && isFinite(y) ? [x, y] : null;
    };
  }
  if (projector?.type === "geo") {
    const geoProj = projector.raw?.geoProjection;
    return (coord) => {
      if (!coord || !geoProj) return null;
      const p = geoProj(coord);
      return p && isFinite(p[0]) && isFinite(p[1]) ? p : null;
    };
  }
  if (geoFallback) {
    return (coord) => {
      if (!coord) return null;
      const p = geoFallback(coord);
      return p && isFinite(p[0]) && isFinite(p[1]) ? p : null;
    };
  }
  return () => null;
}

function buildCoordProjectFn(payload, props) {
  const projector = props.projector ?? payload.projector ?? null;
  return projectFnFromProjector(projector, payload.projection ?? null, payload.xScale, payload.yScale);
}

// Pixel-space arc: source → target, sweep=1. The visible arc uses this.
function arcPathPx(a, b, curvature) {
  if (!a || !b) return "";
  const [x1, y1] = a;
  const [x2, y2] = b;
  if (!curvature) return `M${x1},${y1}L${x2},${y2}`;
  const dx = x2 - x1, dy = y2 - y1;
  const r = Math.sqrt(dx * dx + dy * dy) / curvature;
  return `M${x1},${y1}A${r},${r} 0 0,1 ${x2},${y2}`;
}

// Pixel-space variant of the label defs path: always drawn left-to-right.
// When the source pixel is to the right of the target we swap the endpoints
// and invert the sweep flag — the arc shape is geometrically identical to the
// visible arc (reversing traversal + flipping sweep yields the same curve),
// but traversed left-to-right so `dy` consistently lifts the label ABOVE it.
// Driven per-frame from INTERPOLATED pixels (see dTween) so the ltr flip
// happens continuously at the crossing, never as a discontinuous sweep-flag
// jump under D3's default string interpolation.
function labelArcPathPx(a, b, curvature) {
  if (!a || !b) return "";
  const ltr        = a[0] <= b[0];
  const [sx, sy]   = ltr ? a : b;
  const [ex, ey]   = ltr ? b : a;
  const sweep      = ltr ? 1 : 0;
  if (!curvature) return `M${sx},${sy}L${ex},${ey}`;
  const dx   = ex - sx, dy = ey - sy;
  const r    = Math.sqrt(dx * dx + dy * dy) / curvature;
  return `M${sx},${sy}A${r},${r} 0 0,${sweep} ${ex},${ey}`;
}


let _layerCounter = 0;

export function createArcLayer({ onHover = null, onClick = null } = {}) {
  const layerId      = `al${++_layerCounter}`;
  const base         = createLayer({ className: "arc-layer" });
  let lastProps      = null;
  let lastPayload    = null;
  let lastK          = 1;
  let rafId          = null;
  let animOffset     = 0;
  let lastResolvers  = null;

  function startAnim() {
    if (rafId !== null) return;
    function tick() {
      if (!base.group) { rafId = requestAnimationFrame(tick); return; }
      const { animateSpeed = 0.5, dashArray = null } = lastProps ?? {};
      animOffset -= animateSpeed;
      base.group
        .selectAll("path.arc")
        .filter((d) => !!(d.dashArray ?? dashArray))
        .attr("stroke-dashoffset", animOffset);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function stopAnim() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function render(payload, props, durationOverride) {
    if (!payload) return;
    const g = base.ensureGroup(payload, props.layerContainer?.value ?? null);
    lastPayload = payload;
    lastProps   = props;
    lastK       = payload.zoomTransform?.k ?? base.transform.k;

    // Scale canvas bakes zoom into payload.xScale/yScale; clear the group
    // transform so it doesn't double-apply. Geo canvas: keep the group
    // transform — it IS the zoom.
    const scaleZoom = !!payload.xScale;
    if (scaleZoom) base.group?.attr("transform", null);

    const {
      data        = [],
      color       = "#6366F1",
      width       = 1.5,
      opacity     = 1,
      curvature   = 2,
      fixedSize   = false,
      dashArray   = null,
      animate     = false,
      duration: propDuration = 300,
      labelFontSize = ARC_LAYER_DEFAULTS.labelFontSize,
      labelColor    = ARC_LAYER_DEFAULTS.labelColor,
      labelBgColor  = ARC_LAYER_DEFAULTS.labelBgColor,
      labelBgWidth  = ARC_LAYER_DEFAULTS.labelBgWidth,
      labelDy       = ARC_LAYER_DEFAULTS.labelDy,
      highlighted        = [],
      highlightOpacity   = 1,
      highlightColor     = null,
      highlightWidth     = null,
      highlightDashArray = null,
      dimOpacity         = 0.15,
      dimColor           = null,
      dimWidth           = null,
      dimDashArray       = null,
    } = props;
    const duration = durationOverride !== undefined
      ? durationOverride
      : (payload.duration ?? propDuration);

    g.transition().duration(duration).attr("opacity", opacity);

    const highlightedSet = new Set(Array.isArray(highlighted) ? highlighted : (highlighted ? [highlighted] : []));
    const isHighlighting = highlightedSet.size > 0;
    const resolveOpacity = (d) => {
      if (!isHighlighting) return 1;
      return highlightedSet.has(d.id) ? highlightOpacity : dimOpacity;
    };
    const resolveColor = (d) => {
      if (!isHighlighting) return d.color || color;
      return highlightedSet.has(d.id) ? (highlightColor || d.color || color) : (dimColor || d.color || color);
    };
    const resolveSw = (d) => {
      const bw = isHighlighting
        ? (highlightedSet.has(d.id) ? (highlightWidth ?? d.width ?? width) : (dimWidth ?? d.width ?? width))
        : (d.width || width);
      return bw / (fixedSize ? lastK : 1);
    };
    const resolveDa = (d) => {
      if (!isHighlighting) return d.dashArray ?? dashArray ?? null;
      return highlightedSet.has(d.id)
        ? (highlightDashArray ?? d.dashArray ?? dashArray ?? null)
        : (dimDashArray ?? d.dashArray ?? dashArray ?? null);
    };

    lastResolvers = { resolveOpacity, resolveColor, resolveSw, resolveDa };

    const project = buildCoordProjectFn(payload, props);
    // Previous-frame coordinate project fn for enter/exit fly animations.
    // Canvas provides payload.prevProjector + payload.prevXScale/prevYScale
    // (zoom-baked) so entering arcs begin at the previous frame's pixel
    // positions, not the unzoomed scale positions. No prev fn when the
    // layer overrides the projector (caller manages coordinate frames).
    const hasProjectorOverride = !!props.projector;
    const prevProjectorObj = hasProjectorOverride ? null : (payload.prevProjector ?? null);
    const projectPrev = prevProjectorObj
      ? projectFnFromProjector(prevProjectorObj, payload.projection ?? null, payload.prevXScale, payload.prevYScale)
      : project;

    // Endpoint pixel getters. Arcs are positioned/animated in PIXEL space (not
    // by interpolating the `d` string) so the label path's left-to-right flip
    // happens continuously at the crossing instead of jumping the sweep flag.
    //   new  — current frame
    //   fly  — prev frame (enter start: d.prevSource/prevTarget honoured)
    //   exit — new frame target for endpoints (exit end: d.nextSource/nextTarget)
    const newS  = (d) => project(d.source);
    const newT  = (d) => project(d.target);
    const flyS  = (d) => projectPrev(d.prevSource ?? d.source) ?? newS(d);
    const flyT  = (d) => projectPrev(d.prevTarget ?? d.target) ?? newT(d);
    const exitS = (d) => project(d.nextSource ?? d.source) ?? newS(d);
    const exitT = (d) => project(d.nextTarget ?? d.target) ?? newT(d);

    // attrTween factory: interpolates the source/target pixels independently
    // (seeding from each node's last stashed pixel so updates flow from the
    // live position, not a recomputed one) and rebuilds `d` from those each
    // frame via `buildPx`. Stashes the live pixels on the node so the next
    // render / an interrupted transition resumes from exactly here.
    const dTween = (buildPx, fromS, fromT, toS, toT, kS, kT) =>
      function (d) {
        const node = this;
        const iS = d3.interpolate(node[kS] ?? fromS(d), toS(d));
        const iT = d3.interpolate(node[kT] ?? fromT(d), toT(d));
        return (t) => {
          const a = (node[kS] = iS(t));
          const b = (node[kT] = iT(t));
          return buildPx(a, b, curvature);
        };
      };
    // Direct (duration 0) apply: set `d` + stash live pixels, no transition.
    const dStatic = (sel2, buildPx, sGet, tGet, kS, kT) =>
      sel2.attr("d", function (d) {
        const a = (this[kS] = sGet(d));
        const b = (this[kT] = tGet(d));
        return buildPx(a, b, curvature);
      });

    const sel = g
      .selectAll("path.arc")
      .data(data, (d) => d._id ?? d.id)
      .join(
        (enter) => {
          const e = enter
            .append("path")
            .attr("class", "arc")
            .attr("fill", "none")
            .attr("stroke", resolveColor)
            .attr("stroke-width", resolveSw)
            .attr("stroke-dasharray", resolveDa)
            .attr("stroke-linecap", "round")
            .attr("opacity", 0);
          // Seed from prev-frame endpoint positions, then grow to current.
          dStatic(e, arcPathPx, flyS, flyT, "__arcS", "__arcT");
          if (duration > 0) {
            e.transition().duration(duration)
              .attrTween("d", dTween(arcPathPx, flyS, flyT, newS, newT, "__arcS", "__arcT"))
              .attr("opacity", resolveOpacity);
          } else {
            dStatic(e, arcPathPx, newS, newT, "__arcS", "__arcT").attr("opacity", resolveOpacity);
          }
          return e;
        },
        (update) => {
          if (duration > 0) {
            update.transition().duration(duration)
              .attrTween("d", dTween(arcPathPx, newS, newT, newS, newT, "__arcS", "__arcT"))
              .attr("stroke", resolveColor)
              .attr("stroke-width", resolveSw)
              .attr("stroke-dasharray", resolveDa)
              .attr("opacity", resolveOpacity);
          } else {
            dStatic(update, arcPathPx, newS, newT, "__arcS", "__arcT")
              .attr("stroke", resolveColor)
              .attr("stroke-width", resolveSw)
              .attr("stroke-dasharray", resolveDa)
              .attr("opacity", resolveOpacity);
          }
          return update;
        },
        (exit) =>
          duration > 0
            ? exit.transition().duration(duration)
                .attrTween("d", dTween(arcPathPx, newS, newT, exitS, exitT, "__arcS", "__arcT"))
                .attr("opacity", 0)
                .remove()
            : exit.remove(),
      );

    // ── Labels ───────────────────────────────────────────────────────────────
    // Each labeled arc gets a hidden <path> in SVG <defs> that mirrors its
    // geometry and transitions identically. A <textPath href="#..."> in the
    // layer's <g> references it so every glyph bends and rotates along the
    // curve — exactly like LineLabelLayer does for line series.
    const labeled  = data.filter((d) => d.label != null);
    const lpClass  = `arc-lp-${layerId}`;
    const lpId     = (d) => `${layerId}-lp-${d._id ?? d.id}`;

    let defs = d3.select(payload.svgEl).select("defs");
    if (defs.empty()) defs = d3.select(payload.svgEl).insert("defs", ":first-child");

    // Defs paths — driven by the SAME interpolated endpoint pixels as the
    // visible arcs (dTween / labelArcPathPx) so the label curve stays glued to
    // its arc AND its left-to-right flip happens continuously, never as a
    // sweep-flag jump that makes the <textPath> text stutter on data change.
    defs.selectAll(`path.${lpClass}`)
      .data(labeled, (d) => d._id ?? d.id)
      .join(
        (enter) => {
          const e = enter.append("path")
            .attr("class", lpClass)
            .attr("id", lpId)
            .attr("fill", "none");
          dStatic(e, labelArcPathPx, flyS, flyT, "__lblS", "__lblT");
          if (duration > 0) {
            e.transition().duration(duration)
              .attrTween("d", dTween(labelArcPathPx, flyS, flyT, newS, newT, "__lblS", "__lblT"));
          } else {
            dStatic(e, labelArcPathPx, newS, newT, "__lblS", "__lblT");
          }
          return e;
        },
        (update) => {
          if (duration > 0) {
            update.transition().duration(duration)
              .attrTween("d", dTween(labelArcPathPx, newS, newT, newS, newT, "__lblS", "__lblT"));
          } else {
            dStatic(update, labelArcPathPx, newS, newT, "__lblS", "__lblT");
          }
          return update;
        },
        (exit) =>
          duration > 0
            ? exit.transition().duration(duration)
                .attrTween("d", dTween(labelArcPathPx, newS, newT, exitS, exitT, "__lblS", "__lblT"))
                .remove()
            : exit.remove(),
      );

    // Text labels — opacity only; position follows the defs path automatically.
    g.selectAll("text.arc-label")
      .data(labeled, (d) => d._id ?? d.id)
      .join(
        (enter) => {
          const t = enter.append("text")
            .attr("class", "arc-label")
            .attr("dy", (d) => d.labelDy ?? labelDy)
            .attr("font-size", (d) => d.labelFontSize ?? labelFontSize)
            .attr("fill", (d) => d.labelColor ?? labelColor ?? resolveColor(d))
            .style("paint-order", "stroke")
            .style("stroke-linejoin", "round")
            .style("stroke", (d) => d.labelBgColor ?? labelBgColor)
            .style("stroke-width", (d) => `${d.labelBgWidth ?? labelBgWidth}px`)
            .style("pointer-events", "none")
            .attr("opacity", 0);
          t.append("textPath")
            .attr("href",       (d) => `#${lpId(d)}`)
            .attr("xlink:href", (d) => `#${lpId(d)}`)
            .attr("startOffset", "50%")
            .attr("text-anchor", "middle")
            .text((d) => d.label);
          t.call((e) => e.transition().duration(duration).attr("opacity", resolveOpacity));
          return t;
        },
        (update) => {
          update
            .attr("dy", (d) => d.labelDy ?? labelDy)
            .attr("font-size", (d) => d.labelFontSize ?? labelFontSize)
            .attr("fill", (d) => d.labelColor ?? labelColor ?? resolveColor(d))
            .style("stroke", (d) => d.labelBgColor ?? labelBgColor)
            .call((u) => u.transition().duration(duration).attr("opacity", resolveOpacity));
          update.select("textPath").text((d) => d.label);
          return update;
        },
        (exit) =>
          exit.call((e) =>
            e.transition().duration(duration).attr("opacity", 0).remove(),
          ),
      );

    if (animate) startAnim();
    else stopAnim();

    sel
      .on(
        "mouseover",
        onHover
          ? function (event, d) {
              sel.attr("opacity", (s) => s === d ? 1 : 0.3);
              onHover({ target: event.currentTarget, data: d });
            }
          : null,
      )
      .on(
        "mouseout",
        onHover
          ? function () {
              sel.attr("opacity", (d) => lastResolvers?.resolveOpacity(d) ?? 1);
              onHover(null);
            }
          : null,
      )
      .on("click", onClick ? (_, d) => onClick(d) : null);
  }

  function rerender(props, durationOverride) {
    if (!base.group || !lastPayload) return;
    render(lastPayload, props, durationOverride);
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    lastK = transform.k;
    base.onZoom(transform);
    const scaleZoom = !!lastPayload?.xScale;
    if (scaleZoom) {
      // Scale canvas: zoom is baked into payload.xScale/yScale. Clear the
      // group transform so it doesn't double-apply and re-render the arcs at
      // their new pixel positions via a duration-0 redraw (same as ScatterLayer).
      base.group?.attr("transform", null);
      if (lastPayload && lastProps) render(lastPayload, lastProps, 0);
    } else if (lastProps?.fixedSize && base.group) {
      // Geo canvas: group transform IS the zoom (base.onZoom stamped it).
      // Only need to inverse-scale stroke-width so it stays constant on screen.
      base.group.selectAll("path.arc").attr("stroke-width", (d) => lastResolvers?.resolveSw(d));
    }
  }

  function destroy() {
    stopAnim();
    if (lastPayload?.svgEl) {
      d3.select(lastPayload.svgEl).selectAll(`path.arc-lp-${layerId}`).remove();
    }
    base.destroy();
    lastProps   = null;
    lastPayload = null;
  }

  return { render, rerender, onZoom, setOrder: (order) => base.setOrder(order), destroy };
}
