<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createBrushLayer, BRUSH_LAYER_DEFAULTS as D } from "../../core/brushLayer.js";

const props = defineProps({
  /**
   * Brush mode:
   *   "x"  — one-dimensional horizontal brush (default, suits time series)
   *   "y"  — one-dimensional vertical brush
   *   "xy" — two-dimensional rectangle brush
   */
  mode:        { type: String,  default: D.mode },

  /**
   * Current selection in data space.  The layer converts these to screen
   * coordinates via the canvas projector + zoom transform and calls
   * brush.move() to position the rectangle.  Pass null to show no selection.
   *
   * selectionX: [xMin, xMax]   (used by mode "x" and "xy")
   * selectionY: [yMin, yMax]   (used by mode "y" and "xy")
   */
  selectionX:  { type: Array,   default: D.selectionX },
  selectionY:  { type: Array,   default: D.selectionY },

  /**
   * When snapToData is true, brush-end snaps the selection endpoints to the
   * nearest value in snapValues (a flat array of data-space x values).
   * Useful for category-axis charts where intermediate values don't exist.
   */
  snapToData:  { type: Boolean, default: D.snapToData },
  snapValues:  { type: Array,   default: D.snapValues },

  /** Visual styling */
  fill:        { type: String,  default: D.fill },
  stroke:      { type: String,  default: D.stroke },
  strokeWidth: { type: Number,  default: D.strokeWidth },
  // SVG stroke-dasharray on the selection rect, e.g. "4 2" for dashes.
  // Null (default) leaves the stroke solid.
  strokeDasharray: { type: String, default: D.strokeDasharray },
  showHandles: { type: Boolean, default: D.showHandles },
  // Make the brush's full-canvas overlay pointer-transparent so a coexisting
  // LineLayer hover overlay (tooltips, click-to-pin) keeps receiving events.
  // Existing selections can still be moved/resized via the selection rect
  // and edge handles.
  disableOverlay: { type: Boolean, default: D.disableOverlay },

  /**
   * margin / padding default to null — falls back to the parent chart's
   * chartContext inject, then to zeros.  Override explicitly only when the
   * BrushLayer is used standalone (outside a chart preset slot).
   */
  margin:      { type: Object,  default: null },
  padding:     { type: Object,  default: null },

  order:       { type: Number,  default: undefined },
});

const emit = defineEmits([
  /**
   * Fires continuously while the user is dragging.
   * Payload: { x: [min, max] | null, y: [min, max] | null }  in data space.
   * Good for live highlighting or hover-preview effects.
   */
  "brush",
  /**
   * Fires once when the user releases (brush end).
   * Same payload shape as "brush".
   * Good for driving zoom, filtering, or updating parent state.
   */
  "select",
]);

const draw         = inject("draw");
const zoom         = inject("zoom", null);
const chartContext = inject("chartContext", null);

const core = createBrushLayer();

const getProps = () => {
  const ctx = chartContext?.value ?? {};
  return {
    ...props,
    margin:   props.margin  ?? ctx.margin  ?? null,
    padding:  props.padding ?? ctx.padding ?? null,
    onBrush:  (data) => emit("brush",  data),
    onSelect: (data) => emit("select", data),
  };
};

// Catch up to the canvas's current zoom on first render: if the BrushLayer
// is mounted into an already-zoomed canvas, the zoom watcher below won't
// fire (the value hasn't changed) and the brush would render at the
// unzoomed selection position.
let zoomCaughtUp = false;
watch(draw, (payload) => {
  if (!payload?.svgEl) return;
  core.render(payload, getProps());
  if (!zoomCaughtUp && zoom?.value) {
    zoomCaughtUp = true;
    const zv = zoom.value;
    const tr = zv?.transform ?? zv;  // unwrap rich { transform, xScale, yScale } or accept raw
    // Skip if the payload already carries this zoom (canvas pre-baked it into
    // `payload.zoomTransform` on the draw that triggered this watcher).
    const pt = payload.zoomTransform;
    const alreadyCorrect = pt && pt.k === tr.k && pt.x === tr.x && pt.y === tr.y;
    if (!alreadyCorrect && (tr.k !== 1 || tr.x !== 0 || tr.y !== 0)) core.onZoom(zv);
  }
}, { immediate: true });

watch(zoom, (t) => { if (t) core.onZoom(t); });

watch(
  [
    () => props.mode,
    () => props.selectionX,
    () => props.selectionY,
    () => props.snapToData,
    () => props.snapValues,
    () => props.fill,
    () => props.stroke,
    () => props.strokeWidth,
    () => props.strokeDasharray,
    () => props.showHandles,
    () => props.disableOverlay,
    () => props.margin,
    () => props.padding,
  ],
  () => core.rerender(0, getProps()),
  { deep: true },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
