<template>
  <ScatterPlot
    ref="hostRef"
    :data="data"
    :margin="chartMargin"
    :x-accessor="xAccessor"
    :y-accessor="yAccessor"
    :value-accessor="rAccessor"
    :x-scale-type="xScaleType"
    :y-scale-type="yScaleType"
    :color="liveColor"
    :color-accessor="colorAccessor"
    :label-accessor="labelAccessor"
    :highlighted="highlighted"
    :selected="selected"
    :dot-opacity="dotOpacity"
    :dot-size="dotSize"
    :r-scale-type="rScaleType"
    :show-grid="showGrid"
    :show-hover="showHover"
    :show-labels="showLabels"
    :show-cells="false"
    :allow-zoom="allowZoom"
    :max-zoom="maxZoom"
    :duration="duration"
    :nice="false"
    @hover="$emit('hover', $event)"
    @select="$emit('select', $event)"
    @zoom="$emit('zoom', ($event?.transform ?? $event))"
    @draw="$emit('draw', $event)"
  >
    <!-- Always mounted (no v-if on length). When the spec array empties, the
         areas exit through the normal D3 join — which gets the NEXT scene's
         scales on the following draw and animates the exit toward them. A
         v-if would unmount the layer first, and destroy() can only see the
         PREVIOUS scene's scales, so the exit would fade in place instead of
         sliding to its future position. -->
    <RefAreaLayer
      :order="SUPER_SCATTER_ORDERS.refArea"
      :areas="resolvedRefAreas"
      :data="data"
      :x-accessor="xAccessor"
      :y-accessor="yAccessor"
      :duration="duration"
    />
    <RefLineLayer
      :order="SUPER_SCATTER_ORDERS.refLine"
      :lines="resolvedRefLines"
      :data="data"
      :x-accessor="xAccessor"
      :y-accessor="yAccessor"
      :duration="duration"
    />
    <slot />
  </ScatterPlot>
</template>

<script setup>
/**
 * SuperScatterPlot — controlled scatter chart for scene-driven stories.
 *
 * Same idea as SuperLineChart but for the scatter surface: a parent
 * (the editor / sequence player / agent runner) hands a single object
 * representing one scene — current data rows + axis keys + ref overlays
 * + zoom + highlight set — and the component renders that frame. No
 * MaskLayer / reveal animations needed: the building blocks here are
 *
 *   ScatterPlot   →  the dots themselves (with built-in highlight/dim,
 *                    voronoi hover, zoom)
 *   RefAreaLayer  →  shaded backdrops (CI band via `rule: "regressionCI"`,
 *                    rectangular threshold zones via x1/x2/y1/y2)
 *   RefLineLayer  →  rules (medians, regression, baselines, vertical
 *                    markers at specific values)
 *
 * The parent feeds `data` for whatever year the active scene is bound
 * to — this component is year-agnostic; it just renders what it gets.
 */
import { computed, ref } from "vue";
import ScatterPlot from "./ScatterPlot.vue";
import RefAreaLayer from "./layers/RefAreaLayer.vue";
import RefLineLayer from "./layers/RefLineLayer.vue";
import { createFill, isFillDescriptor } from "../fill/fillDescriptor.js";
import {
  SUPER_SCATTER_DEFAULTS as CD,
  SUPER_SCATTER_PALETTE,
  SUPER_SCATTER_ORDERS,
} from "../presets/SuperScatterPlot.defaults.js";

const props = defineProps({
  /** Data for the CURRENT scene — array of point objects (one year's rows). */
  data: { type: Array, default: () => [] },

  /**
   * Global chart-level props (forwarded to ScatterPlot). Defaults override
   * SUPER_SCATTER_DEFAULTS. Use `chart.maxZoom`, `chart.duration`, etc.
   */
  chart: { type: Object, default: () => ({}) },

  /** Axis key shortcuts — strings; the component derives accessors. */
  xKey:       { type: String, default: null },
  yKey:       { type: String, default: null },
  rKey:       { type: String, default: null },

  /**
   * Per-axis scale types. Falls back to `chart.xScaleType` then defaults.
   * Per-key sensible defaults: income/population → "log", life_exp → "linear".
   */
  xScaleType: { type: String, default: null },
  yScaleType: { type: String, default: null },
  rScaleType: { type: String, default: null },

  /**
   * Highlight / dim. Array of point ids to highlight; others get dimmed.
   * Empty/undefined = no highlight (every dot at full opacity).
   */
  highlighted: { type: [Array, String], default: () => [] },
  selected:    { default: null },

  /**
   * Color: pass either a function (continent → color), or a fill
   * descriptor that's materialised via createFill, or omit → falls
   * back to the continent palette built into the preset.
   */
  color:         { default: null },
  /** Default color-by accessor (each datum → continent). Override for other categorical fields. */
  colorAccessor: { type: Function, default: null },
  /** Label accessor for hover / labels. Default: datum.country. */
  labelAccessor: { type: Function, default: null },

  /** RefArea / RefLine specs (same shape as ScatterPlot's slots). */
  refAreas: { type: Array, default: () => [] },
  refLines: { type: Array, default: () => [] },

  /**
   * Declarative zoom — { x:[min,max], y?:[min,max], padding? }
   * | { transform:{k,tx,ty} } | null. Watched: changes animate via the inner canvas.
   */
  zoom: { type: Object, default: null },
});

