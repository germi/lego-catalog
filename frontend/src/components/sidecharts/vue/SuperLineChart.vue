<template>
  <LineChart
    ref="hostRef"
    v-bind="hostChartProps"
    :data="data"
    :keys="resolvedKeys"
    :color="hostColorMap"
    :stroke-opacity="ghostOpacity"
    @hover="$emit('hover', $event)"
    @click="$emit('click', $event)"
    @draw="$emit('draw', $event)"
    @zoom="$emit('zoom', ($event?.transform ?? $event))"
  >
    <!-- One masked LineLayer (+ optional band) per series. Each series gets
         its own MaskLayer so its reveal window is independent. The SAME `data`
         prop is handed to every layer, keyed to that series. -->
    <template v-for="(s, i) in resolvedSeries" :key="s.key">
      <MaskLayer
        :reveal-start="s.reveal ? (s.reveal.start ?? null) : null"
        :reveal-end="s.reveal ? (s.reveal.end ?? null) : null"
        :reveal-duration="duration"
        :reveal-ease="chartEase"
        :order="SUPER_ORDERS.seriesBase + i"
      >
        <AreaLayer
          v-if="s.band"
          :data="data"
          :upper-key="s.band.upperKey"
          :lower-key="s.band.lowerKey"
          :color="s.band.liveFill"
          :opacity="s.band.opacity"
          :curve="s.curve ?? chartCurve"
          :duration="duration"
        />
        <LineLayer
          :data="data"
          :keys="[s.key]"
          :color="{ [s.key]: s.liveColor }"
          :stroke-width="s.stroke.width"
          :stroke-opacity="s.stroke.opacity"
          :stroke-dasharray="s.stroke.dasharray"
          :curve="s.curve ?? chartCurve"
          :duration="duration"
          :highlighted="s.highlighted ? [s.key] : null"
          :show-last-point="false"
        />
      </MaskLayer>
    </template>

    <!-- Standalone AreaLayer specs. Each gets its own MaskLayer so its
         reveal window is independent of the series'. Use these for shaded
         backdrops (recession years, target zones), forecast bands that
         span a specific window, or any decorative fill an agent wants
         to compose under the lines. Render between refAreas and series. -->
    <template v-for="(a, i) in resolvedAreas" :key="a.id ?? `area-${i}`">
      <MaskLayer
        :reveal-start="a.reveal ? (a.reveal.start ?? null) : null"
        :reveal-end="a.reveal ? (a.reveal.end ?? null) : null"
        :reveal-duration="duration"
        :reveal-ease="chartEase"
        :order="SUPER_ORDERS.areaBase + i"
      >
        <AreaLayer
          :data="data"
          :keys="a.keys"
          :color="a.liveColor"
          :opacity="a.opacity"
          :stacked="a.stacked"
          :upper-key="a.upperKey"
          :lower-key="a.lowerKey"
          :curve="a.curve ?? chartCurve"
          :duration="duration"
        />
      </MaskLayer>
    </template>

    <!-- One RefAreaLayer / RefLineLayer renders every spec; add/remove an
         array entry and it enters/exits with animation. -->
    <RefAreaLayer
      v-if="resolvedRefAreas.length"
      :order="SUPER_ORDERS.refArea"
      :areas="resolvedRefAreas"
      :duration="duration"
    />
    <RefLineLayer
      v-if="resolvedRefLines.length"
      :order="SUPER_ORDERS.refLine"
      :lines="resolvedRefLines"
      :duration="duration"
    />

    <!-- Escape hatch: extra bespoke layers can still be slotted in. -->
    <slot />
  </LineChart>
</template>

<script setup>
import { computed, ref, watch, onMounted } from "vue";
import LineChart from "./LineChart.vue";
import MaskLayer from "./layers/MaskLayer.vue";
import LineLayer from "./layers/LineLayer.vue";
import AreaLayer from "./layers/AreaLayer.vue";
import RefAreaLayer from "./layers/RefAreaLayer.vue";
import RefLineLayer from "./layers/RefLineLayer.vue";
import { createFill, isFillDescriptor } from "../fill/fillDescriptor.js";
import {
  SUPER_CHART_DEFAULTS as CD,
  SUPER_SERIES_STROKE_DEFAULTS,
  SUPER_BAND_DEFAULTS,
  SUPER_PALETTE,
  SUPER_ORDERS,
} from "../presets/SuperLineChart.defaults.js";

