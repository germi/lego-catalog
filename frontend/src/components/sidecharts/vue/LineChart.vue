<template>
  <BaseCanvas
    ref="canvasRef"
    :skip-projection="true"
    :duration="effective.duration"
    :ease="effective.ease"
    :allow-manual-zoom="effective.allowZoom"
    :max-zoom="effective.maxZoom"
    :clamp-pan="effective.allowZoom"
    :clamp-pan-inset="clampPanInset"
    :projector="chartProjector"
    :margin="resolvedMargin"
    :padding="resolvedPadding"
    :zoom-axes="effective.zoomAxes ?? 'x'"
    :user-zoom-axes="effective.userZoomAxes ?? null"
    class="line-container"
    v-bind="$attrs"
    @draw="onCanvasDraw"
    @zoom="emit('zoom', ($event?.transform ?? $event))"
  >
    <YAxisLayer
      v-if="effective.showYAxis"
      :order="-100"
      :side="resolvedYSide"
      :show-grid="effective.showYGrid"
      :data="effective.data"
      :margin="resolvedMargin"
      :padding="resolvedPadding"
      :max="effective.max"
      :stacked="effective.stacked"
      :scale-type="effective.scaleType"
      :tick-values="effective.yTickValues"
      :tick-format="effective.format"
      :num-ticks="effective.yNumTicks"
      :tick-size="effective.yTickSize"
      :tick-color="effective.yTickColor"
      :tick-text-color="effective.yTickTextColor"
      :grid-color="effective.yGridColor"
      :grid-dasharray="effective.yGridDasharray"
      :grid-opacity="effective.yGridOpacity"
      :ease="effective.ease"
      :duration="effective.duration"
      :rtl="effective.rtl"
    />

    <LineLayer
      :order="10"
      :data="effective.data"
      :keys="effective.keys"
      :color="effective.color"
      :margin="resolvedMargin"
      :padding="resolvedPadding"
      :x-scale-type="effective.xScaleType"
      :parse-time="effective.parseTime"
      :max="effective.max"
      :force-values="effective.forceValues"
      :stacked="effective.stacked"
      :curve="effective.curve"
      :stroke-width="effective.strokeWidth"
      :stroke-opacity="effective.strokeOpacity"
      :stroke-dasharray="effective.strokeDasharray"
      :dot-radius="effective.dotRadius"
      :dot-color="effective.dotColor"
      :duration="effective.duration"
      :ease="effective.ease"
      :highlighted="effective.highlighted"
      :dim-opacity="effective.dimOpacity"
      :highlighted-color="effective.highlightedColor"
      :default-color="effective.defaultColor"
      :enable-x-hover="effective.hoverMode === 'x-proximity'"
      :show-hover-line="effective.showHoverLine"
      :hover-line-color="effective.hoverLineColor"
      :hover-line-width="effective.hoverLineWidth"
      :hover-line-dasharray="effective.hoverLineDasharray"
      :selected-x="effective.selectedX"
      :selected-key="effective.selectedKey"
      :selected-dot-radius="effective.selectedDotRadius"
      :selected-dot-stroke="effective.selectedDotStroke"
      :selected-dot-stroke-width="effective.selectedDotStrokeWidth"
      :selected-dot-stroke-dasharray="effective.selectedDotStrokeDasharray"
      :show-last-point="effective.showLastPoint"
      :selection-duration="effective.selectionDuration"
      :debug-clip="props.debugClip"
      @hover="$emit('hover', $event)"
      @click="$emit('click', $event)"
    />

    <LineAxisLayer
      v-if="effective.showXAxis"
      :order="-90"
      side="bottom"
      :show-grid="effective.showXGrid"
      :data="effective.data"
      :margin="resolvedMargin"
      :padding="resolvedPadding"
      :x-scale-type="effective.xScaleType"
      :tick-values="effective.xTickValues"
      :tick-format="xTickFormat"
      :grid-color="effective.xGridColor"
      :grid-dasharray="effective.xGridDasharray"
      :grid-opacity="effective.xGridOpacity"
      :ease="effective.ease"
      :duration="effective.duration"
    />

    <EditChart
      v-if="editMode"
      :effective="effective"
      :defaults="D"
      :meta="LINE_CHART_META"
      :overrides="overrides"
      @set="(k, v) => (overrides[k] = v)"
      @reset="(k) => delete overrides[k]"
      @reset-all="Object.keys(overrides).forEach((k) => delete overrides[k])"
    />

    <slot />
  </BaseCanvas>
