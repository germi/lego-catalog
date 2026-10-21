<template>
  <BaseCanvas
    ref="canvasRef"
    skip-projection
    :projector="projector"
    :margin="margin"
    :allow-manual-zoom="allowZoom"
    :max-zoom="maxZoom"
    :clamp-pan="clampPan"
    :clamp-pan-inset="clampPanInset"
    :zoom-axes="'x'"
    :duration="duration"
    @draw="onDraw"
  >
    <ScatterLayer
      :order="10"
      :data="positionedData"
      :radius="radiusFn"
      :value-accessor="identityAccessor"
      :dot-opacity="dotOpacity"
      :color="color"
      :color-accessor="colorAccessor"
      :highlighted="highlighted"
      :dim-opacity="dimOpacity"
      :stroke-color="strokeColor"
      :stroke-width="strokeWidth"
      :stroke-opacity="strokeOpacity"
      :hover-scale="hoverScale"
      :sort-by-radius="sortByRadius"
      :duration="duration"
      @hover="onDotHover"
      @click="(e) => emit('select', e)"
    />

    <AxisLayer
      v-if="showValueAxis"
      :order="1"
      side="bottom"
      :margin="margin"
      :show-grid="showGrid"
      :grid-color="gridColor"
      :tick-color="tickColor"
      :tick-text-color="tickTextColor"
      :tick-format="valueTickFormat"
      :num-ticks="valueTicks"
      :duration="duration"
    />

    <!-- Consumer layers (annotations, ref lines, …) share the same canvas. -->
    <slot />
  </BaseCanvas>
</template>

<script setup>
import { computed, ref, shallowRef, watch, useTemplateRef } from "vue";
import * as d3 from "d3";

import BaseCanvas from "./canvas/BaseCanvas.vue";
import ScatterLayer from "./layers/ScatterLayer.vue";
import AxisLayer from "./layers/AxisLayer.vue";

import { makeScaleProjector } from "../utils/projectors/scaleProjector.js";
import { beeswarmLayout } from "../utils/layout/beeswarmLayout.js";
import { BEESWARM_CHART_DEFAULTS as D } from "../presets/BeeswarmChart.defaults.js";

const props = defineProps({
  data: { type: Array, default: () => [] },
  valueAccessor: { type: Function, default: D.valueAccessor },
  valueScaleType: { type: String, default: D.valueScaleType },
  nice: { type: Boolean, default: D.nice },

  radius: { type: [Number, Function], default: D.radius },
  sizeAccessor: { type: Function, default: D.sizeAccessor },
  sizeRange: { type: Array, default: () => [...D.sizeRange] },
  gap: { type: Number, default: D.gap },

  dotOpacity: { type: Number, default: D.dotOpacity },
  color: { default: D.color },
  colorAccessor: { type: Function, default: D.colorAccessor },
  strokeColor: { type: String, default: D.strokeColor },
  strokeWidth: { type: Number, default: D.strokeWidth },
  strokeOpacity: { type: Number, default: D.strokeOpacity },
  hoverScale: { type: Number, default: D.hoverScale },
  sortByRadius: { type: Boolean, default: D.sortByRadius },

  highlighted: { type: [Array, String], default: () => [] },
  dimOpacity: { type: Number, default: D.dimOpacity },

  showValueAxis: { type: Boolean, default: D.showValueAxis },
  valueTicks: { type: Number, default: D.valueTicks },
  valueTickFormat: { type: Function, default: D.valueTickFormat },
  showGrid: { type: Boolean, default: D.showGrid },
  gridColor: { type: String, default: D.gridColor },
  tickColor: { type: String, default: D.tickColor },
  tickTextColor: { type: String, default: D.tickTextColor },

  margin: { type: Object, default: () => ({ ...D.margin }) },
  allowZoom: { type: Boolean, default: D.allowZoom },
  maxZoom: { type: Number, default: D.maxZoom },
  clampPan: { type: Boolean, default: D.clampPan },
  clampPanInset: { type: Object, default: D.clampPanInset },
  duration: { type: Number, default: D.duration },
});

const emit = defineEmits(["hover", "select"]);
const canvasRef = useTemplateRef("canvasRef");

