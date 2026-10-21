<template>
  <BaseCanvas
    :skip-projection="true"
    :projector="chartProjector"
    :duration="effective.duration"
    :zoom-axes="effective.zoomAxes ?? 'x'"
    :allow-manual-zoom="effective.allowZoom"
    :max-zoom="effective.maxZoom"
    :clamp-pan="effective.allowZoom"
    :clamp-pan-inset="clampPanInset"
    class="ribbon-container"
    v-bind="$attrs"
    @draw="onCanvasDraw"
  >
    <!-- Y-axis — side resolved from yAxisSide + rtl -->
    <YAxisLayer
      v-if="effective.showYAxis"
      :order="1"
      :side="resolvedYSide"
      :show-grid="true"
      :data="rtlData"
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

    <RibbonLayer
      :order="2"
      :data="rtlData"
      :scale-type="effective.scaleType"
      :color="effective.color"
      :rect-style="effective.rectStyle"
      :margin="resolvedMargin"
      :padding="resolvedPadding"
      :max="effective.max"
      :duration="effective.duration"
      :ease="effective.ease"
      :padding-inner="effective.paddingInner"
      :padding-outer="effective.paddingOuter"
      :bg-color="effective.bgColor"
      :format="effective.format"
      :stacked="effective.stacked"
      :keys="effective.keys"
      :use-curves="effective.useCurves"
      :use-lines="effective.useLines"
      :link-opacity="effective.linkOpacity"
      :link-dim-opacity="effective.linkDimOpacity"
      :show-links="effective.showLinks"
      :highlighted="effective.highlighted"
      :highlight-fill="effective.highlightFill"
      :highlight-fill-opacity="effective.highlightFillOpacity"
      :highlight-stroke-color="effective.highlightStrokeColor"
      :highlight-stroke-width="effective.highlightStrokeWidth"
      :highlight-stroke-opacity="effective.highlightStrokeOpacity"
      :dim-fill="effective.dimFill"
      :dim-opacity="effective.dimOpacity"
      :dim-stroke-color="effective.dimStrokeColor"
      :dim-stroke-width="effective.dimStrokeWidth"
      :dim-stroke-opacity="effective.dimStrokeOpacity"
      @select="$emit('select', $event)"
      @hover="$emit('hover', $event)"
    />
    <!-- Bottom X-axis -->
    <AxisLayer
      v-if="effective.showXAxis"
      :order="3"
      side="bottom"
      :phased="true"
      :data="rtlData"
      :margin="resolvedMargin"
      :padding="resolvedPadding"
      :max="effective.max"
      :stacked="effective.stacked"
      :tick-values="effective.xTickValues"
      :tick-format="xTickFormat"
      :tick-angle="effective.xTickAngle"
      :tick-font-size="effective.xTickFontSize"
      :tick-stagger="effective.xTickStagger"
      :tick-color="effective.xTickColor"
      :tick-text-color="effective.xTickTextColor"
      :padding-inner="effective.paddingInner"
      :padding-outer="effective.paddingOuter"
      :ease="effective.ease"
      :duration="effective.duration"
    />

    <EditChart
      v-if="editMode"
      :effective="effective"
      :defaults="D"
      :meta="RIBBON_CHART_META"
      :overrides="overrides"
      @set="(k, v) => (overrides[k] = v)"
      @reset="(k) => delete overrides[k]"
      @reset-all="Object.keys(overrides).forEach((k) => delete overrides[k])"
    />

    <slot />
  </BaseCanvas>
</template>

<script setup>
import * as d3 from "d3";
import { computed, ref, provide } from "vue";
import BaseCanvas from "./canvas/BaseCanvas.vue";
import AxisLayer from "./layers/AxisLayer.vue";
import YAxisLayer from "./layers/YAxisLayer.vue";
import RibbonLayer from "./layers/RibbonLayer.vue";
import EditChart from "./EditChart.vue";
import { useEditMode } from "../utils/editMode.js";
import { useEditableProps } from "../utils/editableProps.js";
import { makeScaleProjector } from "../utils/projectors/scaleProjector.js";
import { computeMax } from "../utils/scale/computeMax.js";
import { resolveInline, resolveSpacing } from "../utils/resolveInline.js";
import {
  RIBBON_CHART_DEFAULTS as D,
  RIBBON_CHART_META,
} from "../presets/RibbonChart.defaults.js";

