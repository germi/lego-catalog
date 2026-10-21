import * as d3 from "d3";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { createLayer } from "./layer.js";
import { buildScale } from "../utils/scale/buildScale.js";
import {
  voronoiContentGroup,
  voronoiGestureTransform,
  recomputeStatic,
} from "./voronoiLayout.js";

gsap.registerPlugin(Flip);

// During a live (manual) zoom the position is rendered instantly each frame so
// labels follow the cursor — but the OPACITY fade (labels appearing/leaving via
// minCellArea or the viewport) and the anchor FLIP should still animate. This is
// the duration used for those effects when the position duration is 0.
const MANUAL_FX_DURATION = 260;

// Leader-tick geometry. The tick is a line from the dot CENTRE (0,0) outward to
// its endpoint; stroke-dasharray hides the segment inside the dot. The endpoint
// angle/length are read straight off x2/y2, so it works for both the quantized
// orient direction and an arbitrary centroid offset.
const DEG = Math.PI / 180;
// Unit direction per orient (SVG y-down): which side of the anchor the label sits.
const ORIENT_DIR = {
  right: [1, 0],
  left: [-1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

export const VORONOI_LABEL_LAYER_DEFAULTS = {
  text: null,
  fontSize: 11,
  fontFamily: "sans-serif",
  fontWeight: "normal",
  textColor: "#000000",
  // Optional legibility halo around the glyphs. `textStroke: null` = off. When a
  // colour is set (e.g. "white"), it's painted UNDER the fill (paint-order:stroke).
  textStroke: null,
  textStrokeWidth: 3,
  opacity: 1,
  opacityAccessor: null,
  bgColor: "transparent",
  bgOpacity: 0.85,
  bgStroke: null,
  bgStrokeWidth: 1,
  padding: [3, 7],
  cornerRadius: 4,
  // markerRadius / separation: fallback offsets when no radius scale is wired.
  markerRadius: 4,
  separation: 6,
  fixedSize: true,
  // Radius-scale props — mirror ScatterLayer so the label offset matches dots.
  // When supplied, the resolved dot radius replaces markerRadius.
  radius: null, // null | number | Function(value→px)
  rScaleType: "sqrt",
  dotSize: [2, 12],
  valueAccessor: (d) => d.value,
  // When this layer operates on a subset of the full dataset (e.g. top-10
  // countries), supply the full dataset here so the radius scale domain
  // matches the main ScatterLayer exactly.  Defaults to the voronoi layer's
  // own projected data when not set.
  radiusData: null,
  // Per-datum background colour — (d) => cssColor.  Takes precedence over
  // the static bgColor when set.
  bgColorAccessor: null,
  // --- Decluttering (all opt-in; defaults keep every label visible) ---
  // Hide a label when its voronoi cell area (px²) is below this. 0 = disabled.
  // In recompute-zoom mode the area is on-screen px², so labels progressively
  // reveal as you zoom in (cells grow). In literal mode it's a static gate.
  minCellArea: 0,
  // Greedy bounding-box overlap suppression: keep the most-isolated labels
  // (largest cell first), drop any whose estimated box overlaps an accepted one.
  suppressOverlap: false,
  // Per-datum override — (d) => "show" | "hide" | null. A per-datum field
  // `d.forceLabel` wins over this accessor. "show" bypasses every gate (and
  // reserves space); "hide" is absolute; null/undefined → normal algorithm.
  forceLabel: null,
  // Leader line connecting the dot to its label across the `separation` gap.
  // Off by default. e.g. for a left-oriented label the line runs from the
  // label's right edge to the dot's left edge.
  connector: false,
  connectorColor: null, // null → falls back to textColor
  connectorWidth: 1,
  // Opt-in: anchor the label to the cell CENTROID (the open space) instead of the
  // dot. The label sits at `centroid + centroidGap` and the connector runs from the
  // dot to the centroid. The dot radius then only hides the tick's in-dot start,
  // not the label position.
  centroidAnchor: false,
  // Gap from the centroid to the label in centroid mode (px). null → use
  // `separation`. Lower it (or go negative) to pull labels toward the centroid.
  centroidGap: null,
};

export function createVoronoiLabelLayer() {
  const base = createLayer({ className: "voronoi-label-layer" });
  let lastProps = null;
  let lastPayload = null;
  let lastK = 1;
  let lastVoronoiState = null;

  function parseCfg(props) {
    const rawPadding = props.padding ?? VORONOI_LABEL_LAYER_DEFAULTS.padding;
    const [paddingY, paddingX] = Array.isArray(rawPadding)
      ? rawPadding
      : [rawPadding, rawPadding * 2];
    const textRaw = props.text ?? null;
    const textFn =
      typeof textRaw === "function"
        ? textRaw
        : textRaw
          ? () => textRaw
          : (d) => d.label ?? d.id ?? "";
    const D = VORONOI_LABEL_LAYER_DEFAULTS;
    return {
      text: textFn,
      fontSize: props.fontSize ?? D.fontSize,
      fontFamily: props.fontFamily ?? D.fontFamily,
      fontWeight: props.fontWeight ?? D.fontWeight,
      textColor: props.textColor ?? D.textColor,
      textStroke: props.textStroke ?? D.textStroke,
      textStrokeWidth: props.textStrokeWidth ?? D.textStrokeWidth,
      opacity: props.opacity ?? D.opacity,
      opacityAccessor: props.opacityAccessor ?? D.opacityAccessor,
      bgColor: props.bgColor ?? D.bgColor,
      bgOpacity: props.bgOpacity ?? D.bgOpacity,
      bgStroke: props.bgStroke ?? D.bgStroke,
      bgStrokeWidth: props.bgStrokeWidth ?? D.bgStrokeWidth,
      cornerRadius: props.cornerRadius ?? D.cornerRadius,
      markerRadius: props.markerRadius ?? D.markerRadius,
      separation: props.separation ?? D.separation,
      fixedSize: props.fixedSize ?? D.fixedSize,
      // Radius scale props
      radius: props.radius ?? D.radius,
      rScaleType: props.rScaleType ?? D.rScaleType,
      dotSize: props.dotSize ?? D.dotSize,
      valueAccessor: props.valueAccessor ?? D.valueAccessor,
      radiusData: props.radiusData ?? D.radiusData,
      bgColorAccessor: props.bgColorAccessor ?? D.bgColorAccessor,
      minCellArea: props.minCellArea ?? D.minCellArea,
      suppressOverlap: props.suppressOverlap ?? D.suppressOverlap,
      forceLabel: props.forceLabel ?? D.forceLabel,
      connector: props.connector ?? D.connector,
      connectorColor: props.connectorColor ?? D.connectorColor,
      connectorWidth: props.connectorWidth ?? D.connectorWidth,
      centroidAnchor: props.centroidAnchor ?? D.centroidAnchor,
      centroidGap: props.centroidGap ?? D.centroidGap,
      paddingX,
      paddingY,
    };
  }

  // Build the same radius scale as ScatterLayer so label offsets match dot sizes.
  function buildRScale(cfg, data) {
    if (!data?.length) return null;
    if (cfg.radius != null) return null; // fixed radius — no scale needed
    const va = cfg.valueAccessor;
    if (!va) return null;
    const domain = d3.extent(data, va);
    if (domain[0] == null || domain[0] === domain[1]) return null;
    return buildScale({ type: cfg.rScaleType, domain, range: cfg.dotSize });
  }

  // Resolve the pixel radius for a single datum — mirrors scatterLayer.resolveR.
  function resolveR(d, cfg, rScale) {
    if (d.radius != null) return d.radius;
    if (typeof cfg.radius === "function")
      return cfg.radius(cfg.valueAccessor(d));
    if (rScale) return rScale(cfg.valueAccessor(d));
    if (typeof cfg.radius === "number") return cfg.radius;
    return cfg.markerRadius;
  }

  // Anchor is PHYSICAL: the label must extend AWAY from the dot toward the open
  // space (orient), regardless of language. SVG resolves start/end relative to
  // the element's `direction`, so under rtl we counter-flip to keep the physical
  // side fixed. (The text's own `direction` is set to rtl separately in
  // stampInner so Arabic glyphs still render right-to-left.) This is the inverse
  // of RefLineLayer, whose anchor is LOGICAL — there we let direction do the flip.
  function textAnchor(orient, isRtl) {
    if (orient === "right") return isRtl ? "end" : "start";
    if (orient === "left") return isRtl ? "start" : "end";
    return "middle";
  }

  function textDy(orient) {
    if (orient === "top") return "0em";
    if (orient === "bottom") return "0.71em";
    return "0.35em";
  }

  // Stamp text/rect/inner-transform for a single label.
  // `dotRadius` is the resolved pixel radius of the scatter dot for this datum;
  // it replaces the static `markerRadius` so the label starts right outside the dot.
  function stampInner(node, cell, cfg, kForFixed, dotRadius, connDur = 0) {
    const {
      text,
      fontSize,
      fontFamily,
      fontWeight,
      textColor,
      textStroke,
      textStrokeWidth,
      bgColor,
      bgOpacity,
      bgStroke,
      bgStrokeWidth,
      cornerRadius,
      separation,
      fixedSize,
      paddingX,
      paddingY,
      bgColorAccessor,
      rtl,
      connector,
      connectorColor,
      connectorWidth,
      centroidAnchor,
      centroidGap,
    } = cfg;

    // Per-datum colour override — accessor wins over the static bgColor prop.
    const resolvedBg = bgColorAccessor
      ? bgColorAccessor(cell.data) ?? bgColor
      : bgColor;

    // How far the label block sits from the dot edge.
    const r = dotRadius ?? cfg.markerRadius;

    const outer = d3.select(node);
    const inner = outer.select("g.vlabel-inner");

    const textEl = inner
      .select("text.vlabel-text")
      .attr("font-size", `${fontSize}px`)
      .attr("font-family", fontFamily)
      .attr("font-weight", fontWeight)
      .attr("fill", textColor)
      // Optional legibility halo: paint the stroke UNDER the fill (paint-order:
      // stroke) so it haloes the glyphs instead of eating into them; round joins
      // keep it clean. `textStroke: null` (default) = no stroke.
      .attr("stroke", textStroke ?? "none")
      .attr("stroke-width", textStroke ? textStrokeWidth : null)
      .attr("stroke-linejoin", textStroke ? "round" : null)
      .attr("paint-order", textStroke ? "stroke" : null)
      .attr("text-anchor", textAnchor(cell.orient, rtl))
      // Set the label's own writing direction so the physical anchor above
      // resolves predictably AND rtl (e.g. Arabic) text renders correctly,
      // independent of the host page's inherited `dir`.
      .style("direction", rtl ? "rtl" : "ltr")
      .attr("dy", textDy(cell.orient))
      .text(text(cell.data));

    const bb = textEl.node().getBBox();
    const rw = bb.width + paddingX * 2;
    const rh = bb.height + paddingY * 2;

    inner
      .select("rect.vlabel-bg")
      .attr("x", bb.x - paddingX)
      .attr("y", bb.y - paddingY)
      .attr("width", rw)
      .attr("height", rh)
      .attr("fill", resolvedBg)
      .attr("fill-opacity", bgOpacity)
      .attr("rx", cornerRadius)
      .attr("ry", cornerRadius)
      .attr("stroke", bgStroke ?? null)
      .attr("stroke-width", bgStroke ? bgStrokeWidth : null);

    // ANCHOR: the point the label attaches to and the tick reaches.
    //   • dot mode — the dot EDGE in the orient direction (r · dir); the tick then
    //     runs to `r + separation` (the label's near edge).
    //   • centroid mode — the cell CENTROID (open space); the tick runs to the
    //     centroid, and the label sits `separation` beyond it. The dot radius no
    //     longer affects the label position, only the tick's hidden in-dot start.
    const dir = ORIENT_DIR[cell.orient] ?? ORIENT_DIR.right;
    // Only use the centroid when there's a REAL cell. A cell-less point (off the
    // hull / degenerate) has centroid = chart centre (voronoiCompute fallback), so
    // pointing at it would make every such tick converge on the middle — fall back
    // to the normal orient placement instead.
    const useCentroid = centroidAnchor && cell.polygon != null;
    const cX = (cell.centroid?.[0] ?? cell.data._x) - cell.data._x;
    const cY = (cell.centroid?.[1] ?? cell.data._y) - cell.data._y;
    const ax = useCentroid ? cX : r * dir[0];
    const ay = useCentroid ? cY : r * dir[1];
    // Tick endpoint: the centroid itself (centroid mode) or the label near edge (dot mode).
    const ex = useCentroid ? cX : (r + separation) * dir[0];
    const ey = useCentroid ? cY : (r + separation) * dir[1];

    // Label block offset = anchor + gap along orient + rect padding. In centroid
    // mode the gap is `centroidGap` (falls back to separation) so the label's
    // distance from the centroid is tunable independently of the dot-mode gap.
    const gap = useCentroid ? centroidGap ?? separation : separation;
    let ox = 0;
    let oy = 0;
    switch (cell.orient) {
      case "right":
        ox = ax + gap + paddingX;
        oy = ay;
        break;
      case "left":
        ox = ax - gap - paddingX;
        oy = ay;
        break;
      case "top":
        ox = ax;
        oy = ay - gap - (bb.y + bb.height) - paddingY;
        break;
      case "bottom":
        ox = ax;
        oy = ay + gap + paddingY - bb.y;
        break;
      default:
        ox = ax + gap + paddingX;
        oy = ay;
    }

    // Placement = the block's offset + orient. Skip re-writing the transform when
    // the placement is UNCHANGED *and* a GSAP flip is mid-animation on this block.
    // That is exactly the redundant-render case: a style-only rerender fired
    // because an INLINE function prop (`:text="(d)=>d.label"`, `:opacity-accessor`,
    // …) is a new reference on every parent render, so the layer's style watcher
    // re-runs one frame after the draw. Without this guard it would reset the
    // transform to the FINAL offset and abort the flip — the block snaps to its
    // final spot and then rides the dot in (very visible for centroid labels,
    // where the offset is large). Stable accessors avoid the redundant render
    // entirely; this makes the layer correct even without them.
    const innerEl = inner.node();
    const placementUnchanged =
      !!innerEl &&
      (+innerEl.getAttribute("data-ox") || 0) === ox &&
      (+innerEl.getAttribute("data-oy") || 0) === oy &&
      innerEl.getAttribute("data-orient") === cell.orient;
    if (!(placementUnchanged && gsap.getTweensOf(innerEl).length)) {
      inner
        .attr("data-ox", ox)
        .attr("data-oy", oy)
        .attr("data-orient", cell.orient);
      if (fixedSize) {
        inner.attr(
          "transform",
          `scale(${1 / kForFixed}) translate(${ox}, ${oy})`,
        );
      } else {
        inner.attr("transform", `translate(${ox}, ${oy})`);
      }
    }

    // Leader tick — anchored at the dot CENTRE (0,0), running to its endpoint
    // (ex,ey): the label near-edge (dot mode) or the cell centroid (centroid mode).
    // stroke-dasharray hides the first `r` px (inside the dot), so only the
    // [r, |E|] segment shows. On a change we transition the endpoint + dash:
    //   • dot mode — a reorient ROTATES the tick around the dot centre, so the
    //     endpoint tweens along the ARC (short way) + its length.
    //   • centroid mode — the endpoint tracks the (moving) centroid, so a plain
    //     linear transition of x2/y2 reads correctly (no rotation).
    // Lives in the OUTER (dot-centred) group, so it rides position transitions and
    // is counter-scaled by 1/k under fixedSize, exactly like the inner block.
    const connLine = outer.select("line.vlabel-connector");
    if (!connLine.empty()) {
      const em = Math.hypot(ex, ey); // endpoint distance
      const ea = Math.atan2(ey, ex) / DEG; // endpoint angle (deg)
      const dash = `0 ${(+r).toFixed(2)} ${Math.max(0, em - r).toFixed(2)}`;
      const node = connLine.node();

      connLine
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("stroke", connector ? connectorColor ?? textColor : "none")
        .attr("stroke-width", connectorWidth)
        .attr("stroke-linecap", "butt") // no round-cap dot from the leading 0-dash
        .attr("transform", fixedSize ? `scale(${1 / kForFixed})` : null)
        .attr("display", connector ? null : "none");

      if (connDur > 0 && node.hasAttribute("x2")) {
        if (useCentroid) {
          // Centroid mode: the endpoint tracks the (moving) centroid, so a plain
          // linear transition of the endpoint reads correctly — the line's ends
          // slide from (0,0)→old-centroid to (0,0)→new-centroid. No arc/rotation.
          connLine
            .transition("vlabel-conn")
            .duration(connDur)
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", ex.toFixed(3))
            .attr("y2", ey.toFixed(3))
            .attr("stroke-dasharray", dash);
        } else {
          // Dot mode: a reorient ROTATES the tick around the dot centre — tween
          // the endpoint along the ARC (short way) AND its length, from the
          // current endpoint so an interrupted transition never jumps.
          const cx = +node.getAttribute("x2"),
            cy = +node.getAttribute("y2");
          const cur = Math.atan2(cy, cx) / DEG;
          const mag = Math.hypot(cx, cy) || em;
          let target = ea;
          while (target - cur > 180) target -= 360;
          while (target - cur < -180) target += 360;
          const iA = d3.interpolateNumber(cur, target);
          const iM = d3.interpolateNumber(mag, em);
          connLine
            .transition("vlabel-conn")
            .duration(connDur)
            .attrTween(
              "x2",
              () => (t) => (iM(t) * Math.cos(iA(t) * DEG)).toFixed(3),
            )
            .attrTween(
              "y2",
              () => (t) => (iM(t) * Math.sin(iA(t) * DEG)).toFixed(3),
            )
            .attr("stroke-dasharray", dash);
        }
      } else {
        connLine
          .interrupt("vlabel-conn")
          .attr("x2", ex.toFixed(3))
          .attr("y2", ey.toFixed(3))
          .attr("stroke-dasharray", dash);
      }
    }
  }

  // --- Decluttering ---------------------------------------------------------

  // Prefer the area voronoiCompute now stamps on each cell; fall back to
  // computing it for any externally-built state.
  const cellAreaOf = (cell) =>
    cell.area ?? (cell.polygon ? Math.abs(d3.polygonArea(cell.polygon)) : 0);

  // Estimate a label's background-rect box in the cell's coordinate space.
  // Mirrors stampInner's orient offsets, but estimates text width arithmetically
  // (no per-candidate getBBox) so the overlap pass stays cheap.
  function estimateBox(cell, cfg, rScale) {
    const r = resolveR(cell.data, cfg, rScale);
    const sep = cfg.separation;
    const text = String(cfg.text(cell.data) ?? "");
    const tw = text.length * cfg.fontSize * 0.58;
    const w = tw + cfg.paddingX * 2;
    const h = cfg.fontSize * 1.25 + cfg.paddingY * 2;
    const dx = cell.data._x;
    const dy = cell.data._y;
    switch (cell.orient) {
      case "left":
        return { x: dx - r - sep - w, y: dy - h / 2, w, h };
      case "top":
        return { x: dx - w / 2, y: dy - r - sep - h, w, h };
      case "bottom":
        return { x: dx - w / 2, y: dy + r + sep, w, h };
      default:
        return { x: dx + r + sep, y: dy - h / 2, w, h }; // right
    }
  }

  function boxesOverlap(a, b) {
    return !(
      a.x + a.w < b.x ||
      b.x + b.w < a.x ||
      a.y + a.h < b.y ||
      b.y + b.h < a.y
    );
  }

  // Returns the Set of datum ids to show. Per-datum `forceLabel` ("show"/"hide")
  // wins; then a greedy, cell-area-prioritised pass applies the minCellArea gate
  // and (optionally) bounding-box overlap suppression. With every option off and
  // no forces, this returns all ids (minus opacityAccessor===0), preserving the
  // original "show all" behaviour.
  function computeVisible(cells, cfg, rScale) {
    const forceOf = (d) => d.forceLabel ?? cfg.forceLabel?.(d) ?? null;
    const shown = new Set();
    const occupied = [];

    // 1. Forced-SHOW first — always shown; reserve their box so auto labels avoid them.
    for (const cell of cells) {
      if (forceOf(cell.data) !== "show") continue;
      shown.add(cell.data.id);
      if (cfg.suppressOverlap) occupied.push(estimateBox(cell, cfg, rScale));
    }

    // 2. Auto pass — most-isolated (largest cell) first when suppressing overlap.
    const order = cfg.suppressOverlap
      ? [...cells].sort((a, b) => cellAreaOf(b) - cellAreaOf(a))
      : cells;

    for (const cell of order) {
      const f = forceOf(cell.data);
      if (f === "hide") continue; // explicit hide
      if (shown.has(cell.data.id)) continue; // already forced-shown
      if (cfg.minCellArea > 0 && cellAreaOf(cell) < cfg.minCellArea) continue;
      if (cfg.opacityAccessor && (cfg.opacityAccessor(cell.data) ?? 1) === 0)
        continue;
      if (cfg.suppressOverlap) {
        const box = estimateBox(cell, cfg, rScale);
        if (occupied.some((o) => boxesOverlap(box, o))) continue;
        occupied.push(box);
      }
      shown.add(cell.data.id);
    }
    return shown;
  }

  function renderLayer(g, state, duration) {
    if (!state?.cells?.length) {
      g.selectAll("g.voronoi-label").remove();
      return;
    }

    const { cells, projected } = state;
    const cfg = parseCfg(lastProps ?? {});
    // RTL signal from the host chart's projector (ScatterPlot passes :rtl into
    // makeScaleProjector). Drives the label's writing `direction` + the physical
    // anchor counter-flip in stampInner. An explicit prop can override.
    cfg.rtl = !!(lastProps?.rtl ?? lastPayload?.projector?.rtl);
    const dur = Math.max(0, duration ?? 0);
    // Position duration follows `dur` (0 = live manual zoom → snap to the cursor;
    // >0 = data change / programmatic zoom → glide). The fade + Flip keep a
    // non-zero duration even when the position is instant, so labels appearing /
    // leaving and anchor flips still animate during a manual zoom.
    const posDur = dur;
    const fxDur = dur > 0 ? dur : MANUAL_FX_DURATION;
    // Build radius scale. When `radiusData` is provided (e.g. this layer shows
    // a subset of the full dataset), use it so the domain matches the main
    // ScatterLayer and phantom circle sizes are consistent.
    const rScale = buildRScale(cfg, cfg.radiusData ?? projected);
    // Decide which labels are visible (forceLabel + minCellArea + overlap), then
    // resolve opacity: hidden → 0 (fades through the same opacity transition),
    // otherwise the per-datum / static opacity.
    const shown = computeVisible(cells, cfg, rScale);
    const resolveOpacity = (cell) => {
      if (!shown.has(cell.data.id)) return 0;
      const d = cell.data;
      return cfg.opacityAccessor
        ? cfg.opacityAccessor(d) ?? cfg.opacity
        : cfg.opacity;
    };

    // Prev-frame enter / new-frame exit (mirrors ScatterLayer). The label's
    // on-screen position is `groupTransform · translate(_x, _y)`, so projPrev /
    // projCur must produce positions in the SAME space as the cell's `_x/_y`:
    //   • Recompute mode (`base.staticGroup`): the group is identity and `_x/_y`
    //     already include zoom, so use the canvas's zoom-baked project /
    //     prevProject.
    //   • Literal mode: `_x/_y` are RAW projector output and the group `<g>`
    //     carries the zoom, so use the RAW projector fns (prev frame via
    //     prevProjector.fn). The group transform is applied to both ends equally,
    //     so the label still flies between old- and new-domain positions.
    //   projPrev → where an entering label slides FROM (datum through prev frame);
    //   projCur  → where an exiting label travels TO   (datum through this frame).
    const projPrev = !lastPayload
      ? null
      : base.staticGroup
        ? lastPayload.prevProject
        : lastPayload.prevProjector?.fn ?? null;
    const projCur = !lastPayload
      ? null
      : base.staticGroup
        ? lastPayload.project
        : lastPayload.projector?.fn ?? null;
    // Resolve a `translate(...)` from a projector, falling back to the cell's
    // own `_x/_y` when the projection is unavailable / off-domain.
    const translateFrom = (proj, cell) => {
      const p = proj ? proj(cell.data) : null;
      const x = p ? p[0] : cell.data._x;
      const y = p ? p[1] : cell.data._y;
      return `translate(${x}, ${y})`;
    };

    g.selectAll("g.voronoi-label")
      .data(cells, (cell) => cell.data.id)
      .join(
        (enter) => {
          const outer = enter
            .append("g")
            .attr("class", "voronoi-label")
            .attr("pointer-events", "none")
            .attr("opacity", 0)
            // Start at the previous-scale position on a data change (dur > 0) so
            // the label slides in as the axes rescale; otherwise start in place.
            .attr("transform", (cell) =>
              dur > 0 && projPrev
                ? translateFrom(projPrev, cell)
                : `translate(${cell.data._x}, ${cell.data._y})`,
            );
          // Connector first so it sits UNDER the label block (their edges meet).
          outer
            .append("line")
            .attr("class", "vlabel-connector")
            .attr("pointer-events", "none");
          const inner = outer.append("g").attr("class", "vlabel-inner");
          inner
            .append("rect")
            .attr("class", "vlabel-bg")
            .attr("rx", cfg.cornerRadius)
            .attr("ry", cfg.cornerRadius)
            .attr("fill-opacity", cfg.bgOpacity)
            .attr("stroke", cfg.bgStroke ?? null)
            .attr("stroke-width", cfg.bgStroke ? cfg.bgStrokeWidth : null);
          inner
            .append("text")
            .attr("class", "vlabel-text")
            .attr("pointer-events", "none");
          outer.each(function (cell) {
            stampInner(
              this,
              cell,
              cfg,
              lastK,
              resolveR(cell.data, cfg, rScale),
            );
          });
          // True D3 enters only happen on a data change (dur > 0), never during
          // a live zoom — labels "appearing" mid-zoom are minCellArea/viewport
          // reveals, which animate via the UPDATE opacity below. So keep the
          // original behaviour here (instant when dur=0).
          if (dur > 0) {
            const t = outer
              .transition("vlabel-fade")
              .duration(dur)
              .attr("opacity", resolveOpacity);
            // Slide from the prev-scale start position to the current one.
            if (projPrev) {
              t.attr(
                "transform",
                (cell) => `translate(${cell.data._x}, ${cell.data._y})`,
              );
            }
          } else {
            outer.attr("opacity", resolveOpacity);
          }
          return outer;
        },
        (update) => {
          // Position: glide over posDur, or snap to the cursor when posDur=0
          // (live manual zoom). Interrupt any in-flight glide first so a grab
          // mid-programmatic-zoom immediately tracks the pointer.
          const transformOf = (cell) =>
            `translate(${cell.data._x}, ${cell.data._y})`;
          if (posDur > 0) {
            update
              .transition("vlabel-pos")
              .duration(posDur)
              .attr("transform", transformOf);
          } else {
            update.interrupt("vlabel-pos").attr("transform", transformOf);
          }

          // Opacity: always animate over fxDur, so labels revealed/hidden by
          // minCellArea (or coming into view) fade in/out even during a manual
          // zoom rather than popping.
          if (fxDur > 0) {
            update
              .transition("vlabel-fade")
              .duration(fxDur)
              .attr("opacity", resolveOpacity);
          } else {
            update.attr("opacity", resolveOpacity);
          }

          // Inner block: orient can flip, which swaps text-anchor / dy / rect
          // box and the inner translate.  These are non-animatable as plain
          // attrs, so use GSAP Flip — but ONLY when the orient actually changed,
          // so a continuous zoom doesn't run a Flip per label per frame.
          update.each(function (cell) {
            const innerNode = this.querySelector("g.vlabel-inner");
            const dotRadius = resolveR(cell.data, cfg, rScale);
            if (!innerNode) {
              stampInner(this, cell, cfg, lastK, dotRadius);
              return;
            }
            const orientChanged =
              innerNode.getAttribute("data-orient") !== cell.orient;
            const oldOx = +innerNode.getAttribute("data-ox") || 0;
            const oldOy = +innerNode.getAttribute("data-oy") || 0;
            const flipState =
              fxDur > 0 && orientChanged
                ? Flip.getState(innerNode, { props: "transform" })
                : null;
            // Animate the connector on a real change: a data change / settle
            // (posDur) tweens the tick's rotation + dash; a live-zoom reorient
            // uses fxDur to match the block's Flip. posDur = 0 with no flip → snap
            // (so a live zoom doesn't restart a transition every frame).
            const connDur = posDur > 0 ? posDur : orientChanged ? fxDur : 0;
            stampInner(this, cell, cfg, lastK, dotRadius, connDur);
            if (flipState) {
              Flip.from(flipState, {
                duration: fxDur / 1000,
                ease: "power3.inOut",
                onComplete: () => {
                  const inner = d3.select(innerNode);
                  const ox = +inner.attr("data-ox") || 0;
                  const oy = +inner.attr("data-oy") || 0;
                  if (cfg.fixedSize) {
                    inner.attr(
                      "transform",
                      `scale(${1 / lastK}) translate(${ox}, ${oy})`,
                    );
                  } else {
                    inner.attr("transform", `translate(${ox}, ${oy})`);
                  }
                },
              });
            } else if (posDur > 0) {
              // No reorient, but the inner OFFSET moved (centroid mode: the centroid
              // shifts every data change). stampInner just snapped it to the new
              // offset — slide it over posDur instead, so together with the outer
              // group's vlabel-pos slide the whole label glides to its new spot.
              const inner = d3.select(innerNode);
              const newOx = +inner.attr("data-ox") || 0;
              const newOy = +inner.attr("data-oy") || 0;
              if (newOx !== oldOx || newOy !== oldOy) {
                const s = cfg.fixedSize ? `scale(${1 / lastK}) ` : "";
                inner
                  .attr("transform", `${s}translate(${oldOx}, ${oldOy})`)
                  .transition("vlabel-inner")
                  .duration(posDur)
                  .attr("transform", `${s}translate(${newOx}, ${newOy})`);
              }
            }
          });
          return update;
        },
        (exit) => {
          if (fxDur > 0) {
            const t = exit
              .transition("vlabel-fade")
              .duration(fxDur)
              .attr("opacity", 0);
            // On a data change, travel toward where the leaving datum WOULD sit
            // under the new scales while it fades (mirrors the scatter dots).
            if (dur > 0 && projCur) {
              t.attr("transform", (cell) => translateFrom(projCur, cell));
            }
            t.remove();
          } else {
            exit.remove();
          }
          return exit;
        },
      );
  }

  function render(payload, props, voronoiState) {
    if (!payload) return;
    base.setStaticGroup(recomputeStatic(props, payload));
    // `layerContainer` (when a MaskLayer wraps this label) makes the base group
    // render inside the mask's clipped <g> instead of the canvas innerEl.
    const g = base.ensureGroup(payload, props.layerContainer ?? null);
    lastPayload = payload;
    lastProps = props;
    // Recompute mode: the group is not scaled, so the inner block sits at its
    // natural size — no 1/k counter-scale needed (kForFixed = 1).
    lastK = base.staticGroup ? 1 : base.transform.k;
    lastVoronoiState = voronoiState;
    const duration = payload.duration ?? props.duration ?? 0;
    renderLayer(voronoiContentGroup(g, payload), voronoiState, duration);
  }

  function rerender(props, voronoiState) {
    lastProps = props;
    // A per-frame duration override carried on the state — the provider stamps
    // `renderDuration: 0` on live interactive-zoom frames so labels snap to the
    // cursor instead of starting a fresh draw-duration tween each frame. Only
    // honoured for the incoming state, never persisted (a later style rerender
    // with no state keeps the normal animated duration).
    let frameDuration;
    // Skip if the state reference is the same as last render — the watcher
    // chain in VoronoiLayer fires both a draw-watcher render and a
    // voronoiDraw-watcher rerender, and the second would clobber the in-flight
    // Flip animation queued by the first.
    if (voronoiState !== undefined) {
      if (voronoiState === lastVoronoiState) return;
      lastVoronoiState = voronoiState;
      frameDuration = voronoiState?.renderDuration;
    }
    if (!lastPayload) return;
    base.setStaticGroup(recomputeStatic(props, lastPayload));
    // Re-run ensureGroup so the layer's data-order sort fires on every
    // rerender — otherwise sibling layers that re-render on data changes can
    // push this group out of position.
    const g = base.ensureGroup(lastPayload, props.layerContainer ?? null);
    if (base.staticGroup) lastK = 1;
    const duration =
      frameDuration ?? lastPayload.duration ?? props.duration ?? 0;
    renderLayer(
      voronoiContentGroup(g, lastPayload),
      lastVoronoiState,
      duration,
    );
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich `{ transform, xScale, yScale }`.
    const transform =
      zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    base.onZoom(transform);
    // Recompute mode: the provider rebuilds + rerenders the labels at their
    // zoomed positions and natural size — nothing to counter-scale here.
    if (base.staticGroup) {
      lastK = 1;
      return;
    }
    lastK = transform.k;
    if (!lastProps?.fixedSize || !base.group) return;
    base.group.selectAll("g.vlabel-inner").each(function () {
      const el = d3.select(this);
      const ox = +el.attr("data-ox") || 0;
      const oy = +el.attr("data-oy") || 0;
      el.attr("transform", `scale(${1 / lastK}) translate(${ox}, ${oy})`);
    });
    // The connector rides the dot centre (no offset) — counter-scale it too so it
    // stays constant-size like the block, instead of scaling with the zoom.
    base.group
      .selectAll("line.vlabel-connector")
      .attr("transform", `scale(${1 / lastK})`);
  }

  function applyGestureTransform(gesture) {
    if (!base.group) return;
    voronoiGestureTransform(base.group, lastPayload, gesture?.d ?? null);
    // The gesture's content-group scale(dk) would blow up / shrink the glyphs;
    // counter it on each fixed-size label block so text (and its dot offset)
    // stay constant on screen during the drag. Recompute mode → lastK === 1,
    // so this resolves to scale(1/dk). Non-fixed labels intentionally grow.
    if (lastProps && lastProps.fixedSize === false) return;
    const dk = gesture?.k ?? 1;
    const inv = 1 / ((lastK || 1) * dk);
    base.group.selectAll("g.vlabel-inner").each(function () {
      const el = d3.select(this);
      const ox = +el.attr("data-ox") || 0;
      const oy = +el.attr("data-oy") || 0;
      el.attr("transform", `scale(${inv}) translate(${ox}, ${oy})`);
    });
    // Apply the same inverse to the connector so it stays glued to the dot/label
    // through the settle gesture, instead of scaling with the drag.
    base.group
      .selectAll("line.vlabel-connector")
      .attr("transform", `scale(${inv})`);
  }

  function destroy() {
    // Kill any in-flight Flip tweens so GSAP's ticker doesn't keep running (and
    // an onComplete doesn't touch detached nodes) after the layer unmounts.
    if (base.group)
      gsap.killTweensOf(
        base.group.node()?.querySelectorAll?.("g.vlabel-inner") ?? [],
      );
    base.destroy();
    lastProps = null;
    lastPayload = null;
    lastVoronoiState = null;
  }

  return {
    render,
    rerender,
    onZoom,
    applyGestureTransform,
    setOrder: (order) => base.setOrder(order),
    setVisible: (...a) => base.setVisible(...a),
    destroy,
  };
}