const props = defineProps({
  /** Data in LineChart format: [{ id, name, values: { [key]: { id, name, value } } }]. */
  data: { type: Array, default: () => [] },

  /** Explicit series keys. When omitted, derived from `series` or `data`. */
  keys: { type: Array, default: null },

  /**
   * Global chart props forwarded to the inner LineChart (duration, ease,
   * curve, margin/padding, grids, forceValues, maxZoom, allowZoom, …) plus the
   * SuperLineChart-only `ghostOpacity` and `forceY` conveniences.
   */
  chart: { type: Object, default: () => ({}) },

  /**
   * Optional per-key visual + reveal overrides. Each entry:
   *   { key, label?, stroke?: { color, width, opacity, dasharray },
   *     curve?, reveal?: { start, end } | null, highlighted?,
   *     band?: { upperKey, lowerKey, fill, opacity } }
   * `key` must exist in `data`. Omit the whole array → every detected key
   * renders with defaults.
   */
  series: { type: Array, default: () => [] },

  /**
   * Standalone AreaLayer specs. Each entry becomes an independent AreaLayer
   * wrapped in its own MaskLayer (so `reveal` works per area).
   *   {
   *     id: string,                         // stable across scenes
   *     key:   string?,                     // single-key area  (sugar for keys:[k])
   *     keys:  string[]?,                   // multi-key area
   *     upperKey: string?, lowerKey: string?, // band-between-two-keys mode
   *     color:  FillDescriptor | CSS string | { [key]: …},
   *     opacity: 0–1,
   *     stacked: boolean,                   // stack multi-key areas
   *     curve:   string,
   *     reveal:  { start, end } | null,     // clip-reveal window in data-x
   *   }
   * `fill` is materialised through `createFill` so descriptors (gradients,
   * textures) work the same as on `refAreas`.
   */
  areas: { type: Array, default: () => [] },

  /** Reference-area specs (RefAreaLayer). `fill` may be a fill descriptor. */
  refAreas: { type: Array, default: () => [] },

  /** Reference-line specs (RefLineLayer). */
  refLines: { type: Array, default: () => [] },

  /**
   * Declarative zoom. Watched: changing it animates via the inner canvas.
   *   { x:[min,max], y?:[min,max], padding? } | { transform:{k,tx,ty} } | null
   */
  zoom: { type: Object, default: null },
});

defineEmits(["hover", "click", "draw", "zoom"]);

// ── Derived globals ──────────────────────────────────────────────────────────

const duration   = computed(() => props.chart?.duration ?? CD.duration);
const chartCurve  = computed(() => props.chart?.curve ?? CD.curve);
const chartEase   = computed(() => props.chart?.ease ?? CD.ease);
const ghostOpacity = computed(() => props.chart?.ghostOpacity ?? CD.ghostOpacity);

// Props forwarded to the inner LineChart — strip SuperLineChart-only keys and
// map the `forceY` convenience onto LineChart's `forceValues`.
const hostChartProps = computed(() => {
  const { ghostOpacity: _g, forceY, ...rest } = props.chart ?? {};
  if (forceY != null && rest.forceValues == null) rest.forceValues = forceY;
  return rest;
});

// ── Series resolution ────────────────────────────────────────────────────────

const seriesByKey = computed(() => {
  const m = {};
  for (const s of props.series ?? []) if (s?.key != null) m[s.key] = s;
  return m;
});

function detectKeys(data) {
  return Object.keys(data?.[0]?.values ?? {});
}

const resolvedKeys = computed(() => {
  if (props.series?.length) return props.series.map((s) => s.key);
  if (props.keys?.length) return props.keys;
  return detectKeys(props.data);
});

const resolvedSeries = computed(() =>
  resolvedKeys.value.map((key, i) => {
    const o = seriesByKey.value[key] ?? {};
    const stroke = { ...SUPER_SERIES_STROKE_DEFAULTS, ...(o.stroke ?? {}) };
    const colorSpec = stroke.color ?? {
      type: "color",
      value: SUPER_PALETTE[i % SUPER_PALETTE.length],
    };
    const liveColor = createFill(colorSpec);

    let band = null;
    if (o.band) {
      band = {
        upperKey: o.band.upperKey,
        lowerKey: o.band.lowerKey,
        opacity: o.band.opacity ?? SUPER_BAND_DEFAULTS.opacity,
        liveFill: createFill(o.band.fill ?? colorSpec),
      };
    }

    return {
      key,
      label: o.label ?? key,
      stroke,
      liveColor,
      curve: o.curve ?? null,
      reveal: o.reveal ?? null,
      highlighted: !!o.highlighted,
      band,
    };
  }),
);