// -- PROPS --
const props = defineProps({
  data:           { type: Array,            default: () => D.data },
  color:          { type: Object,           default: () => ({ ...D.color }) },
  rectStyle:      { type: Object,           default: () => ({ ...D.rectStyle }) },
  margin:         { type: Object,           default: () => ({ ...D.margin }) },
  padding:        { type: Object,           default: () => ({ ...D.padding }) },
  max:            { type: Number,           default: D.max },
  scaleType:      { type: String,           default: D.scaleType },
  duration:       { type: Number,           default: D.duration },
  ease:           { type: String,           default: D.ease },
  showXAxis:      { type: Boolean,          default: D.showXAxis },
  showYAxis:      { type: Boolean,          default: D.showYAxis },
  yTickValues:    { type: Array,            default: D.yTickValues },
  xTickValues:    { type: Array,            default: D.xTickValues },
  xTickAngle:     { type: Number,           default: D.xTickAngle },
  xTickFontSize:  { type: Number,           default: D.xTickFontSize },
  xTickStagger:   { type: Number,           default: D.xTickStagger },
  xTickColor:     { type: String,           default: D.xTickColor },
  xTickTextColor: { type: String,           default: D.xTickTextColor },
  paddingInner:   { type: Number,           default: D.paddingInner },
  paddingOuter:   { type: Number,           default: D.paddingOuter },
  bgColor:        { type: String,           default: D.bgColor },
  format:         { type: Function,         default: D.format },
  stacked:        { type: Boolean,          default: D.stacked },
  yNumTicks:      { type: Number,           default: D.yNumTicks },
  yTickSize:      { type: Number,           default: D.yTickSize },
  yTickColor:     { type: String,           default: D.yTickColor },
  yTickTextColor: { type: String,           default: D.yTickTextColor },
  yGridColor:     { type: String,           default: D.yGridColor },
  yGridDasharray: { type: String,           default: D.yGridDasharray },
  yGridOpacity:   { type: Number,           default: D.yGridOpacity },
  keys:           { type: Array,            default: D.keys },
  useCurves:      { type: Boolean,          default: D.useCurves },
  useLines:       { type: Boolean,          default: D.useLines },
  linkOpacity:    { type: Number,           default: D.linkOpacity },
  linkDimOpacity: { type: Number,           default: D.linkDimOpacity },
  showLinks:      { type: Boolean,          default: D.showLinks },
  highlighted:            { type: [String, Array], default: D.highlighted },
  highlightFill:          {                         default: D.highlightFill },
  highlightFillOpacity:   { type: Number,           default: D.highlightFillOpacity },
  highlightStrokeColor:   {                         default: D.highlightStrokeColor },
  highlightStrokeWidth:   { type: Number,           default: D.highlightStrokeWidth },
  highlightStrokeOpacity: { type: Number,           default: D.highlightStrokeOpacity },
  dimFill:                {                         default: D.dimFill },
  dimOpacity:             { type: Number,           default: D.dimOpacity },
  dimStrokeColor:         {                         default: D.dimStrokeColor },
  dimStrokeWidth:         { type: Number,           default: D.dimStrokeWidth },
  dimStrokeOpacity:       { type: Number,           default: D.dimStrokeOpacity },
  allowZoom:      { type: Boolean,          default: D.allowZoom },
  maxZoom:        { type: Number,           default: D.maxZoom },
  zoomAxes:       { type: String,           default: D.zoomAxes },
  rtl:            { type: Boolean,          default: D.rtl },
  yAxisSide:      { type: String,           default: D.yAxisSide },
});

defineEmits(["select", "hover"]);

const editMode = useEditMode();
const { overrides, effective } = useEditableProps(props, D);

// RTL resolution — resolve logical start/end margins/paddings and axis side
// to physical left/right values once, then pass physical values everywhere.
// With rtl:false (default) resolveSpacing is identity — byte-for-byte unchanged.
const resolvedMargin  = computed(() => resolveSpacing(effective.margin,  effective.rtl));
const resolvedPadding = computed(() => resolveSpacing(effective.padding, effective.rtl));
const resolvedYSide   = computed(() => resolveInline(effective.yAxisSide ?? "start", effective.rtl));

// For RTL, reverse the data array so bar/link/axis rendering (which uses
// LTR-semantics throughout) produces a mirrored layout without touching any
// layer internals. Links always connect inner physical edges of adjacent bars,
// which stays correct because the adjacency order is now the visual RTL order.
const rtlData = computed(() =>
  effective.rtl ? [...effective.data].reverse() : effective.data,
);

