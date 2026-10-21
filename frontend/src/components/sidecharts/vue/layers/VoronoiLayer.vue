<template>
  <slot />
</template>

<script setup>
import { shallowRef, provide, inject, watch, onBeforeUnmount, toRef } from "vue";
import { createVoronoiCompute } from "../../core/voronoiCompute.js";
import { createVoronoiCellLayer, VORONOI_CELL_LAYER_DEFAULTS } from "../../core/voronoiCellLayer.js";
import { zoomDeltaString } from "../../core/voronoiLayout.js";

const props = defineProps({
  data:            { type: Array,   default: () => [] },
  showCells:       { type: Boolean, default: VORONOI_CELL_LAYER_DEFAULTS.showCells },
  cellFill:        { type: String,  default: VORONOI_CELL_LAYER_DEFAULTS.cellFill },
  cellFillOpacity: { type: Number,  default: VORONOI_CELL_LAYER_DEFAULTS.cellFillOpacity },
  cellStroke:      { type: String,  default: VORONOI_CELL_LAYER_DEFAULTS.cellStroke },
  cellStrokeWidth: { type: Number,  default: VORONOI_CELL_LAYER_DEFAULTS.cellStrokeWidth },
  showCentroids:   { type: Boolean, default: VORONOI_CELL_LAYER_DEFAULTS.showCentroids },
  centroidColor:   { type: String,  default: VORONOI_CELL_LAYER_DEFAULTS.centroidColor },
  centroidRadius:  { type: Number,  default: VORONOI_CELL_LAYER_DEFAULTS.centroidRadius },
  // Zoom mode. true (default) = recompute: re-project through the live zoomed
  // scales and rebuild the diagram on every zoom, so cells reshape
  // (viewport-aware) and labels glide instead of snapping — including on a
  // programmatic zoom, which arrives as a draw. false = literal zoom: the
  // diagram is computed once in raw pixel space and the group <g> carries the
  // zoom transform (cheaper, but labels snap on programmatic zoom). See
  // docs/plans/voronoi-zoom-plan.md.
  recomputeOnZoom: { type: Boolean, default: true },
  // When recomputeOnZoom is on, how INTERACTIVE (wheel/drag) zoom is handled:
  //   "settle" (default, option B) — ride a cheap zoom delta during the gesture
  //     and rebuild the Delaunay ONCE when it settles. No per-frame recompute.
  //   "live" (default, option A) — rebuild the diagram every animation frame
  //     (rAF-coalesced, so at most once per frame). Cells reshape continuously
  //     during the drag at higher CPU cost.
  // Programmatic zoom + data changes always recompute via the draw path
  // regardless of this setting.
  zoomRecomputeMode: { type: String, default: "live" },
  order:           { type: Number,  default: undefined },
});

const draw = inject("draw");
const zoom = inject("zoom");

const voronoiDraw  = shallowRef(null);
const voronoiHover = shallowRef(null);
provide("voronoiDraw",  voronoiDraw);
provide("voronoiHover", voronoiHover);
// Broadcast the zoom mode so child sub-layers (cells / labels / hover / markers)
// know whether to ride the group transform (literal) or treat positions as
// already-zoomed (recompute). Consumed in step 3.
provide("voronoiZoomMode", toRef(props, "recomputeOnZoom"));
// Cascade the order prop to child voronoi layers (label / hover / marker) so
// the developer only sets `:order` on the parent and the whole voronoi group
// paints together. Children may still override with their own `order` prop.
provide("voronoiOrder", toRef(props, "order"));

const compute  = createVoronoiCompute();
const cellCore = createVoronoiCellLayer();

const getCellProps = () => ({ ...props });