// Colour map handed to the host's built-in (usually hidden) line — keeps the
// ghost in sync if `ghostOpacity` is raised.
const hostColorMap = computed(() => {
  const m = {};
  for (const s of resolvedSeries.value) m[s.key] = s.liveColor;
  return m;
});

// ── Standalone AreaLayer specs ───────────────────────────────────────────────
//
// Each entry → its own MaskLayer + AreaLayer. The `color` is materialised so
// fill descriptors (gradients, textures) work the same way as series strokes
// or refArea fills. For multi-key areas, a single fill descriptor is expanded
// into a per-key map so every sub-area gets the same materialised fill (and
// so live updates — texture re-registers on resize, etc. — keep working).

const resolvedAreas = computed(() =>
  (props.areas ?? []).map((a, idx) => {
    const keys = a.keys ?? (a.key != null ? [a.key] : null);

    let liveColor = a.color;
    if (isFillDescriptor(a.color)) {
      const fill = createFill(a.color);
      // If keys is known, expand the materialised fill to a per-key map so
      // AreaLayer hands the same fill to each key. Single-key areas pass
      // the fill through directly (AreaLayer accepts a string/fill).
      if (keys && keys.length > 1) {
        liveColor = Object.fromEntries(keys.map((k) => [k, fill]));
      } else {
        liveColor = fill;
      }
    }

    return {
      id:       a.id ?? `area-${idx}`,
      keys,
      upperKey: a.upperKey ?? null,
      lowerKey: a.lowerKey ?? null,
      liveColor,
      opacity:  a.opacity ?? SUPER_BAND_DEFAULTS.opacity,
      stacked:  !!a.stacked,
      curve:    a.curve ?? null,
      reveal:   a.reveal ?? null,
    };
  }),
);

// ── Reference layers ─────────────────────────────────────────────────────────

const resolvedRefAreas = computed(() =>
  (props.refAreas ?? []).map((a) => ({
    ...a,
    // Per-spec fill: descriptor → live fill; strings pass through unchanged.
    fill: isFillDescriptor(a.fill) ? createFill(a.fill) : a.fill,
  })),
);

// RefLine stroke colours stay plain strings for now (gradient strokes TBD).
const resolvedRefLines = computed(() => props.refLines ?? []);

// ── Zoom (declarative) ───────────────────────────────────────────────────────

const hostRef = ref(null);

function applyZoom(z, dur = duration.value) {
  const host = hostRef.value;
  if (!host) return;
  if (!z) return host.resetZoom?.(dur);
  if (z.transform) return host.setTransform?.(z.transform, dur);
  if (z.x || z.y) {
    return host.zoomToDomain?.({ x: z.x, y: z.y, padding: z.padding ?? 0 }, dur);
  }
  return host.resetZoom?.(dur);
}

watch(() => props.zoom, (z) => applyZoom(z), { deep: true });

// Initial zoom must wait for the canvas to have a size (and therefore a live
// projector). Poll a few frames, then apply once, instantly.
function applyInitialZoom(tries = 0) {
  if (!props.zoom) return;
  const w = hostRef.value?.width;
  const ready = typeof w === "number" ? w > 0 : !!(w && w.value);
  if (ready) return applyZoom(props.zoom, 0);
  if (tries < 60) requestAnimationFrame(() => applyInitialZoom(tries + 1));
}
onMounted(() => applyInitialZoom());

// ── Public API ───────────────────────────────────────────────────────────────

defineExpose({
  applyZoom,
  zoomToDomain: (...a) => hostRef.value?.zoomToDomain(...a),
  setTransform: (...a) => hostRef.value?.setTransform(...a),
  resetZoom:    (...a) => hostRef.value?.resetZoom(...a),
  redraw:       (d)    => hostRef.value?.redraw(d),
  get svgEl()   { return hostRef.value?.svgEl; },
  get width()   { return hostRef.value?.width; },
  get height()  { return hostRef.value?.height; },
});
</script>
