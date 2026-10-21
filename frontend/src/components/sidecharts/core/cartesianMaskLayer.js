import * as d3 from "d3";
import { applyZoomToScales } from "./_seriesCommon.js";
import { ensureClipPath, updateRevealRect } from "../utils/revealClip.js";
import { zoomFromPayload } from "../utils/zoomFromPayload.js";

let _maskId = 0;

export const CARTESIAN_MASK_DEFAULTS = {
  revealStart:    null,
  revealEnd:      null,
  revealDuration: 600,
  revealEase:     "easeCubic",
  margin:         null,
  padding:        null,
  // Pointer-events on the mask container <g>. "none" (default) is right for
  // reveal masks (a painted line/area shouldn't shadow the hover overlay below)
  // and for label clips. Set to "auto" for interactive clipped content (e.g.
  // scatter dots) so the children become hit targets — the container <g> has no
  // geometry, so empty gaps still fall through to whatever sits below.
  pointerEvents:  "none",
  // Box-clip mode. When false (default) the clip covers the FULL chart height
  // (line-reveal behaviour — only the horizontal reveal window clips). When
  // true the clip is a BOX: it also clips top/bottom to the plot area, so
  // slotted layers can't spill into the axis / margin / padding zones. The box
  // is `SVG − margin − padding` on all four sides, i.e. `padding` doubles as the
  // clip inset (0 = clip at the axis edge; = the chart's padding = the data area).
  clipToPlot:     false,
};

/**
 * Cartesian (x/y scale) mask layer.
 *
 * Creates a single `<clipPath><rect/></clipPath>` that clips all child layers
 * to an animatable reveal window defined in data-space coordinates
 * (`revealStart`, `revealEnd`).  Any layers rendered inside the container
 * returned by `getContainerNode()` are automatically clipped.
 *
 * The clip rect is in `innerEl` coordinates and is updated on every render
 * and on every zoom event.  The named D3 transition `"reveal"` is used for
 * clip animation so it never fights the line/area three-phase choreography
 * running on the default unnamed transition.
 */