// Inset passed to BaseCanvas so clampPan knows the actual data area width/height.
const clampPanInset = computed(() => {
  const m = resolvedMargin.value;
  const p = resolvedPadding.value;
  return {
    x: m.left + m.right + p.left + p.right,
    y: m.top  + m.bottom + p.top  + p.bottom,
  };
});

// X-axis tick formatter: maps category IDs to their display names.
// Uses props.data directly since the data prop is not editable through the popup.
//
// The formatter FUNCTION must keep a STABLE identity across data changes — if it
// changed every swap (e.g. an inline `computed(() => (d) => props.data.find…)`),
// AxisLayer's `tickFormat` watcher would fire a second render alongside the
// projector's draw and snap the x-axis ticks, breaking the phased slide that
// keeps the labels in lockstep with the bars. So: a reactive id→name LOOKUP, and
// a plain (stable) function that reads it at call time.
const nameById = computed(() => {
  const map = {};
  for (const e of props.data) map[e.id] = e.name;
  return map;
});
function xTickFormat(d) {
  return nameById.value[d] ?? d;
}

// ── Scale projector for SLOTTED layers (RefLineLayer / RefAreaLayer) ─────────
//
// IMPORTANT — additive, read-only for slotted layers only. RibbonLayer,
// YAxisLayer and AxisLayer keep computing their OWN scales (they ignore
// payload.projector); the projector is purely so a slotted reference layer
// can read the same x/y space. This mirrors LineChart / ScatterPlot so every
// cartesian preset exposes a projector.
//
// y-domain uses computeMax + nice:true to match YAxisLayer's gridline scale
// (a reference line is read against the GRIDLINES, not the raw bar tops). x is
// a band scale over the category ids — fine for horizontal lines (they use the
// x-extent only); vertical/per-category lines would be slightly off because
// the band padding isn't threaded (see ribbon-chart-projector-plan.md).
//
// ⚠️ ANIMATION CONTRACT: passing :projector makes BaseCanvas.setProjector fire
// a draw on every data change, which hits RibbonLayer's draw watcher IN
// ADDITION to its data watcher → a double render that can snap the
// entering-category animation. RibbonLayer itself is untouched here. If the
// "Toggle data" animation snaps after this, the fix is to align RibbonLayer's
// data flow with LineLayer (data through the draw, not a separate watcher) —
// do NOT paper over it in the projector. See the plan doc.
const canvasWidth  = ref(0);
const canvasHeight = ref(0);
function onCanvasDraw(payload) {
  if (payload?.width  !== canvasWidth.value)  canvasWidth.value  = payload.width;
  if (payload?.height !== canvasHeight.value) canvasHeight.value = payload.height;
}

const chartProjector = computed(() => {
  const data = rtlData.value;
  if (!data?.length) return null;
  const m = resolvedMargin.value;
  const p = resolvedPadding.value;
  const w = Math.max(0, canvasWidth.value  - m.left - m.right  - p.left - p.right);
  const h = Math.max(0, canvasHeight.value - m.top  - m.bottom - p.top  - p.bottom);
  if (!w || !h) return null;

  // Build the band x-scale with the SAME paddingInner/paddingOuter as
  // RibbonLayer. makeScaleProjector will reverse the domain when rtl:true
  // so bars and axis ticks mirror automatically.
  const xBand = d3.scaleBand()
    .domain(data.map((d) => d.id))
    .paddingInner(effective.paddingInner)
    .paddingOuter(effective.paddingOuter);

  return makeScaleProjector({
    width:      w,
    height:     h,
    xScale:     xBand,
    yScaleType: effective.scaleType ?? "linear",
    yNice:      true,
    yDomain:    [0, computeMax(data, { max: effective.max, stacked: effective.stacked })],
    rtl:        effective.rtl,
  });
});

// Layout inheritance for slotted layers — mirror LineChart. A slotted
// RefLineLayer/RefAreaLayer reads its margin/padding from this when it has no
// explicit props of its own. (The retire-chartcontext plan will eventually
// fold margin onto payload.margin and resolve padding centrally; until then
// every cartesian preset provides it the same way for consistency.)
provide("chartContext", computed(() => ({
  margin:  resolvedMargin.value,
  padding: resolvedPadding.value,
})));
provide("chartData", computed(() => effective.data));
</script>
