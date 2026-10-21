/**
 * LineLabelLayer — renders labels that follow the curve of a sibling
 * LineLayer's series paths.
 *
 * Uses SVG `<textPath href="#…">` to bend each label along the referenced
 * path; each glyph is automatically rotated to follow the local tangent.
 *
 * The layer's `<g>` must be translated by the same margin + padding as
 * LineLayer.contentG so that the glyphs end up at the same screen coords
 * as the path geometry they reference.
 *
 * Labels can be positioned in two ways:
 *   1. `startOffset` (string or number) — a percentage / length along the
 *      rail, stable across data swaps (the rail's length stays ~innerWidth).
 *   2. `atId` (data point id, e.g. "y-1994") — the label is anchored to a
 *      concrete data point.  When the dataset swaps and the id still exists
 *      in the new data, the label glides to its new position on the wave.
 */
import { createLayer } from "./layer.js";
import { GLOBAL_DEFAULTS } from "../defaults.js";
import { innerDimensions } from "./_seriesCommon.js";
import { forceRelax } from "../utils/layout/forceRelax.js";

const ZERO_BOX = { top: 0, right: 0, bottom: 0, left: 0 };

export const LINE_LABEL_LAYER_DEFAULTS = {
  labels:       [],                   // Array<LabelDatum>
  margin:       { top: 0, right: 0, bottom: 20, left: 0 },
  padding:      { top: 0, right: 0, bottom: 0, left: 0 },
  fontSize:     12,
  fontFamily:   null,
  fill:         null,                 // null → inherit `currentColor`
  bgColor:      "#fff",               // halo / paint-order stroke to keep
  bgWidth:      3,                    //   the label legible over the line
  dy:           -4,                   // vertical lift off the path
  // "start" | "middle" | "end" — glyph alignment relative to the startOffset
  // point. "start" runs the text rightward from the point; "middle" centers it.
  textAnchor:   "start",
  // Anchor mode. null → textPath (glyphs ride the curve). "lineEnd" → plain
  // horizontal labels at the END edge of the plot (right for LTR, left for RTL),
  // aligned to each series' last point and force-relaxed so they don't overlap.
  anchor:       null,
  // "ltr" → end edge is the right; "rtl" → end edge is the left. Only used by
  // anchor="lineEnd".
  direction:    "ltr",
  // anchor="lineEnd" tuning:
  gap:             8,                  // px from the plot edge to the label
  relaxRadius:     null,               // collision band height; null → fontSize + 4
  relaxIterations: 120,                // force-relax simulation ticks
  // Per-label overrides (LabelDatum):
  //   { key, text, startOffset?, atId?, dy?, fontSize?, fill?, bgColor?,
  //     bgWidth?, textAnchor? }
  duration:     GLOBAL_DEFAULTS.duration,
  ease:         GLOBAL_DEFAULTS.ease,
  getPathId:           null,          // (key) => "#path-id"            — from host LineLayer
  computeAnchorOffset: null,          // (key, dataId) => length offset — from host LineLayer
  getSeriesEndPoint:   null,          // (key) => {x,y} screen pt        — from host LineLayer
};

function valueOrFallback(perDatum, propVal, fallback) {
  if (perDatum !== undefined && perDatum !== null) return perDatum;
  if (propVal   !== undefined && propVal   !== null) return propVal;
  return fallback;
}