defineEmits(["hover", "select", "zoom", "draw"]);

// ── Derived chart props ─────────────────────────────────────────────────────

const duration   = computed(() => props.chart?.duration   ?? CD.duration);
const dotOpacity = computed(() => props.chart?.dotOpacity ?? CD.dotOpacity);
const dotSize    = computed(() => props.chart?.dotSize    ?? CD.dotSize);
const showGrid   = computed(() => props.chart?.showGrid   ?? CD.showGrid);
const showHover  = computed(() => props.chart?.showHover  ?? CD.showHover);
const showLabels = computed(() => props.chart?.showLabels ?? CD.showLabels);
const allowZoom  = computed(() => props.chart?.allowZoom  ?? CD.allowZoom);
const maxZoom    = computed(() => props.chart?.maxZoom    ?? CD.maxZoom);
const chartMargin = computed(() => props.chart?.margin    ?? CD.margin);

// ── Axis keys & accessors ───────────────────────────────────────────────────

const effectiveXKey = computed(() => props.xKey ?? props.chart?.xKey ?? CD.xKey);
const effectiveYKey = computed(() => props.yKey ?? props.chart?.yKey ?? CD.yKey);
const effectiveRKey = computed(() => props.rKey ?? props.chart?.rKey ?? CD.rKey);

// Per-key sensible scale-type defaults — log for income / population
// (heavy right-skew), linear for life_exp. Agents can override per-scene.
function defaultScaleFor(key) {
  if (key === "income" || key === "population") return "log";
  return "linear";
}

const xScaleType = computed(() =>
  props.xScaleType ?? props.chart?.xScaleType ?? defaultScaleFor(effectiveXKey.value),
);
const yScaleType = computed(() =>
  props.yScaleType ?? props.chart?.yScaleType ?? defaultScaleFor(effectiveYKey.value),
);
const rScaleType = computed(() =>
  props.rScaleType ?? props.chart?.rScaleType ?? CD.rScaleType,
);

const xAccessor = computed(() => {
  const k = effectiveXKey.value;
  return (d) => d?.[k];
});
const yAccessor = computed(() => {
  const k = effectiveYKey.value;
  return (d) => d?.[k];
});
const rAccessor = computed(() => {
  const k = effectiveRKey.value;
  return (d) => d?.[k];
});

// Color: function → use as-is; fill descriptor → materialise; null → fall back
// to the continent palette. The fallback is the most common case for stories
// over the countries dataset.
const liveColor = computed(() => {
  if (typeof props.color === "function") return props.color;
  if (isFillDescriptor(props.color)) return createFill(props.color);
  // Default: continent-keyed lookup. Wrap so the function identity is
  // stable across re-renders.
  return (continent) => SUPER_SCATTER_PALETTE[continent] ?? "#6B7280";
});

const colorAccessor = computed(
  () => props.colorAccessor ?? ((d) => d?.continent),
);
const labelAccessor = computed(
  () => props.labelAccessor ?? ((d) => d?.country),
);

// ── Reference layers ────────────────────────────────────────────────────────

const resolvedRefAreas = computed(() =>
  (props.refAreas ?? []).map((a) => ({
    ...a,
    fill: isFillDescriptor(a.fill) ? createFill(a.fill) : a.fill,
  })),
);

const resolvedRefLines = computed(() => props.refLines ?? []);

// ── Zoom (declarative, forwarded to host) ───────────────────────────────────

const hostRef = ref(null);

function applyZoom(z, dur = duration.value) {
  const host = hostRef.value;
  if (!host) return;
  if (!z) return host.resetZoom?.(dur);
  if (z.transform) return host.setTransform?.(z.transform, dur);
  if (z.x || z.y) return host.zoomToDomain?.({ x: z.x, y: z.y, padding: z.padding ?? 0 }, dur);
  return host.resetZoom?.(dur);
}

// Watch zoom prop for declarative scene-to-scene updates.
import { watch, onMounted } from "vue";
watch(() => props.zoom, (z) => applyZoom(z), { deep: true });
onMounted(() => { if (props.zoom) applyZoom(props.zoom, 0); });

// ── Public API ──────────────────────────────────────────────────────────────

defineExpose({
  applyZoom,
  zoomToDomain: (...a) => hostRef.value?.zoomToDomain(...a),
  setTransform: (...a) => hostRef.value?.setTransform(...a),
  resetZoom:    (...a) => hostRef.value?.resetZoom(...a),
  get svgEl()  { return hostRef.value?.svgEl; },
  get width()  { return hostRef.value?.width; },
  get height() { return hostRef.value?.height; },
});
</script>
