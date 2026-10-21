<template>
  <RoseCanvas
    ref="roseCanvas"
    :duration="duration"
    :highlighted="effectiveHighlighted"
    :margin="margin"
    :start-angle="startAngle"
    :end-angle="endAngle"
    :inner-radius="innerRadius"
    :scale-type="scaleType"
  >
    <template #before>
      <!-- Interactive hit area — covers every segment full-radius -->
      <SegmentLayer
        :data="processedData"
        :max="computedMax"
        :scale-type="scaleType"
        :inner-radius-fn="hitInnerRadiusFn"
        :interactive="true"
        :order="0"
        :fill-color="bgColor"
        :hover-color="hoverBgColor"
        :show-cursor-pointer="showCursorPointer"
        :pad-angle="padAngle"
        :pad-radius="padRadius"
        :stroke-color="bgStrokeColor"
        :stroke-width="strokeWidth"
        :corner-radius="cornerRadius"
        :fill-opacity="fillOpacity"
        :stroke-opacity="fillOpacity"
        @select="onInteractiveSelect"
        @hover="onInteractiveHover"
      />
    </template>
    <RadialGridLayer
      v-if="showGrid"
      :max="computedMax"
      :scale-type="scaleType"
      :order="1"
      :grid-color="gridColor"
      :grid-stroke-dasharray="gridStrokeDasharray"
      :tick-color="tickColor"
    />
    <SegmentLayer
      :data="processedData"
      :series="series"
      :stacked="stacked"
      :max="computedMax"
      :scale-type="scaleType"
      :order="2"
      :layer-id="'segs'"
      :inner-radius-fn="segInnerRadiusFn"
      :outer-radius-fn="segOuterRadiusFn"
      :stroke-color="strokeColor"
      :stroke-width="strokeWidth"
      :fill-opacity="fillOpacity"
      :stroke-opacity="fillOpacity"
      :corner-radius="cornerRadius"
      :pad-angle="padAngle"
      :pad-radius="padRadius"
    />
    <RadialLabelLayer
      :data="processedData"
      :max="computedMax"
      :scale-type="scaleType"
      :order="3"
      :format="format"
      :circular-labels="circularLabels"
      :line-label-distance="lineLabelDistance"
      :padding-line-label="paddingLineLabel"
      :show-values="showValues"
      :value-series="valueSeries"
      :text-color="textColor"
      :value-label-color="valueLabelColor"
      :font-size="fontSize"
      :value-font-size="valueFontSize"
      :font-weight="fontWeight"
      :value-font-weight="valueFontWeight"
      :labels-outside="labelsOutside"
      :show-labels="showLabels"
      :max-label-width="maxLabelWidth"
    />
    <slot />
  </RoseCanvas>
</template>

<script setup>
import { ref, computed } from "vue";
import RoseCanvas from "./RoseCanvas.vue";
import SegmentLayer from "./layers/SegmentLayer.vue";
import RadialGridLayer from "./layers/RadialGridLayer.vue";
import RadialLabelLayer from "./layers/RadialLabelLayer.vue";
import { ROSE_CHART_DEFAULTS as D } from "../presets/RoseChart.defaults.js";