// ── Interactive-zoom perf ───────────────────────────────────────────────────
// In recompute mode an interactive wheel/drag would rebuild the whole Delaunay
// EVERY frame (the "fan"). Two strategies, gated by `zoomRecomputeMode`:
//   "settle" (B, default): ride a cheap zoom DELTA on the existing diagram
//     during the gesture and recompute ONCE when it settles (~SETTLE_MS after
//     the last event). Children apply the same delta via `voronoiGesture`.
//   "live"   (A): recompute every frame, but rAF-COALESCED so it fires at most
//     once per animation frame (dedupes wheel bursts).
// Programmatic zoom + data changes always go through the draw/recompute path,
// regardless of mode (so the click-to-refocus glide + reshape are preserved).
const IDENTITY = { k: 1, x: 0, y: 0 };
const SETTLE_MS = 120;
const voronoiGesture = shallowRef(null); // delta transform string, or null
provide("voronoiGesture", voronoiGesture);
let baseT = IDENTITY;       // zoom transform at the last recompute (delta baseline)
let latestZoom = null;      // latest rich { transform, xScale, yScale }
let projectorIsScale = false;
let settleTimer = null;
let zoomRaf = null;         // rAF handle for "live" (A) coalescing

function cancelLive() {
  if (zoomRaf) { cancelAnimationFrame(zoomRaf); zoomRaf = null; }
}

function clearGesture() {
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  cancelLive();
  voronoiGesture.value = null;
  cellCore.applyGestureTransform?.(null);
}

// Full recompute at a transform — used by both "settle" (once on end) and
// "live" (once per coalesced frame).
function recomputeAt(t) {
  const state = compute.onZoom(t, props.data);
  if (state) {
    state.renderDuration = 0;
    baseT = t.transform ?? IDENTITY;
    voronoiDraw.value = state;
    cellCore.rerender(getCellProps(), state);
    return true;
  }
  cellCore.onZoom(t);                 // geo / non-scale: literal group transform
  return false;
}

function settleGesture() {
  settleTimer = null;
  if (!latestZoom) return;
  voronoiGesture.value = null;        // children reset via the voronoiDraw rerender
  if (recomputeAt(latestZoom)) cellCore.applyGestureTransform?.(null);
}

watch(draw, (payload) => {
  if (!payload) return;
  // In recompute mode the draw projects through the live zoomed scales so a
  // programmatic zoom (which arrives as a draw) lands the cells at their zoomed
  // positions and the layers animate there instead of riding the group transform.
  const state = compute.onDraw(payload, props.data, { zoomed: props.recomputeOnZoom });
  voronoiDraw.value = state;
  cellCore.render(payload, getCellProps(), state);
  // This draw is the new delta baseline; any in-flight gesture is superseded.
  baseT = payload.zoomTransform ?? IDENTITY;
  projectorIsScale = payload.projector?.type === "scale";
  clearGesture();
}, { immediate: true });

watch(zoom, (t) => {
  if (!t) return;
  if (props.recomputeOnZoom && projectorIsScale) {
    latestZoom = t;
    if (props.zoomRecomputeMode === "live") {
      // A — recompute per frame, rAF-coalesced (at most once per frame).
      if (!zoomRaf) {
        zoomRaf = requestAnimationFrame(() => { zoomRaf = null; recomputeAt(latestZoom); });
      }
    } else {
      // B — ride a cheap zoom delta during the gesture, recompute once on
      // settle. No per-frame Delaunay rebuild. `k` (the delta scale) lets the
      // label layer counter-scale its glyphs so text stays crisp.
      const tf = t.transform ?? t;
      const gesture = { d: zoomDeltaString(tf, baseT), k: (tf.k ?? 1) / (baseT.k || 1) };
      voronoiGesture.value = gesture;         // children apply the same delta
      cellCore.applyGestureTransform?.(gesture);
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(settleGesture, SETTLE_MS);
    }
    return;
  }
  // Literal mode (or geo): ride the group transform directly, as before.
  cellCore.onZoom(t);
});

watch(() => props.data, () => {
  const state = compute.recompute(props.data);
  voronoiDraw.value = state;
  cellCore.rerender(getCellProps(), state);
});

watch(
  [
    () => props.showCells,
    () => props.cellFill,
    () => props.cellFillOpacity,
    () => props.cellStroke,
    () => props.cellStrokeWidth,
    () => props.showCentroids,
    () => props.centroidColor,
    () => props.centroidRadius,
  ],
  () => cellCore.rerender(getCellProps(), voronoiDraw.value),
);

watch(() => props.order, (order) => cellCore.setOrder(order), { immediate: true });

onBeforeUnmount(() => {
  if (settleTimer) { clearTimeout(settleTimer); settleTimer = null; }
  cancelLive();
  cellCore.destroy();
});
</script>