// Normalise ScatterLayer's `{ event, datum }` into the `{ data, target }` shape
// tooltips expect (matches the ScatterPlot voronoi-hover payload).
function onDotHover(e) {
  emit("hover", e ? { data: e.datum, target: e.event?.target, event: e.event } : null);
}

// Inner plot dimensions, reported by BaseCanvas on each draw. The beeswarm layout
// is pixel-based (radius packing), so it needs real dimensions — recompute when
// they (or the data / size / gap) change.
const innerW = ref(0);
const innerH = ref(0);
function onDraw(payload) {
  if (payload?.innerWidth != null && payload.innerWidth !== innerW.value)
    innerW.value = payload.innerWidth;
  if (payload?.innerHeight != null && payload.innerHeight !== innerH.value)
    innerH.value = payload.innerHeight;
}

// The value scale (domain only — makeScaleProjector stamps the range). This drives
// BOTH the x-axis (via the projector) AND the layout's along-axis positions, so
// dots land exactly on their axis value.
const valueScale = computed(() => {
  const vals = props.data.map(props.valueAccessor).filter((v) => v != null && isFinite(v));
  const base = props.valueScaleType === "log" ? d3.scaleLog() : d3.scaleLinear();
  if (!vals.length) return base.domain([0, 1]);
  let [lo, hi] = d3.extent(vals);
  if (props.valueScaleType === "log") lo = Math.max(lo, 1e-9);
  const s = base.domain([lo, hi]);
  return props.nice ? s.nice() : s;
});

// The beeswarm `radius` contract is DATUM-based (`(d) => px`) — matching both the
// layout and the documented preset prop. ScatterLayer calls a radius function with
// `valueAccessor(d)`, so we hand it the datum itself (stable ref → no re-render churn).
const identityAccessor = (d) => d;

// Resolved radius `(d) => px`: a sqrt size scale when `sizeAccessor` is set,
// else the fixed/`radius` prop. Used for BOTH the collision layout and the dots.
const radiusFn = computed(() => {
  if (props.sizeAccessor) {
    const sizes = props.data.map(props.sizeAccessor).filter((v) => v != null && isFinite(v));
    const scale = d3.scaleSqrt().domain(sizes.length ? d3.extent(sizes) : [0, 1]).range(props.sizeRange);
    return (d) => scale(props.sizeAccessor(d));
  }
  if (typeof props.radius === "function") return props.radius;
  const r = props.radius;
  return () => r;
});

// Positioned data — each datum gets a `_perp` (perpendicular pixel). Recomputed
// synchronously (the sim runs to completion) whenever an input changes. The result
// isn't a watched input, so it doesn't re-trigger the layout: it settles in one
// extra draw once the dimensions are known.
const positionedData = shallowRef(props.data);
function recompute() {
  const w = innerW.value, h = innerH.value;
  if (!w || !h || !props.data.length) { positionedData.value = props.data; return; }
  const along = valueScale.value.copy().range([0, w]);
  const perp = beeswarmLayout(props.data, {
    along: (d) => along(props.valueAccessor(d)),
    radius: radiusFn.value,
    center: h / 2,
    gap: props.gap,
  });
  positionedData.value = props.data.map((d, i) => ({ ...d, _perp: perp[i] }));
}
watch(
  [innerW, innerH, () => props.data, () => props.gap, radiusFn, valueScale],
  recompute,
  { immediate: true },
);

// Dot projector — x via the value scale (so the axis is real + zooms), y via an
// identity-ish linear scale reading the pre-computed `_perp` pixel.
const projector = computed(() => {
  const w = innerW.value, h = innerH.value;
  if (!w || !h || !positionedData.value.length) return null;
  return makeScaleProjector({
    data: positionedData.value,
    width: w,
    height: h,
    xAccessor: props.valueAccessor,
    yAccessor: (d) => d._perp,
    xScale: valueScale.value,
    yScale: d3.scaleLinear().domain([0, h]),
    nice: false,
  });
});

defineExpose({
  zoomIn: (...a) => canvasRef.value?.zoomIn(...a),
  zoomOut: (...a) => canvasRef.value?.zoomOut(...a),
  resetZoom: (...a) => canvasRef.value?.resetZoom(...a),
  redraw: (d) => canvasRef.value?.redraw(d),
});
</script>