const props = defineProps({
  data:               { type: Array,           default: () => [] },
  duration:           { type: Number,          default: D.duration },
  padAngle:           { type: Number,          default: D.padAngle },
  padRadius:          { type: Number,          default: D.padRadius },
  cornerRadius:       { type: Number,          default: D.cornerRadius },
  labelsOutside:      { type: Boolean,         default: D.labelsOutside },
  circularLabels:     { type: Boolean,         default: D.circularLabels },
  highlighted:        { type: [String, Number], default: D.highlighted },
  hoverBgColor:       { type: String,          default: D.hoverBgColor },
  showCursorPointer:  { type: Boolean,         default: D.showCursorPointer },
  bgColor:            { type: String,          default: D.bgColor },
  bgStrokeColor:      { type: String,          default: D.bgStrokeColor },
  showLabels:         { type: Boolean,         default: D.showLabels },
  showValues:         { type: Boolean,         default: D.showValues },
  valueSeries:        { type: String,          default: D.valueSeries },
  margin:             { type: Number,          default: D.margin },
  startAngle:         { type: Number,          default: D.startAngle },
  endAngle:           { type: Number,          default: D.endAngle },
  max:                { type: Number,          default: D.max },
  maxLabelWidth:      { type: Number,          default: D.maxLabelWidth },
  innerRadius:        { type: Number,          default: D.innerRadius },
  format:             { type: Function,        default: D.format },
  strokeColor:        { type: String,          default: D.strokeColor },
  strokeWidth:        { type: Number,          default: D.strokeWidth },
  lineLabelDistance:  { type: Number,          default: D.lineLabelDistance },
  paddingLineLabel:   { type: Number,          default: D.paddingLineLabel },
  textColor:          { type: String,          default: D.textColor },
  valueLabelColor:    { type: String,          default: D.valueLabelColor },
  fontSize:           { type: String,          default: D.fontSize },
  valueFontSize:      { type: String,          default: D.valueFontSize },
  fontWeight:         { type: String,          default: D.fontWeight },
  valueFontWeight:    { type: String,          default: D.valueFontWeight },
  fillOpacity:        { type: Number,          default: D.fillOpacity },
  scaleType:          { type: String,          default: D.scaleType },
  stacked:            { type: Boolean,         default: D.stacked },
  showGrid:           { type: Boolean,         default: D.showGrid },
  gridColor:          { type: String,          default: D.gridColor },
  gridStrokeDasharray: { type: String,         default: D.gridStrokeDasharray },
  tickColor:          { type: String,          default: D.tickColor },
});

const emit = defineEmits(["select", "hover"]);

const roseCanvas = ref(null);
const hoveredId  = ref(null);

const series = computed(() =>
  Object.entries(props.data[0]?.values ?? {}).map(([key, v]) => ({
    key,
    name:       v.name,
    color:      v.color,
    hoverColor: v.hoverColor ?? null,
  })),
);

// Presets pass original nested data; SegmentLayer handles flattening and stacking internally.
const processedData = computed(() =>
  props.data.map((item, i) => ({ ...item, id: item.id ?? i + 1 })),
);

const computedMax = computed(() => {
  if (props.max) return props.max;
  const raw = props.data;
  if (!raw.length || !raw[0]?.values) return 100;
  const seriesKeys = Object.keys(raw[0].values);
  let max = 0;
  for (const item of raw) {
    let offset = 0;
    for (const key of seriesKeys) {
      const v      = item.values[key];
      const actual = v?.value ?? 0;
      if (props.stacked) {
        max = Math.max(max, offset + actual, offset + (v?.max ?? actual));
        offset += actual;
      } else {
        max = Math.max(max, actual, v?.max ?? 0);
      }
    }
  }
  return max || 100;
});

const effectiveHighlighted = computed(() => hoveredId.value ?? props.highlighted);

// Stable references for the SegmentLayer radius accessors. Defined once at
// setup time so every re-render of RoseChart (e.g. when `hoveredId` flips on
// a hover) passes the SAME function instance to its child SegmentLayers.
// If these were left inlined in the template, Vue would create a new arrow
// closure on every render, the SegmentLayer wrapper's prop watch would see
// "innerRadiusFn changed!", and a spurious `core.rerender` would fire — kicking
// off an 800ms arc transition that, among other things, would overwrite any
// hover/highlight fill via the chained `.attr("fill", fill)`.
const hitInnerRadiusFn  = (_, scale) => scale.range()[0];
const segInnerRadiusFn  = (d, scale) => scale(d.stackOffset ?? 0);
const segOuterRadiusFn  = (d, scale) => scale(d.value ?? 0);

function rawItem(arcData) {
  return props.data.find((item, i) => (item.id ?? i + 1) === arcData.id) ?? arcData;
}

function onInteractiveSelect({ target, data }) {
  emit("select", { target, data: rawItem(data) });
}

function onInteractiveHover(payload) {
  hoveredId.value = payload?.data?.id ?? null;
  if (!payload) { emit("hover", null); return; }
  let target = payload.target;
  if (series.value.length === 1 && roseCanvas.value?.svgEl) {
    const key = series.value[0].key;
    const el  = roseCanvas.value.svgEl.querySelector(`[id="arc-segs-${payload.data.id}__${key}"]`);
    if (el) target = el;
  }
  emit("hover", { target, data: rawItem(payload.data) });
}

defineExpose({
  width:        computed(() => roseCanvas.value?.width),
  height:       computed(() => roseCanvas.value?.height),
  computedMax,
});
</script>
