<template>
  <!--
    DonutChart preset: concentric rings where data drives slice angles.
    Same data shape as RoseChart ({id, name, values: {key: {value, color}}}).
    Each series becomes a ring. The radial space between innerRadius and
    the chart edge is divided equally among series, with optional ringGap.
  -->
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
      <!-- Interactive hit area — default mode only: full radius, proportional angles per category -->
      <SegmentLayer
        v-if="!isTransposed"
        :data="processedData"
        mode="angle"
        :angle-value="totalAngleValue"
        :inner-radius-fn="(_, s) => s.range()[0]"
        :outer-radius-fn="(_, s) => s.range()[1]"
        :interactive="true"
        :order="0"
        :fill-color="bgColor"
        :hover-color="hoverBgColor"
        :show-cursor-pointer="showCursorPointer"
        :pad-angle="padAngle"
        :pad-radius="padRadius"
        :stroke-width="0"
        :corner-radius="cornerRadius"
        @select="onInteractiveSelect"
        @hover="onInteractiveHover"
      />
    </template>
    <SegmentLayer
      :data="processedData"
      :series="series"
      mode="angle"
      :inner-radius-fn="seriesRingInnerFn"
      :outer-radius-fn="seriesRingOuterFn"
      :stroke-color="strokeColor"
      :stroke-width="strokeWidth"
      :fill-opacity="fillOpacity"
      :corner-radius="cornerRadius"
      :pad-angle="padAngle"
      :pad-radius="padRadius"
      :order="2"
      :layer-id="'segs'"
      :interactive="isTransposed"
      :show-cursor-pointer="showCursorPointer"
      @select="onInteractiveSelect"
      @hover="onInteractiveHover"
    />
    <RadialLabelLayer
      :data="labelData"
      mode="angle"
      :angle-value="labelAngleValue"
      :labels-outside="labelsOutside"
      :show-labels="showLabels"
      :max-label-width="maxLabelWidth"
      :show-values="showValues"
      :format="format"
      :circular-labels="circularLabels"
      :value-label-color="valueLabelColor"
      :text-color="textColor"
      :order="3"
    />
    <slot />
  </RoseCanvas>
</template>

<script setup>
import { ref, computed } from "vue";
import RoseCanvas from "./RoseCanvas.vue";
import SegmentLayer from "./layers/SegmentLayer.vue";
import RadialLabelLayer from "./layers/RadialLabelLayer.vue";
import { DONUT_CHART_DEFAULTS as D } from "../presets/DonutChart.defaults.js";

const props = defineProps({
  data:               { type: Array,            default: () => [] },
  duration:           { type: Number,           default: D.duration },
  padAngle:           { type: Number,           default: D.padAngle },
  padRadius:          { type: Number,           default: D.padRadius },
  cornerRadius:       { type: Number,           default: D.cornerRadius },
  labelsOutside:      { type: Boolean,          default: D.labelsOutside },
  circularLabels:     { type: Boolean,          default: D.circularLabels },
  highlighted:        { type: [String, Number], default: D.highlighted },
  hoverBgColor:       { type: String,           default: D.hoverBgColor },
  showCursorPointer:  { type: Boolean,          default: D.showCursorPointer },
  bgColor:            { type: String,           default: D.bgColor },
  showLabels:         { type: Boolean,          default: D.showLabels },
  showValues:         { type: Boolean,          default: D.showValues },
  margin:             { type: Number,           default: D.margin },
  startAngle:         { type: Number,           default: D.startAngle },
  endAngle:           { type: Number,           default: D.endAngle },
  max:                { type: Number,           default: D.max },
  maxLabelWidth:      { type: Number,           default: D.maxLabelWidth },
  innerRadius:        { type: Number,           default: D.innerRadius },
  format:             { type: Function,         default: D.format },
  strokeColor:        { type: String,           default: D.strokeColor },
  strokeWidth:        { type: Number,           default: D.strokeWidth },
  fillOpacity:        { type: Number,           default: D.fillOpacity },
  scaleType:          { type: String,           default: D.scaleType },
  valueLabelColor:    { type: String,           default: D.valueLabelColor },
  textColor:          { type: String,           default: D.textColor },
  ringGap:            { type: Number,           default: D.ringGap },
  groupBy:            { type: String,           default: D.groupBy },
});

const emit = defineEmits(["select", "hover"]);

const roseCanvas = ref(null);
const hoveredId = ref(null);

// -- SERIES EXTRACTION --

const rawSeries = computed(() =>
  Object.entries(props.data[0]?.values ?? {}).map(([key, v]) => ({
    key,
    name: v.name,
    color: v.color,
    hoverColor: v.hoverColor ?? null,
  })),
);

