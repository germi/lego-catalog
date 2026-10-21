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
        :inner-radius-fn="(_, s) => s.range()[0]"
        :interactive="true"
        :order="0"
        :fill-color="bgColor"
        :hover-color="hoverBgColor"
        :show-cursor-pointer="showCursorPointer"
        :pad-angle="padAngle"
        :pad-radius="padRadius"
        :stroke-width="mainLineStrokeWidth"
        :corner-radius="cornerRadius"
        @select="onInteractiveSelect"
        @hover="onInteractiveHover"
      />
      <slot name="before" />
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
    <!-- Confidence bands (min–max) — one arc per category × series -->
    <SegmentLayer
      :data="processedData"
      :series="series"
      :max="computedMax"
      :scale-type="scaleType"
      :order="2"
      :inner-radius-fn="(d, scale) => scale(d.min ?? 0)"
      :outer-radius-fn="(d, scale) => scale(d.max ?? 0)"
      :stroke-color="'transparent'"
      :stroke-width="bandStrokeWidth"
      :fill-opacity="bandOpacity"
      :corner-radius="cornerRadius"
      :pad-angle="padAngle"
      :pad-radius="padRadius"
    />
    <!-- Value lines — one arc per category × series, stroked with data color -->
    <SegmentLayer
      :data="processedData"
      :series="series"
      :max="computedMax"
      :scale-type="scaleType"
      :order="2"
      :layer-id="'lines'"
      :inner-radius-fn="(d, scale) => scale(d.value ?? 0)"
      :outer-radius-fn="(d, scale) => scale(d.value ?? 0)"
      :stroke-width="mainLineStrokeWidth"
      :use-data-color-as-stroke="true"
      :fill-opacity="0"
      :corner-radius="0"
      :pad-angle="padAngle"
      :pad-radius="padRadius"
    />
    <RadialLabelLayer
      :data="processedData"
      :max="computedMax"
      :scale-type="scaleType"
      :order="3"
      :labels-outside="labelsOutside"
      :show-labels="showLabels"
      :max-label-width="maxLabelWidth"
      :show-values="false"
      :min-angle="minAngle"
      :text-color="textColor"
      :circular-labels="circularLabels"
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

import { ROSE_SEGMENT_CHART_DEFAULTS as D } from "../presets/RoseSegmentChart.defaults.js";

const props = defineProps({
  data:                { type: Array,            default: () => [] },
  duration:            { type: Number,           default: D.duration },
  padAngle:            { type: Number,           default: D.padAngle },
  padRadius:           { type: Number,           default: D.padRadius },
  cornerRadius:        { type: Number,           default: D.cornerRadius },
  labelsOutside:       { type: Boolean,          default: D.labelsOutside },
  circularLabels:      { type: Boolean,          default: D.circularLabels },
  highlighted:         { type: [String, Number], default: D.highlighted },
  hoverBgColor:        { type: String,           default: D.hoverBgColor },
  showCursorPointer:   { type: Boolean,          default: D.showCursorPointer },
  bgColor:             { type: String,           default: D.bgColor },
  showLabels:          { type: Boolean,          default: D.showLabels },
  margin:              { type: Number,           default: D.margin },
  startAngle:          { type: Number,           default: D.startAngle },
  endAngle:            { type: Number,           default: D.endAngle },
  max:                 { type: Number,           default: D.max },
  maxLabelWidth:       { type: Number,           default: D.maxLabelWidth },
  innerRadius:         { type: Number,           default: D.innerRadius },
  bandOpacity:         { type: Number,           default: D.bandOpacity },
  bandStrokeWidth:     { type: Number,           default: D.bandStrokeWidth },
  mainLineStrokeWidth: { type: Number,           default: D.mainLineStrokeWidth },
  showGrid:            { type: Boolean,          default: D.showGrid },
  gridColor:           { type: String,           default: D.gridColor },
  gridStrokeDasharray: { type: String,           default: D.gridStrokeDasharray },
  tickColor:           { type: String,           default: D.tickColor },
  textColor:           { type: String,           default: D.textColor },
  minAngle:            { type: Number,           default: D.minAngle },
  stacked:             { type: Boolean,          default: D.stacked },
  scaleType:           { type: String,           default: D.scaleType },
});

const emit = defineEmits(["select", "hover"]);

const roseCanvas = ref(null);
const hoveredId = ref(null);

const series = computed(() =>
  Object.entries(props.data[0]?.values ?? {}).map(([key, v]) => ({
    key,
    name: v.name,
    color: v.color,
    hoverColor: v.hoverColor ?? null,
  })),
);

// Stack multi-series data. RoseSegmentChart always uses stackBy="max" for bands.
const processedData = computed(() => {
  const raw = props.data.map((item, i) => ({ ...item, id: item.id ?? i + 1 }));
  if (!raw.length || !raw[0]?.values) return raw;
  const seriesKeys = Object.keys(raw[0].values);
  return raw.map((item) => {
    let offset = 0;
    const newValues = {};
    for (const key of seriesKeys) {
      const v = item.values[key];
      const actual = v.value ?? 0;
      if (props.stacked) {
        const advance = v.max ?? actual;
        newValues[key] = {
          ...v,
          stackOffset: offset,
          value: offset + actual,
          min: offset,
          max: offset + (v.max ?? actual),
        };
        offset += advance;
      } else {
        newValues[key] = { ...v, stackOffset: 0 };
      }
    }
    return { ...item, values: newValues };
  });
});

const computedMax = computed(() => {
  if (props.max) return props.max;
  let max = 0;
  for (const item of processedData.value) {
    for (const key in item.values ?? {}) {
      const v = item.values[key];
      max = Math.max(max, v.value ?? 0, v.min ?? 0, v.max ?? 0);
    }
  }
  return max || 100;
});

const isSingleSeries = computed(() => series.value.length === 1);
const effectiveHighlighted = computed(
  () => hoveredId.value ?? props.highlighted,
);

function rawItem(arcData) {
  return (
    props.data.find((item, i) => (item.id ?? i + 1) === arcData.id) ?? arcData
  );
}

function onInteractiveSelect({ target, data }) {
  emit("select", { target, data: rawItem(data) });
}

function onInteractiveHover(payload) {
  hoveredId.value = payload?.data?.id ?? null;
  if (!payload) {
    emit("hover", null);
    return;
  }
  let target = payload.target;
  if (isSingleSeries.value && roseCanvas.value?.svgEl) {
    const key = series.value[0].key;
    const el = roseCanvas.value.svgEl.querySelector(
      `[id="arc-lines-${payload.data.id}__${key}"]`,
    );
    if (el) target = el;
  }
  emit("hover", { target, data: rawItem(payload.data) });
}

defineExpose({
  width: computed(() => roseCanvas.value?.width),
  height: computed(() => roseCanvas.value?.height),
  computedMax,
});
</script>