export function createLineLabelLayer() {
  const base = createLayer({ className: "line-label-layer", prefer: "inner" });

  let contentG    = null;
  let lastProps   = null;
  let lastPayload = null;

  function initGroups(payload, layerContainer) {
    const outerG = base.ensureGroup(payload, layerContainer);
    if (contentG) return;
    contentG = outerG.append("g");
  }

  function render(payload, props) {
    if (!payload?.svgEl) return;
    lastProps   = props;
    lastPayload = payload;

    initGroups(payload, props.layerContainer?.value ?? props.layerContainer ?? null);
    base.group?.attr("transform", null);

    // Match the sibling LineLayer's contentG translate.  Universal pattern:
    //   chart_margin + chart_padding - canvas_margin
    // Falls back to canvas margin when no chart-level margin is supplied
    // (slotted into a ScatterPlot-style canvas that owns the margin).
    const cm = payload.margin ?? ZERO_BOX;
    const m  = props.margin  ?? cm;
    const p  = props.padding ?? payload.padding ?? ZERO_BOX;
    const dx = m.left + p.left - cm.left;
    const dy = m.top  + p.top  - cm.top;
    contentG.attr("transform", (dx || dy) ? `translate(${dx}, ${dy})` : null);

    // Anchor fork: "lineEnd" is a fundamentally different render (plain
    // horizontal force-relaxed labels vs curve-riding textPaths).
    if (props.anchor === "lineEnd") {
      renderEndLabels(payload, props);
      return;
    }
    renderTextPath(payload, props);
  }

  function renderTextPath(payload, props) {
    const labels              = props.labels ?? [];
    const getPathId           = props.getPathId;
    const computeAnchorOffset = props.computeAnchorOffset;
    if (!getPathId) {
      // No host LineLayer in scope → nothing to label.  Render an empty join.
      contentG.selectAll("text.line-label").data([]).exit().remove();
      return;
    }

    // Resolve each label's target startOffset.
    //   - `atId` (data id) → numeric length offset on the rail; if the id
    //     no longer exists in the data the anchor returns null and we hide
    //     the label.
    //   - else → user-provided startOffset (string or number) or 0.
    const resolveOffset = (d) => {
      if (d.atId != null && computeAnchorOffset) {
        const o = computeAnchorOffset(d.key, d.atId);
        return o == null ? null : o;
      }
      return d.startOffset ?? 0;
    };

    // Filter out anchored labels whose data id has disappeared.
    const visible = labels.filter((d) => {
      if (d.atId != null && computeAnchorOffset) {
        return computeAnchorOffset(d.key, d.atId) != null;
      }
      return true;
    });

    const sel = contentG.selectAll("text.line-label").data(visible, (d) => d.key);

    const enter = sel.enter().append("text")
      .attr("class", "line-label");

    enter.append("textPath");

    const merged = enter.merge(sel);

    merged
      .attr("dy", (d) => valueOrFallback(d.dy, props.dy, -4))
      .style("font-size", (d) => `${valueOrFallback(d.fontSize, props.fontSize, 12)}px`)
      .style("font-family", (d) => valueOrFallback(d.fontFamily, props.fontFamily, "inherit"))
      .style("fill", (d) => valueOrFallback(d.fill, props.fill, "currentColor"))
      // Paint-order trick: stroke under fill draws a halo behind the glyphs
      // so the label stays readable when it sits on top of the line.
      .style("paint-order", "stroke")
      .style("stroke", (d) => valueOrFallback(d.bgColor, props.bgColor, "#fff"))
      .style("stroke-width", (d) => valueOrFallback(d.bgWidth, props.bgWidth, 3))
      .style("stroke-linejoin", "round")
      .style("pointer-events", "none");

    // href + text + anchor are stable; set once per render. `text-anchor`
    // controls where the glyphs sit relative to `startOffset`: "start" (default)
    // runs the text rightward FROM the point, "middle" CENTERS it on the point,
    // "end" runs it up TO the point.
    merged.select("textPath")
      .attr("href",        (d) => `#${getPathId(d.key)}`)
      .attr("xlink:href",  (d) => `#${getPathId(d.key)}`)   // legacy Safari fallback
      .attr("text-anchor", (d) => valueOrFallback(d.textAnchor, props.textAnchor, "start"))
      .text((d) => d.text);

    // startOffset: set immediately on enter (no animation from 0 →), and
    // transition on update so anchored labels glide between data swaps in
    // lockstep with the rail's path morph.
    enter.select("textPath").attr("startOffset", (d) => resolveOffset(d));

    // duration: prop wins; otherwise pick up the canvas's duration so we
    // animate in lockstep with the host chart by default.
    const dur = props.duration ?? payload.duration ?? 0;
    const updateTp = sel.select("textPath");
    if (dur > 0) {
      updateTp.transition().duration(dur).attr("startOffset", (d) => resolveOffset(d));
    } else {
      updateTp.attr("startOffset", (d) => resolveOffset(d));
    }

    sel.exit().remove();
  }

  // ── anchor="lineEnd" ────────────────────────────────────────────────────────
  // Plain horizontal labels parked at the END edge of the plot, one per series,
  // at the vertical position of that series' last point — then force-relaxed so
  // overlapping labels nudge apart while preserving order. Mirrors the classic
  // end-of-line label (https://observablehq.com/@naitian/force-relax).

  // Shared by render + onZoom: resolve the constant end-edge x, the glyph
  // anchor, and the relaxed y for every visible label. Returns null when there
  // is no host LineLayer (no getSeriesEndPoint) to read end points from.
  function computeEndPlacement(payload, props) {
    const getEnd = props.getSeriesEndPoint;
    if (!getEnd) return null;

    const m = props.margin  ?? payload.margin ?? ZERO_BOX;
    const p = props.padding ?? payload.padding ?? ZERO_BOX;
    const innerWidth = payload.width - m.left - m.right - p.left - p.right;
    const rtl  = props.direction === "rtl";
    const gap  = props.gap ?? 8;
    // contentG origin sits at the plot's top-left, so x=0 is the left edge and
    // x=innerWidth the right edge. End = right (+gap) for LTR, left (−gap) for RTL.
    const endX     = rtl ? -gap : innerWidth + gap;
    const tAnchor  = rtl ? "end" : "start";

    // Seed each label at its series' last-point y; drop series with no end point.
    const seeds = [];
    for (const l of (props.labels ?? [])) {
      const ep = getEnd(l.key);
      if (!ep || ep.y == null || !isFinite(ep.y)) continue;
      seeds.push({ ...l, y: ep.y });
    }
    const radius = props.relaxRadius ?? ((props.fontSize ?? 12) + 4);
    const placed = forceRelax()
      .value((d) => d.y)
      .radius(radius)
      .iterations(props.relaxIterations ?? 120)(seeds);
    return { endX, tAnchor, placed };
  }

  function renderEndLabels(payload, props) {
    // Drop any textPath-mode glyphs if the anchor flipped at runtime.
    contentG.selectAll("text.line-label").remove();

    const placement = computeEndPlacement(payload, props);
    if (!placement) {
      contentG.selectAll("text.line-end-label").data([]).exit().remove();
      return;
    }
    const { endX, tAnchor, placed } = placement;
    const dur = props.duration ?? payload.duration ?? 0;

    const sel = contentG.selectAll("text.line-end-label").data(placed, (d) => d.key);

    // Enter at the relaxed position (no slide from 0), fade in.
    const enter = sel.enter().append("text")
      .attr("class", "line-end-label")
      .attr("opacity", 0)
      .attr("transform", (d) => `translate(${endX}, ${d.relaxed})`);

    const merged = enter.merge(sel);
    merged
      .attr("text-anchor", tAnchor)
      .attr("dominant-baseline", "central")
      .style("font-size",   (d) => `${valueOrFallback(d.fontSize, props.fontSize, 12)}px`)
      .style("font-family", (d) => valueOrFallback(d.fontFamily, props.fontFamily, "inherit"))
      .style("fill",        (d) => valueOrFallback(d.fill, props.fill, "currentColor"))
      // Same halo trick as textPath mode: stroke under fill keeps the glyphs
      // legible against gridlines / overlapping content.
      .style("paint-order", "stroke")
      .style("stroke",      (d) => valueOrFallback(d.bgColor, props.bgColor, "#fff"))
      .style("stroke-width",(d) => valueOrFallback(d.bgWidth, props.bgWidth, 3))
      .style("stroke-linejoin", "round")
      .style("pointer-events", "none")
      .text((d) => d.text);

    if (dur > 0) {
      enter.transition().duration(dur).delay(dur / 2).attr("opacity", 1);
      sel.transition().duration(dur)
        .attr("opacity", 1)
        .attr("transform", (d) => `translate(${endX}, ${d.relaxed})`);
    } else {
      enter.attr("opacity", 1);
      sel.attr("opacity", 1).attr("transform", (d) => `translate(${endX}, ${d.relaxed})`);
    }

    sel.exit().transition().duration(dur).attr("opacity", 0).remove();
  }

  function onZoom() {
    // Keep our base group neutral — contentG's (margin + padding) translate
    // is the only thing that should be positioning glyphs.
    base.group?.attr("transform", null);
    if (!contentG || !lastProps) return;

    // anchor="lineEnd": the y of each series' last point moves under (y-)zoom,
    // so re-read the refreshed end points, re-relax, and reposition directly —
    // no transition, zoom is interactive. LineLayer.onZoom already rebuilt
    // railFinalGeom (→ getSeriesEndPoint) before this fires.
    if (lastProps.anchor === "lineEnd") {
      const placement = computeEndPlacement(lastPayload, lastProps);
      if (!placement) return;
      const { endX, placed } = placement;
      const byKey = new Map(placed.map((d) => [d.key, d.relaxed]));
      contentG.selectAll("text.line-end-label")
        .attr("transform", (d) => {
          const ry = byKey.has(d.key) ? byKey.get(d.key) : (d.relaxed ?? 0);
          return `translate(${endX}, ${ry})`;
        });
      return;
    }

    // textPath geometry follows the host path automatically when LineLayer's
    // onZoom rewrites the path's `d` attribute, so labels with a percentage
    // or numeric startOffset keep their literal meaning under zoom.
    //
    // `atId` labels are different: their offset is COMPUTED from a data
    // point's screen-x against the rail's current geometry.  LineLayer.onZoom
    // refreshes that geometry (via drawLabelRails → railFinalGeom), so we
    // just re-query computeAnchorOffset for each atId label and push the new
    // value onto its textPath — no animation, zoom is interactive.
    const cao = lastProps.computeAnchorOffset;
    if (!cao) return;
    contentG.selectAll("text.line-label")
      .filter((d) => d?.atId != null)
      .select("textPath")
      .attr("startOffset", (d) => {
        const o = cao(d.key, d.atId);
        return o == null ? 0 : o;
      });
  }

  function destroy() {
    base.destroy();
    contentG = null;
    lastProps = lastPayload = null;
  }

  return {
    render,
    rerender(props) { if (lastPayload) render(lastPayload, props); },
    onZoom,
    setOrder: (o) => base.setOrder(o),
    destroy,
  };
}
