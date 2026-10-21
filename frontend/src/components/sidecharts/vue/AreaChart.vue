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
    class="area-container"
    v-bind="$attrs"
    @draw="onCanvasDraw"
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

    <AreaLayer
      :order="10"
      :data="effective.data"
      :keys="effective.keys"
      :color="effective.color"
      :margin="resolvedMargin"
      :padding="resolvedPadding"
      :scale-type="effective.scaleType"
      :x-scale-type="effective.xScaleType"
      :max="effective.max"
      :force-values="effective.forceValues"
      :stacked="effective.stacked"
      :curve="effective.curve"
      :opacity="effective.opacity"
      :stroke-width="effective.strokeWidth"
      :stroke-color="effective.strokeColor"
      :stroke-opacity="effective.strokeOpacity"
      :upper-key="effective.upperKey"
      :lower-key="effective.lowerKey"
      :duration="effective.duration"
      :ease="effective.ease"
      :highlighted="effective.highlighted"
      :default-color="effective.defaultColor"
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
      :meta="AREA_CHART_META"
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
import AreaLayer from "./layers/AreaLayer.vue";
import { computeFullYDomain } from "../core/_seriesCommon.js";
import { makeScaleProjector } from "../utils/projectors/scaleProjector.js";
import { resolveInline, resolveSpacing } from "../utils/resolveInline.js";
import EditChart from "./EditChart.vue";
import { useEditMode } from "../utils/editMode.js";
import { useEditableProps } from "../utils/editableProps.js";
import {
  AREA_CHART_DEFAULTS as D,
  AREA_CHART_META,
} from "../presets/AreaChart.defaults.js";

const props = defineProps({
  data:           { type: Array,              default: () => D.data },
  color:          { type: [Object, String],   default: () => ({ ...D.color }) },
  margin:         { type: Object,             default: () => ({ ...D.margin }) },
  padding:        { type: Object,             default: () => ({ ...D.padding }) },
  max:            { type: Number,             default: D.max },
  forceValues:    { type: [Number, Array],    default: D.forceValues },
  scaleType:      { type: String,             default: D.scaleType },
  xScaleType:     { type: String,             default: D.xScaleType },
  duration:       { type: Number,             default: D.duration },
  ease:           { type: String,             default: D.ease },
  showXAxis:      { type: Boolean,            default: D.showXAxis },
  showYAxis:      { type: Boolean,            default: D.showYAxis },
  yTickValues:    { type: Array,              default: D.yTickValues },
  xTickValues:    { type: Array,              default: D.xTickValues },
  format:         { type: Function,           default: D.format },
  stacked:        { type: Boolean,            default: D.stacked },
  yNumTicks:      { type: Number,             default: D.yNumTicks },
  yTickSize:      { type: Number,             default: D.yTickSize },
  yTickColor:     { type: String,             default: D.yTickColor },
  yTickTextColor: { type: String,             default: D.yTickTextColor },
  showYGrid:      { type: Boolean,            default: D.showYGrid },
  yGridColor:     { type: String,             default: D.yGridColor },
  yGridDasharray: { type: String,             default: D.yGridDasharray },
  yGridOpacity:   { type: Number,             default: D.yGridOpacity },
  showXGrid:      { type: Boolean,            default: D.showXGrid },
  xGridColor:     { type: String,             default: D.xGridColor },
  xGridDasharray: { type: String,             default: D.xGridDasharray },
  xGridOpacity:   { type: Number,             default: D.xGridOpacity },
  keys:           { type: Array,              default: D.keys },
  curve:          { type: [String, Function], default: D.curve },
  opacity:        { type: Number,             default: D.opacity },
  strokeWidth:    { type: Number,             default: D.strokeWidth },
  strokeColor:    { type: String,             default: D.strokeColor },
  strokeOpacity:  { type: Number,             default: D.strokeOpacity },
  upperKey:       { type: String,             default: D.upperKey },
  lowerKey:       { type: String,             default: D.lowerKey },
  highlighted:    { type: [String, Array],    default: D.highlighted },
  defaultColor:   { type: String,             default: D.defaultColor },
  allowZoom:      { type: Boolean,            default: D.allowZoom },
  maxZoom:        { type: Number,             default: D.maxZoom },
  zoomAxes:       { type: String,             default: D.zoomAxes },
  userZoomAxes:   { type: String,             default: D.userZoomAxes },
  rtl:            { type: Boolean,            default: D.rtl },
  yAxisSide:      { type: String,             default: D.yAxisSide },
});

defineEmits(["hover", "click"]);

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

const yDomain = computed(() =>
  computeFullYDomain(effective.data, {
    max:         effective.max,
    forceValues: effective.forceValues,
    stacked:     effective.stacked,
    keys:        effective.keys,
  }),
);

// Canvas dimensions reported by BaseCanvas via the draw payload.
const canvasWidth  = ref(0);
const canvasHeight = ref(0);
function onCanvasDraw(payload) {
  if (payload?.width  !== canvasWidth.value)  canvasWidth.value  = payload.width;
  if (payload?.height !== canvasHeight.value) canvasHeight.value = payload.height;
}

function makeXAccessor(scaleType, parseTime) {
  if (scaleType === "time") {
    const parse = parseTime ?? ((name) => new Date(String(name)));
    return (d) => parse(d.name);
  }
  return (d) => +d.name;
}

// Chart-level projector.  See LineChart.vue for the rationale around
// width/height sizing and the `(margin + padding)` translate convention.
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
    xNice:      false,
    yNice:      true,
    xDomain:    [xMin, xMax],
    yDomain:    yDomain.value,
    rtl:        effective.rtl,
  });
});


// Layout inheritance for slotted layers — see LineChart for rationale.
provide("chartContext", computed(() => ({
  margin:  resolvedMargin.value,
  padding: resolvedPadding.value,
})));

provide("chartData", computed(() => effective.data));

// Reserved for slotted layers that need to reach into a sibling LineLayer
// (when one is slotted on top of the AreaChart).
provide("lineLayerPaths", shallowRef(null));

// Forward BaseCanvas's programmatic zoom API so callers with a templateRef
// can drive zoom from the outside (scrollytelling, useChartZoom, etc.).
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
