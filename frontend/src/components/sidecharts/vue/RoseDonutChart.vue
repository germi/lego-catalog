<template>
  <!--
    RoseDonutChart — unified preset.

    mode="rose"  (default): equal angles per category, value drives radius.
                            Supports stacking, grid, and confidence bands.
    mode="donut":           equal-width rings, value drives arc angle.
                            group-by="series"  → one ring per series   (default)
                            group-by="category"→ one ring per category (transposed)

    Interactive layer is intentionally omitted for now.
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
    <RadialGridLayer
      v-if="showGrid && props.mode === 'rose'"
      :max="computedMax"
      :scale-type="scaleType"
      :order="1"
      :grid-color="gridColor"
      :grid-stroke-dasharray="gridStrokeDasharray"
      :tick-color="tickColor"
    />
    <SegmentLayer
      v-for="s in seriesLayers"
      :key="s.key"
      :data="s.data"
      :mode="s.layerMode"
      :max="computedMax"
      :scale-type="scaleType"
      :angle-value="s.angleValue"
      :precomputed-angles="s.precomputedAngles ?? false"
      :inner-radius-fn="s.innerFn"
      :outer-radius-fn="s.outerFn"
      :stroke-color="strokeColor"
      :stroke-width="strokeWidth"
      :fill-opacity="fillOpacity"
      :corner-radius="cornerRadius"
      :pad-angle="padAngle"
      :pad-radius="padRadius"
      :order="2"
      :layer-id="`rd-${s.key}`"
    />
    <RadialLabelLayer
      :data="processedData"
      :mode="props.mode === 'donut' ? 'angle' : undefined"
      :angle-value="props.mode === 'donut' ? totalAngleValue : undefined"
      :max="computedMax"
      :scale-type="scaleType"
      :format="format"
      :circular-labels="circularLabels"
      :line-label-distance="lineLabelDistance"
      :padding-line-label="paddingLineLabel"
      :show-values="showValues"
      :value-label-color="valueLabelColor"
      :labels-outside="labelsOutside"
      :show-labels="showLabels"
      :max-label-width="maxLabelWidth"
      :order="3"
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

const props = defineProps({
  data:              { type: Array,    default: () => [] },
  // "rose" = radius-driven, "donut" = angle-driven
  mode:              { type: String,   default: "rose" },
  // donut only: "series" = one ring per series, "category" = one ring per category
  groupBy:           { type: String,   default: "series" },
  duration:          { type: Number,   default: 500 },
  padAngle:          { type: Number,   default: 0 },
  padRadius:         { type: Number,   default: 0.25 },
  cornerRadius:      { type: Number,   default: 0 },
  labelsOutside:     { type: Boolean,  default: true },
  circularLabels:    { type: Boolean,  default: false },
  highlighted:       { type: [String, Number], default: null },
  showLabels:        { type: Boolean,  default: true },
  showValues:        { type: Boolean,  default: false },
  margin:            { type: Number,   default: 5 },
  startAngle:        { type: Number,   default: 0 },
  endAngle:          { type: Number,   default: 360 },
  max:               { type: Number,   default: null },
  maxLabelWidth:     { type: Number,   default: 150 },
  innerRadius:       { type: Number,   default: 0 },
  format:            { type: Function, default: (d) => (+d).toFixed(0) },
  strokeColor:       { type: String,   default: "white" },
  strokeWidth:       { type: Number,   default: 4 },
  fillOpacity:       { type: Number,   default: 1 },
  scaleType:         { type: String,   default: "linear" },
  valueLabelColor:   { type: String,   default: "#6b7280" },
  // rose only
  stacked:           { type: Boolean,  default: false },
  showGrid:          { type: Boolean,  default: false },
  gridColor:         { type: String,   default: "gray" },
  gridStrokeDasharray: { type: String, default: "4,4" },
  tickColor:         { type: String,   default: "#6b7280" },
  lineLabelDistance: { type: Number,   default: 20 },
  paddingLineLabel:  { type: Number,   default: 40 },
  // donut only
  ringGap:           { type: Number,   default: 2 },
});

const emit = defineEmits(["select", "hover"]);

const roseCanvas = ref(null);
const hoveredId  = ref(null);

// -- SERIES --

const series = computed(() =>
  Object.entries(props.data[0]?.values ?? {}).map(([key, v]) => ({
    key,
    name:       v.name,
    color:      v.color,
    hoverColor: v.hoverColor ?? null,
  })),
);

// -- PROCESSED DATA --
// Rose mode: applies stacking offsets.
// Donut mode: no stacking, each series is its own ring.

const processedData = computed(() => {
  const raw = props.data.map((item, i) => ({ ...item, id: item.id ?? i + 1 }));
  if (props.mode !== "rose" || !raw.length || !raw[0]?.values) return raw;
  return raw.map((item) => {
    let offset = 0;
    const newValues = {};
    for (const key of Object.keys(item.values)) {
      const v      = item.values[key];
      const actual = v.value ?? 0;
      if (props.stacked) {
        newValues[key] = { ...v, stackOffset: offset, value: offset + actual, min: offset, max: offset + (v.max ?? actual) };
        offset += actual;
      } else {
        newValues[key] = { ...v, stackOffset: 0 };
      }
    }
    return { ...item, values: newValues };
  });
});

// -- MAX (rose mode) --

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