</template>

<script setup>
import { computed, provide, ref, shallowRef } from "vue";
import BaseCanvas from "./canvas/BaseCanvas.vue";
import LineAxisLayer from "./layers/LineAxisLayer.vue";
import YAxisLayer from "./layers/YAxisLayer.vue";
import LineLayer from "./layers/LineLayer.vue";
import { computeFullYDomain } from "../core/_seriesCommon.js";
import { makeScaleProjector } from "../utils/projectors/scaleProjector.js";
import { resolveInline, resolveSpacing } from "../utils/resolveInline.js";
import EditChart from "./EditChart.vue";
import { useEditMode } from "../utils/editMode.js";
import { useEditableProps } from "../utils/editableProps.js";
import {
  LINE_CHART_DEFAULTS as D,
  LINE_CHART_META,
} from "../presets/LineChart.defaults.js";

const props = defineProps({
  data:            { type: Array,                default: () => D.data },
  color:           { type: Object,               default: () => ({ ...D.color }) },
  margin:          { type: Object,               default: () => ({ ...D.margin }) },
  padding:         { type: Object,               default: () => ({ ...D.padding }) },
  max:             { type: Number,               default: D.max },
  forceValues:     { type: [Number, Array],      default: D.forceValues },
  scaleType:       { type: String,               default: D.scaleType },
  xScaleType:      { type: String,               default: D.xScaleType },
  duration:        { type: Number,               default: D.duration },
  ease:            { type: String,               default: D.ease },
  showXAxis:       { type: Boolean,              default: D.showXAxis },
  showYAxis:       { type: Boolean,              default: D.showYAxis },
  yTickValues:     { type: Array,                default: D.yTickValues },
  xTickValues:     { type: Array,                default: D.xTickValues },
  format:          { type: Function,             default: D.format },
  stacked:         { type: Boolean,              default: D.stacked },
  yNumTicks:       { type: Number,               default: D.yNumTicks },
  yTickSize:       { type: Number,               default: D.yTickSize },
  yTickColor:      { type: String,               default: D.yTickColor },
  yTickTextColor:  { type: String,               default: D.yTickTextColor },
  showYGrid:       { type: Boolean,              default: D.showYGrid },
  yGridColor:      { type: String,               default: D.yGridColor },
  yGridDasharray:  { type: String,               default: D.yGridDasharray },
  yGridOpacity:    { type: Number,               default: D.yGridOpacity },
  showXGrid:       { type: Boolean,              default: D.showXGrid },
  xGridColor:      { type: String,               default: D.xGridColor },
  xGridDasharray:  { type: String,               default: D.xGridDasharray },
  xGridOpacity:    { type: Number,               default: D.xGridOpacity },
  keys:            { type: Array,                default: D.keys },
  curve:           { type: [String, Function],   default: D.curve },
  strokeWidth:     { type: [Number, Function],   default: D.strokeWidth },
  strokeOpacity:   { type: Number,               default: D.strokeOpacity },
  strokeDasharray: { type: [String, Function],   default: D.strokeDasharray },
  dotRadius:       { type: [Number, Function],   default: D.dotRadius },
  dotColor:        { type: [Object, Function],   default: D.dotColor },
  highlighted:     { type: [String, Array],      default: D.highlighted },
  dimOpacity:        { type: Number,             default: D.dimOpacity },
  highlightedColor:  { type: Object,             default: D.highlightedColor },
  defaultColor:    { type: String,               default: D.defaultColor },
  // Hover events.  `hoverMode: "x-proximity"` enables LineLayer's overlay
  // rect + closest-point emit.  `null` disables.  (`"voronoi"` is reserved
  // for a future preset-level composition with VoronoiHoverLayer.)
  hoverMode:          { type: String,            default: D.hoverMode },
  showHoverLine:      { type: Boolean,           default: D.showHoverLine },
  hoverLineColor:     { type: String,            default: D.hoverLineColor },
  hoverLineWidth:     { type: Number,            default: D.hoverLineWidth },
  hoverLineDasharray: { type: String,            default: D.hoverLineDasharray },
  // External selection.
  selectedX:                  { type: [String, Number],   default: D.selectedX },
  selectedKey:                { type: String,             default: D.selectedKey },
  selectedDotRadius:          { type: Number,             default: D.selectedDotRadius },
  selectedDotStroke:          { type: String,             default: D.selectedDotStroke },
  selectedDotStrokeWidth:     { type: Number,             default: D.selectedDotStrokeWidth },
  selectedDotStrokeDasharray: { type: String,             default: D.selectedDotStrokeDasharray },
  showLastPoint:     { type: Boolean,            default: D.showLastPoint },
  selectionDuration: { type: Number,             default: D.selectionDuration },
  allowZoom:       { type: Boolean,              default: D.allowZoom },
  maxZoom:         { type: Number,               default: D.maxZoom },
  zoomAxes:        { type: String,               default: D.zoomAxes },
  userZoomAxes:    { type: String,               default: D.userZoomAxes },
  rtl:             { type: Boolean,              default: D.rtl },
  yAxisSide:       { type: String,               default: D.yAxisSide },
  // Forward to LineLayer — when false the clip-path is dropped so the
  // phase-A/B off-range extrapolated tails become visible.
  debugClip:       { type: Boolean,              default: true },
});

