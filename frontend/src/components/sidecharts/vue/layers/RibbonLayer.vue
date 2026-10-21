<template />

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createRibbonLayer, RIBBON_LAYER_DEFAULTS } from "../../core/ribbonLayer.js";

const props = defineProps({
  data:              { type: Array,              default: () => RIBBON_LAYER_DEFAULTS.data },
  color:             { type: Object,             default: () => ({ ...RIBBON_LAYER_DEFAULTS.color }) },
  rectStyle:         { type: Object,             default: () => ({ ...RIBBON_LAYER_DEFAULTS.rectStyle }) },
  margin:            { type: Object,             default: () => ({ ...RIBBON_LAYER_DEFAULTS.margin }) },
  padding:           { type: Object,             default: () => ({ ...RIBBON_LAYER_DEFAULTS.padding }) },
  max:               { type: Number,             default: RIBBON_LAYER_DEFAULTS.max },
  duration:          { type: Number,             default: RIBBON_LAYER_DEFAULTS.duration },
  ease:              { type: String,             default: RIBBON_LAYER_DEFAULTS.ease },
  paddingInner:      { type: Number,             default: RIBBON_LAYER_DEFAULTS.paddingInner },
  paddingOuter:      { type: Number,             default: RIBBON_LAYER_DEFAULTS.paddingOuter },
  bgColor:           { type: String,             default: RIBBON_LAYER_DEFAULTS.bgColor },
  format:            { type: Function,           default: RIBBON_LAYER_DEFAULTS.format },
  stacked:           { type: Boolean,            default: RIBBON_LAYER_DEFAULTS.stacked },
  scaleType:         { type: String,             default: RIBBON_LAYER_DEFAULTS.scaleType },
  keys:              { type: Array,              default: RIBBON_LAYER_DEFAULTS.keys },
  showLinks:         { type: Boolean,            default: RIBBON_LAYER_DEFAULTS.showLinks },
  useCurves:         { type: Boolean,            default: RIBBON_LAYER_DEFAULTS.useCurves },
  useLines:          { type: Boolean,            default: RIBBON_LAYER_DEFAULTS.useLines },
  linkOpacity:       { type: Number,             default: RIBBON_LAYER_DEFAULTS.linkOpacity },
  linkDimOpacity:    { type: Number,             default: RIBBON_LAYER_DEFAULTS.linkDimOpacity },
  highlighted:            { type: [String, Array], default: RIBBON_LAYER_DEFAULTS.highlighted },
  highlightFill:          {                        default: RIBBON_LAYER_DEFAULTS.highlightFill },
  highlightFillOpacity:   { type: Number,          default: RIBBON_LAYER_DEFAULTS.highlightFillOpacity },
  highlightStrokeColor:   {                        default: RIBBON_LAYER_DEFAULTS.highlightStrokeColor },
  highlightStrokeWidth:   { type: Number,          default: RIBBON_LAYER_DEFAULTS.highlightStrokeWidth },
  highlightStrokeOpacity: { type: Number,          default: RIBBON_LAYER_DEFAULTS.highlightStrokeOpacity },
  dimFill:                {                        default: RIBBON_LAYER_DEFAULTS.dimFill },
  dimOpacity:             { type: Number,          default: RIBBON_LAYER_DEFAULTS.dimOpacity },
  dimStrokeColor:         {                        default: RIBBON_LAYER_DEFAULTS.dimStrokeColor },
  dimStrokeWidth:         { type: Number,          default: RIBBON_LAYER_DEFAULTS.dimStrokeWidth },
  dimStrokeOpacity:       { type: Number,          default: RIBBON_LAYER_DEFAULTS.dimStrokeOpacity },
  projector:         { type: Function,           default: RIBBON_LAYER_DEFAULTS.projector },
  fixedBarWidth:     { type: Number,             default: RIBBON_LAYER_DEFAULTS.fixedBarWidth },
  fixedMaxBarHeight: { type: Number,             default: RIBBON_LAYER_DEFAULTS.fixedMaxBarHeight },
  getCoordinates:    { type: Function,           default: RIBBON_LAYER_DEFAULTS.getCoordinates },
  ignoreProjection:  { type: Boolean,            default: RIBBON_LAYER_DEFAULTS.ignoreProjection },
  order:             { type: Number,              default: undefined },
});

const emit           = defineEmits(["select", "hover"]);
const draw           = inject("draw");
const zoom           = inject("zoom", null);
const controls       = inject("controls", null);
const layerContainer = inject("layerContainer", null);

const core = createRibbonLayer({
  onSelect: (d) => emit("select", d),
  onHover:  (d) => emit("hover",  d),
});

const getProps = () => ({ ...props, controls, layerContainer });

watch(draw, (payload) => core.render(payload, getProps()), { immediate: true });
watch(zoom, (t) => { if (t) core.onZoom(t); });

// SINGLE RENDER PATH (see docs/plans/ribbon-chart-projector-refactor-plan.md §B).
//
// Props that change the chart's PROJECTOR are intentionally EXCLUDED from this
// rerender watcher: `data, stacked, max, scaleType, paddingInner, paddingOuter`.
// When any of them changes, RibbonChart's `chartProjector` recomputes →
// BaseCanvas.setProjector fires ONE draw → our `watch(draw)` above renders
// ONCE. Leaving them here too would render a SECOND time in the next flush
// (rerender), interrupting and snapping the entering-category animation —
// the exact double-render the ribbon refactor was built to avoid. This mirrors
// LineLayer, where `data` flows through the draw, not a separate watcher.
//
// Props kept here change the bars but NOT the projector, so they get no draw
// and must trigger their own rerender:
//   - keys                : chartProjector's computeMax ignores keys (computes
//                           over all keys), so a keys change emits no new
//                           projector → no draw. Keep it here.
//   - projector / ignoreProjection / getCoordinates / fixedBarWidth /
//     fixedMaxBarHeight    : map/geo-ribbon + fixed-size knobs, unrelated to
//                           the cartesian chartProjector.
// `data` is watched here ONLY to detect "did data change this tick" — it never
// triggers a rerender itself (it flows through the draw, see above). When data
// AND a highlight/keys prop change in the SAME tick — e.g. a page that derives
// `highlighted` from the active dataset — the data-driven draw already
// re-renders with the live props (highlights ride `styleBars`). Firing a second
// render here would spawn new default d3 transitions on the bars and interrupt
// the 3-phase enter/slide/exit choreography, collapsing it into one tween. So
// we skip the rerender whenever data also changed; the draw covers it.
let lastSeenData = props.data;
watch(
  [
    () => props.data,
    () => props.keys,
    () => props.projector,
    () => props.fixedBarWidth,
    () => props.fixedMaxBarHeight,
    () => props.getCoordinates,
    () => props.ignoreProjection,
    // Highlight / dim — purely visual (no projector change → no draw), so they
    // must trigger their own rerender.
    () => props.highlighted,
    () => props.highlightFill,
    () => props.highlightFillOpacity,
    () => props.highlightStrokeColor,
    () => props.highlightStrokeWidth,
    () => props.highlightStrokeOpacity,
    () => props.dimFill,
    () => props.dimOpacity,
    () => props.dimStrokeColor,
    () => props.dimStrokeWidth,
    () => props.dimStrokeOpacity,
    () => props.linkDimOpacity,
  ],
  ([data]) => {
    const dataChanged = data !== lastSeenData;
    lastSeenData = data;
    if (dataChanged) return;  // draw will (or did) re-render with current props
    core.rerender(props.duration, getProps());
  },
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