// -- RING RADIUS FUNCTIONS (donut mode) --
// Divide [innerR, outerR] equally among N rings with pixel gaps.

const ringCount = computed(() => {
  if (props.mode !== "donut") return 1;
  return props.groupBy === "category"
    ? processedData.value.length
    : series.value.length || 1;
});

function makeRingInnerFn(idx) {
  return (_, scale) => {
    const [minR, maxR] = scale.range();
    const n = ringCount.value;
    const totalGap = Math.max(0, n - 1) * props.ringGap;
    const ringWidth = (maxR - minR - totalGap) / n;
    return minR + idx * (ringWidth + props.ringGap);
  };
}

function makeRingOuterFn(idx) {
  return (_, scale) => {
    const [minR, maxR] = scale.range();
    const n = ringCount.value;
    const totalGap = Math.max(0, n - 1) * props.ringGap;
    const ringWidth = (maxR - minR - totalGap) / n;
    return minR + idx * (ringWidth + props.ringGap) + ringWidth;
  };
}

// -- TOTAL ANGLE VALUE (donut mode, for label layer) --

const totalAngleValue = (d) => {
  if (!d.values) return d.value ?? 0;
  return series.value.reduce((sum, s) => sum + (d.values[s.key]?.value ?? 0), 0);
};

// -- SERIES LAYERS --

const seriesLayers = computed(() => {
  if (props.mode === "donut") {
    if (props.groupBy === "category") {
      // Keep 3 layers × 6 items (same structure as other modes) for smooth transitions.
      // Each layer = one series. Each item = one category, placed in its category's ring.
      // Angles are pre-computed per (category, series) pair: each category's 360° is
      // divided proportionally among series and stacked angularly.

      const n = processedData.value.length; // categories = rings

      // Category id → ring index for O(1) lookup inside the radius fns.
      const catIdToIdx = Object.fromEntries(
        processedData.value.map((c, i) => [c.id, i]),
      );

      // Per-category cumulative angle fractions: { catId → { seriesKey → { start, end } } }
      const angleMap = Object.fromEntries(
        processedData.value.map((category) => {
          const total = series.value.reduce(
            (sum, s) => sum + (category.values?.[s.key]?.value ?? 0), 0,
          ) || 1;
          let offset = 0;
          const fractions = Object.fromEntries(
            series.value.map((s) => {
              const val = category.values?.[s.key]?.value ?? 0;
              const entry = [s.key, { start: offset / total, end: (offset + val) / total }];
              offset += val;
              return entry;
            }),
          );
          return [category.id, fractions];
        }),
      );

      // Radius fns: each item d goes into its category's ring, not its layer's ring.
      function catRingInner(d, scale) {
        const idx = catIdToIdx[d.id] ?? 0;
        const [minR, maxR] = scale.range();
        const totalGap = Math.max(0, n - 1) * props.ringGap;
        const ringWidth = (maxR - minR - totalGap) / n;
        return minR + idx * (ringWidth + props.ringGap);
      }
      function catRingOuter(d, scale) {
        const idx = catIdToIdx[d.id] ?? 0;
        const [minR, maxR] = scale.range();
        const totalGap = Math.max(0, n - 1) * props.ringGap;
        const ringWidth = (maxR - minR - totalGap) / n;
        return minR + idx * (ringWidth + props.ringGap) + ringWidth;
      }

      const TAU = 2 * Math.PI;

      return series.value.map((s) => ({
        key:               s.key,
        layerMode:         "angle",
        precomputedAngles: true,
        angleValue:        null,
        innerFn:           catRingInner,
        outerFn:           catRingOuter,
        data: processedData.value.map((category) => {
          const v    = category.values?.[s.key] ?? {};
          const frac = angleMap[category.id]?.[s.key] ?? { start: 0, end: 0 };
          return {
            ...category,
            color:       v.color      ?? s.color,
            hoverColor:  v.hoverColor ?? s.hoverColor ?? null,
            _startAngle: frac.start * TAU,
            _endAngle:   frac.end   * TAU,
          };
        }),
      }));
    }
    // One ring per series, segments = categories
    return series.value.map((s, idx) => ({
      key:        s.key,
      layerMode:  "angle",
      angleValue: (d) => d.values[s.key]?.value ?? 0,
      innerFn:    makeRingInnerFn(idx),
      outerFn:    makeRingOuterFn(idx),
      data: processedData.value.map((d) => ({
        ...d,
        color:      d.values?.[s.key]?.color ?? d.color ?? s.color,
        hoverColor: d.values?.[s.key]?.hoverColor ?? d.hoverColor ?? s.hoverColor,
      })),
    }));
  }

  // Rose mode — one layer per series, radius-driven
  return series.value.map((s) => ({
    key:        s.key,
    layerMode:  "radius",
    angleValue: null,
    innerFn:    (d, scale) => scale(d.values[s.key]?.stackOffset ?? 0),
    outerFn:    (d, scale) => scale(d.values[s.key]?.value ?? 0),
    data: processedData.value.map((d) => ({
      ...d,
      color:      s.color      ?? d.color,
      hoverColor: s.hoverColor ?? d.hoverColor,
    })),
  }));
});

// -- INTERACTION --

const effectiveHighlighted = computed(() => hoveredId.value ?? props.highlighted);

defineExpose({
  width:       computed(() => roseCanvas.value?.width),
  height:      computed(() => roseCanvas.value?.height),
  computedMax,
});
</script>