const emit = defineEmits(["hover", "click", "draw", "zoom"]);

const editMode = useEditMode();
const { overrides, effective } = useEditableProps(props, D);

const resolvedMargin  = computed(() => resolveSpacing(effective.margin,  effective.rtl));
const resolvedPadding = computed(() => resolveSpacing(effective.padding, effective.rtl));
const resolvedYSide   = computed(() => resolveInline(effective.yAxisSide ?? "start", effective.rtl));

const clampPanInset = computed(() => {
  const m = resolvedMargin.value;
  const p = resolvedPadding.value;
  return {
    x: m.left + m.right + p.left + p.right,
    y: m.top  + m.bottom + p.top  + p.bottom,
  };
});

const xTickFormat = computed(
  () => (d) => props.data.find((e) => e.id === d)?.name ?? d,
);

// Y-domain unioned across all keys of all rows — so slotted band layers,
// gradient stops, etc. lock onto the same y space as the main LineLayer
// instead of building their own scale from a subset of keys.
const yDomain = computed(() =>
  computeFullYDomain(effective.data, {
    max:         effective.max,
    forceValues: effective.forceValues,
    stacked:     effective.stacked,
    keys:        effective.keys,
  }),
);

// Canvas dimensions reported by BaseCanvas via the draw payload.  Used to
// size the chart projector.  Tracked via refs so the projector recomputes
// when the canvas resizes.
const canvasWidth  = ref(0);
const canvasHeight = ref(0);
function onCanvasDraw(payload) {
  if (payload?.width  !== canvasWidth.value)  canvasWidth.value  = payload.width;
  if (payload?.height !== canvasHeight.value) canvasHeight.value = payload.height;
  emit("draw", payload);
}