// -- BASE DATA --

const baseData = computed(() =>
  props.data.map((item, i) => ({ ...item, id: item.id ?? i + 1 })),
);

// -- TRANSPOSITION --
// When groupBy="category", swap axes: original categories → series (rings),
// original series → data items (segments within each ring).
// SegmentLayer sees a normal series-per-ring donut either way.

const isTransposed = computed(() => props.groupBy === "category");

const processedData = computed(() => {
  if (!isTransposed.value) return baseData.value;
  // Transpose: one data item per original series
  return rawSeries.value.map((s) => ({
    id: s.key,
    name: s.name,
    values: Object.fromEntries(
      baseData.value.map((cat) => {
        const sv = cat.values?.[s.key] ?? {};
        return [
          String(cat.id),
          {
            id: String(cat.id),
            name: cat.name,
            value: sv.value ?? 0,
            color: sv.color ?? s.color ?? null,
            hoverColor: sv.hoverColor ?? s.hoverColor ?? null,
            // Preserve per-category series order so the transposed donut's
            // per-ring segment order can follow it (see SegmentLayer donut
            // branch + resolveRingOrder).
            order: sv.order,
          },
        ];
      }),
    ),
  }));
});

const series = computed(() => {
  if (!isTransposed.value) return rawSeries.value;
  // Transpose: one series (ring) per original category
  return baseData.value.map((cat) => ({
    key: String(cat.id),
    name: cat.name,
    color: null,
    hoverColor: null,
  }));
});

// -- ANGLE VALUE --
// Interactive layer + labels use the sum across all series per category.

const totalAngleValue = (d) => {
  if (!d.values) return d.value ?? 0;
  return series.value.reduce(
    (sum, s) => sum + (d.values[s.key]?.value ?? 0),
    0,
  );
};

// -- LABEL DATA --
// Labels use processedData so they show category names in default mode and
// series names in transposed mode (processedData items are the original series).
// Angular position matches the outermost ring (last series) so labels align
// with the visible segments rather than with a summed/averaged distribution.

const labelData = computed(() => processedData.value);

const labelAngleValue = computed(() => {
  const last = series.value[series.value.length - 1];
  return (d) => {
    if (!d.values || !last) return d.value ?? 0;
    return d.values[last.key]?.value ?? 0;
  };
});

// -- RING RADIUS FUNCTIONS --
// Divide the radial space [innerR, outerR] equally among N rings with gaps.

const ringCount = computed(() => series.value.length || 1);

// Computed refs so SegmentLayer re-draws when the ring count changes.

const seriesRingInnerFn = computed(() => {
  const n   = ringCount.value;
  const gap = props.ringGap;
  return (d, scale) => {
    const [minR, maxR] = scale.range();
    const totalGap  = Math.max(0, n - 1) * gap;
    const ringWidth = (maxR - minR - totalGap) / n;
    return minR + d.ringIdx * (ringWidth + gap);
  };
});

const seriesRingOuterFn = computed(() => {
  const n   = ringCount.value;
  const gap = props.ringGap;
  return (d, scale) => {
    const [minR, maxR] = scale.range();
    const totalGap  = Math.max(0, n - 1) * gap;
    const ringWidth = (maxR - minR - totalGap) / n;
    return minR + d.ringIdx * (ringWidth + gap) + ringWidth;
  };
});

// -- INTERACTION --

const effectiveHighlighted = computed(
  () => hoveredId.value ?? props.highlighted,
);

function rawItem(arcData) {
  // SegmentLayer emits composite IDs ("catId__seriesKey").
  // In transposed mode, the SegmentLayer's categoryId is the original series key
  // and seriesKey is the original category id — reverse the lookup.
  if (isTransposed.value) {
    const catId = arcData.seriesKey;
    return (
      props.data.find((item, i) => String(item.id ?? i + 1) === String(catId)) ?? arcData
    );
  }
  const lookupId = arcData.categoryId ?? arcData.id;
  return (
    props.data.find((item, i) => (item.id ?? i + 1) === lookupId) ?? arcData
  );
}

function onInteractiveSelect({ target, data }) {
  emit("select", { target, data: rawItem(data) });
}

function onInteractiveHover(payload) {
  if (!payload) {
    hoveredId.value = null;
    emit("hover", null);
    return;
  }
  hoveredId.value = payload.data?.categoryId ?? payload.data?.id ?? null;
  emit("hover", { target: payload.target, data: rawItem(payload.data) });
}

defineExpose({
  width: computed(() => roseCanvas.value?.width),
  height: computed(() => roseCanvas.value?.height),
});
</script>