export function createCartesianMaskLayer() {
  const clipId = `cmask-${++_maskId}`;

  let containerG        = null;
  let clipRectSel       = null;
  let lastPayload       = null;
  let lastProps         = null;
  let activeZoomTransform = null;
  // The zoom-adjusted x-scale the CANVAS computed — the same scale every other
  // layer is handed (`payload.xScale` on a draw, `zoomArg.xScale` on a zoom
  // event).  We use it verbatim so the clip lands on exactly the same
  // coordinates as the lines/areas instead of re-deriving it.
  let activeXScale      = null;
  let lastOrder         = undefined;
  // First render must stamp the clip rect at its final geometry instantly —
  // the <rect> is born at x=0/width=0, so animating it would wipe the mask
  // in from the left edge.  Only prop-driven updates after that animate.
  let hasRendered       = false;

  // Resolve the zoom-adjusted x-scale.  Prefer the scale the canvas already
  // computed (on the draw payload or the rich zoom event) so the clip moves
  // in lockstep with every other layer.  Fall back to rescaling the raw scale
  // ourselves only when the canvas didn't supply one (older code paths).
  function resolveXScale(source) {
    if (source?.xScale) return source.xScale;
    const proj = lastPayload?.projector;
    if (!proj?.raw?.xScale || !proj?.raw?.yScale) return null;
    const { x } = applyZoomToScales(
      proj.raw.xScale,
      proj.raw.yScale,
      activeZoomTransform,
      lastPayload?.zoomAxes,
    );
    return x;
  }

  function init(payload, outerContainer) {
    if (containerG) return;
    const svgEl = payload.svgEl;

    // Ensure <defs> exists.
    let defs = d3.select(svgEl).select("defs");
    if (defs.empty()) defs = d3.select(svgEl).insert("defs", ":first-child");

    // One <clipPath><rect/></clipPath> for this mask instance.
    clipRectSel = ensureClipPath(defs, clipId);

    // Container <g> appended to outerContainer (another mask's <g>) or
    // directly to payload.innerEl (the canvas's inner group).
    //
    // `pointer-events: none` keeps mouse events flowing through to whatever
    // sits below — most importantly the host chart's hover overlay rect,
    // which would otherwise be shadowed by this group's painted contents.
    // Slotted layers that need interactivity (e.g. their own dot hovers)
    // re-enable pointer-events on their own elements as needed.
    const parentEl = outerContainer ?? payload.innerEl;
    containerG = d3.select(parentEl)
      .append("g")
      .attr("class", "cartesian-mask-container")
      .attr("clip-path", `url(#${clipId})`)
      .attr("pointer-events", "none");

    if (lastOrder !== undefined) applyOrderFn();
  }

  function applyOrderFn() {
    if (!containerG) return;
    const node = containerG.node();
    node.dataset.order = lastOrder;
    const parent = node.parentNode;
    if (parent) {
      const ordered = [...parent.querySelectorAll(":scope > [data-order]")];
      ordered.sort((a, b) => +a.dataset.order - +b.dataset.order);
      ordered.forEach((el) => parent.appendChild(el));
    }
  }

  // Apply the clip geometry. `duration`/`ease` are passed explicitly by the
  // caller so the clip can follow a zoom/data draw at the DRAW's tempo
  // (lockstep with the lines) yet animate an explicit reveal-window change at
  // `revealDuration`.
  function updateClipRect(props, { duration = 0, ease } = {}) {
    if (!clipRectSel || !activeXScale || !lastPayload) return;
    const payload = lastPayload;

    const cm = payload.margin ?? { top: 0, right: 0, bottom: 0, left: 0 };
    const m  = props.margin  ?? cm;
    const p  = props.padding ?? { top: 0, right: 0, bottom: 0, left: 0 };

    // Data-area bounds in innerEl coordinates.  The xScale's range starts at 0
    // (just the plot area, after padding), so `applyRevealClip` adds `plotLeft`
    // to bring its outputs into innerEl space.
    const innerWidth = Math.max(0, payload.width - m.left - m.right - p.left - p.right);
    const plotLeft   = m.left + p.left - cm.left;
    const plotRight  = plotLeft + innerWidth;

    // Vertical extent.
    //  • box mode (clipToPlot): clip top/bottom to the plot area, mirroring the
    //    horizontal inset — box = SVG − margin − padding on all four sides.
    //  • default: from the SVG top edge (−cm.top in innerEl coords) down the
    //    full chart height, so only the horizontal reveal window clips.
    let plotTop, plotHeight;
    if (props.clipToPlot) {
      plotTop    = m.top + p.top - cm.top;
      plotHeight = Math.max(0, payload.height - m.top - m.bottom - p.top - p.bottom);
    } else {
      plotTop    = -(m.top + p.top);
      plotHeight = Math.max(0, payload.height);
    }

    // Horizontal edges of the reveal window in innerEl screen space.
    //
    // A BOUNDED edge uses its EXACT scaled position — deliberately NOT clamped
    // to the plot — so the rect's edges interpolate in lockstep with the data
    // (line) vertices through a zoom/pan. When the window scrolls off-screen
    // the rect simply runs off-plot, which is harmless: the masked content is
    // itself clipped to the plot, so nothing leaks into the margins. Clamping
    // here (the old behaviour) made the clamped edge crawl to the plot border
    // while the lines raced off-screen → the visible desync during a zoom.
    //
    // An UNBOUNDED (null) edge falls back to the plot border so a "no
    // constraint on this side" reveal fills the plot instead of going to ±∞.
    const rs = props.revealStart ?? null;
    const re = props.revealEnd ?? null;
    // In RTL the x-scale range is reversed ([innerWidth, 0]), so revealStart maps
    // to a larger pixel than revealEnd. Null edges must also pick the correct
    // physical border: "no constraint on start" = right border in RTL.
    const isRtl = activeXScale.range && activeXScale.range()[0] > activeXScale.range()[1];
    const pixStart = rs != null ? plotLeft + activeXScale(rs) : (isRtl ? plotRight : plotLeft);
    const pixEnd   = re != null ? plotLeft + activeXScale(re) : (isRtl ? plotLeft  : plotRight);
    const left  = Math.min(pixStart, pixEnd);
    const right = Math.max(pixStart, pixEnd);

    updateRevealRect(clipRectSel, {
      x:      left,
      width:  right - left,
      y:      plotTop,
      height: plotHeight,
      duration,
      ease,
    });
  }

  // Scale-driven update: a zoom or data change arrived via the draw signal.
  // Follow it with the DRAW's own duration + ease so the clip moves exactly
  // like the line/area layers (which key off `payload.duration`).  The first
  // render stamps final geometry instantly (the <rect> is born at 0-width).
  function render(payload, props) {
    if (!payload?.svgEl) return;
    // Only refresh tracked zoom state from the payload on a NEW draw — a
    // rerender (same payload ref) must keep whatever onZoom updated since
    // (see lineLayer.js for the full rationale).
    const isNewPayload = payload !== lastPayload;
    lastPayload = payload;
    lastProps   = props;
    if (isNewPayload) {
      activeZoomTransform = zoomFromPayload(payload, activeZoomTransform);
      activeXScale = resolveXScale(payload);
    }

    // `outerLayerContainer` is the parent mask's container <g> when this
    // MaskLayer is nested inside another; otherwise null → uses innerEl.
    const outerContainer = props.outerLayerContainer?.value ?? props.outerLayerContainer ?? null;
    init(payload, outerContainer);
    // Re-stamp each render so a reactive change to `pointerEvents` takes effect.
    containerG?.attr("pointer-events", props.pointerEvents ?? "none");

    updateClipRect(props, {
      duration: hasRendered
        ? (payload.duration ?? props.revealDuration ?? CARTESIAN_MASK_DEFAULTS.revealDuration)
        : 0,
      ease: payload.ease ?? props.revealEase,
    });
    hasRendered = true;
  }

  // Explicit reveal-window change (revealStart/End/margin/padding props moved,
  // NOT a zoom). Animate at `revealDuration`/`revealEase` — this is the
  // "advance a line" / sliding-window motion, independent of any zoom tempo.
  function updateReveal(props) {
    lastProps = props;
    updateClipRect(props, {
      duration: props.revealDuration ?? CARTESIAN_MASK_DEFAULTS.revealDuration,
      ease:     props.revealEase,
    });
  }

  function onZoom(zoomArg) {
    // Accept both legacy `transform` and the new rich { transform, xScale, yScale }.
    const transform = zoomArg && zoomArg.transform ? zoomArg.transform : zoomArg;
    activeZoomTransform = (transform.k === 1 && transform.x === 0 && transform.y === 0)
      ? null
      : transform;
    // Per-frame zoom gesture: take the canvas's freshly-rescaled x-scale and
    // snap the clip to it (no transition — it would chase a moving target).
    activeXScale = resolveXScale(zoomArg);
    if (lastProps) updateClipRect(lastProps, { duration: 0 });
  }

  function destroy() {
    if (lastPayload?.svgEl) {
      d3.select(lastPayload.svgEl).select(`#${clipId}`).remove();
    }
    containerG?.remove();
    containerG        = null;
    clipRectSel       = null;
    lastPayload       = null;
    lastProps         = null;
    activeZoomTransform = null;
    activeXScale        = null;
  }

  function getContainerNode() {
    return containerG?.node() ?? null;
  }

  function setOrder(order) {
    lastOrder = order;
    applyOrderFn();
  }

  return { render, updateReveal, onZoom, destroy, getContainerNode, setOrder };
}