// x-accessor matches `_seriesCommon.xValueFor`'s default — keeps the chart
// projector's x-scale aligned with what existing layers compute internally.
function makeXAccessor(scaleType, parseTime) {
  if (scaleType === "time") {
    const parse = parseTime ?? ((name) => new Date(String(name)));
    return (d) => parse(d.name);
  }
  return (d) => +d.name;
}

// Chart-level projector.  Width / height mirror what LineLayer's
// `innerDimensions` computes today (full SVG minus margin AND padding),
// so a layer reading from the projector + applying the existing
// `(margin + padding)` translate ends up at the same screen coords as
// today's "build my own scales" layers.
const chartProjector = computed(() => {
  if (!effective.data?.length) return null;
  const m = resolvedMargin.value;
  const p = resolvedPadding.value;
  const w = Math.max(0, canvasWidth.value  - m.left - m.right - p.left - p.right);
  const h = Math.max(0, canvasHeight.value - m.top  - m.bottom - p.top  - p.bottom);
  if (!w || !h) return null;

  const xAcc = makeXAccessor(effective.xScaleType, effective.parseTime);
  const xs   = effective.data.map(xAcc).filter((v) => v != null && Number.isFinite(+v));
  if (!xs.length) return null;
  const xMin = xs.reduce((a, b) => (a < b ? a : b));
  const xMax = xs.reduce((a, b) => (a > b ? a : b));

  return makeScaleProjector({
    width:      w,
    height:     h,
    xAccessor:  xAcc,
    xScaleType: effective.xScaleType,
    yScaleType: effective.scaleType,
    // Match the existing LineLayer internals: don't nice x (otherwise the
    // 1950–2025 domain might round to 1900–2050 and shift every point),
    // but DO nice y so the y-axis ticks land on round numbers.
    xNice:      false,
    yNice:      true,
    xDomain:    [xMin, xMax],
    yDomain:    yDomain.value,
    rtl:        effective.rtl,
  });
});

// Layout inheritance for slotted layers.  A slotted <AreaLayer> /
// <RefLineLayer> / <LineLabelLayer> doesn't receive the chart's
// margin / padding via a template prop (it sits in the slot, not in the
// chart's own template), so we expose them via a focused `chartContext`
// inject.  Layers fall back to this when their own margin / padding
// props aren't explicitly set.
//
// All other chart-level state (scales, prev-state, data) flows either
// through `payload.projector` (built by chartProjector below) or
// `chartData` (provided below).  This inject is intentionally narrow.
provide("chartContext", computed(() => ({
  margin:  resolvedMargin.value,
  padding: resolvedPadding.value,
})));

provide("chartData", computed(() => effective.data));

// Holder for the inner LineLayer's getPathId.  LineLayer fills this in on
// mount; slotted layers (e.g. LineLabelLayer) read .value to resolve which
// `<path id>` to point a `<textPath href>` at.
provide("lineLayerPaths", shallowRef(null));

// Forward BaseCanvas's programmatic zoom API so callers with a templateRef
// on this LineChart can drive zoom from the outside (scrollytelling, minimap
// control, useChartZoom composable, etc.).
const canvasRef = ref(null);
defineExpose({
  zoomToDomain: (...a) => canvasRef.value?.zoomToDomain(...a),
  setTransform: (...a) => canvasRef.value?.setTransform(...a),
  zoomToRect:   (...a) => canvasRef.value?.zoomToRect(...a),
  zoomToScale:  (...a) => canvasRef.value?.zoomToScale(...a),
  resetZoom:    (...a) => canvasRef.value?.resetZoom(...a),
  zoomIn:       (...a) => canvasRef.value?.zoomIn(...a),
  zoomOut:      (...a) => canvasRef.value?.zoomOut(...a),
  redraw:       (d)    => canvasRef.value?.redraw(d),
  get svgEl()  { return canvasRef.value?.svgEl; },
  get width()  { return canvasRef.value?.width; },
  get height() { return canvasRef.value?.height; },
});
</script>
