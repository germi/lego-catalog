<template>
  <BaseCanvas
    ref="canvasRef"
    skip-projection
    :projector="scatterProjector"
    :margin="resolvedMargin"
    :allow-manual-zoom="allowZoom"
    :max-zoom="maxZoom"
    :duration="duration"
    :zoom-axes="zoomAxes"
    :user-zoom-axes="userZoomAxes"
    :clamp-pan="clampPan"
    :clamp-pan-inset="resolvedClampPanInset"
    @draw="onCanvasDraw"
    @zoom="onCanvasZoom"
    @zoom-start="onCanvasZoomStart"
    @zoom-end="onCanvasZoomEnd"
  >
    <!-- clipWrapper = MaskLayer (box-clips to the plot) when `clipToPlot`, else a
         transparent passthrough. Both carry :order so the dots sit in the right
         paint order whether wrapped or not. -->
    <component
      :is="clipWrapper"
      :order="10"
      :clip-to-plot="clipToPlot"
      :margin="resolvedMargin"
      :padding="resolvedClipInset"
      pointer-events="auto"
    >
      <ScatterLayer
        ref="scatterLayer"
        :order="10"
        :data="data"
        :radius="radius"
        :r-scale-type="rScaleType"
        :dot-size="dotSize"
        :dot-opacity="dotOpacity"
        :hover-scale="hoverScale"
        :value-accessor="valueAccessor"
        :color="color"
        :color-accessor="colorAccessor"
        :highlighted="highlighted"
        :selected="selected"
        :stroke-color="strokeColor"
        :stroke-width="strokeWidth"
        :stroke-opacity="strokeOpacity"
        :hover-stroke-color="hoverStrokeColor"
        :highlight-fill="highlightFill"
        :highlight-fill-opacity="highlightFillOpacity"
        :highlight-stroke-color="highlightStrokeColor"
        :highlight-stroke-width="highlightStrokeWidth"
        :highlight-stroke-opacity="highlightStrokeOpacity"
        :dim-fill="dimFill"
        :dim-opacity="dimOpacity"
        :dim-stroke-color="dimStrokeColor"
        :dim-stroke-width="dimStrokeWidth"
        :dim-stroke-opacity="dimStrokeOpacity"
        :fixed-size="fixedSize"
        :sort-by-radius="sortByRadius"
        :duration="duration"
        v-bind="scatterHandlers"
      />
      <!-- Extra layers injected by the consumer (additional voronoi, annotation
         layers, etc.).  They receive the same canvas context (draw / zoom /
         projector signals) as the built-in layers. -->
      <slot />
    </component>

    <!-- Unclipped consumer layers: identical canvas context to the default slot,
         but rendered OUTSIDE the clip wrapper so content is NOT box-clipped to the
         plot (e.g. labels/annotations that may spill past the plot edges). -->
    <slot name="unclipped" />

    <!-- NB: the x-axis is deliberately NOT given `padding`. The projector already
         insets the x-scale range via `rangePad`, so the ticks are positioned
         correctly from the scale alone. Passing padding here would (a) double-count
         the horizontal inset (padding lives in BOTH the range and the axis's
         translate) and (b) push the axis LINE up by padding.bottom. With no padding
         the line sits at the bottom margin — mirroring the y-axis, whose line always
         sits at the left margin regardless of padding. The y-axis DOES need padding
         because it re-ranges the scale itself (see YAxisLayer). -->
    <AxisLayer
      v-if="showXAxis"
      :order="1"
      :side="xAxisSide"
      :tick-format="xTickFormat"
      :num-ticks="xTicks"
      :tick-angle="xTickAngle"
      :tick-font-size="xTickFontSize"
      :tick-stagger="xTickStagger"
      :tick-color="tickColor"
      :tick-text-color="tickTextColor"
      :show-grid="showGrid"
      :grid-color="gridColor"
      :margin="resolvedMargin"
      :duration="duration"
    />

    <YAxisLayer
      v-if="showYAxis"
      :order="2"
      :side="resolvedYSide"
      :tick-format="yTickFormat"
      :num-ticks="yTicks"
      :show-grid="showGrid"
      :grid-color="gridColor"
      :tick-color="tickColor"
      :tick-text-color="tickTextColor"
      :text-ticks-inside="yTextTicksInside"
      :margin="resolvedMargin"
      :padding="resolvedPadding"
      :duration="duration"
      :rtl="rtl"
    />

    <VoronoiLayer
      :order="20"
      v-if="showLabels || (showHover && useVoronoiHover)"
      :data="data"
      :show-cells="showCells"
      :show-centroids="showCells"
      :cell-stroke="cellStroke"
      :cell-stroke-width="cellStrokeWidth"
      :recompute-on-zoom="recomputeOnZoom"
      :zoom-recompute-mode="zoomRecomputeMode"
    >
      <!-- Labels get the same optional box clip as the dots. The wrapper sits
           INSIDE VoronoiLayer so the label still injects the voronoi context, but
           the sibling VoronoiHoverLayer stays OUTSIDE the clip (it needs to catch
           mouse events across the whole plot, and the mask is pointer-events:none). -->
      <component
        :is="clipWrapper"
        v-if="showLabels"
        :order="30"
        :clip-to-plot="clipToPlot"
        :margin="resolvedMargin"
        :padding="resolvedClipInset"
      >
        <VoronoiLabelLayer
          :text="labelAccessor"
          :radius="radius"
          :r-scale-type="rScaleType"
          :dot-size="dotSize"
          :value-accessor="valueAccessor"
          :opacity="labelOpacity"
          :opacity-accessor="labelOpacityAccessor"
          :bg-color="labelBgColor"
          :bg-opacity="labelBgOpacity"
          :bg-stroke="labelBgStroke"
          :bg-stroke-width="labelBgStrokeWidth"
          :text-color="labelTextColor"
          :text-stroke="labelTextStroke"
          :text-stroke-width="labelTextStrokeWidth"
          :font-size="labelFontSize"
          :font-weight="labelFontWeight"
          :font-family="labelFontFamily"
          :corner-radius="labelCornerRadius"
          :padding="labelPadding"
          :separation="labelSeparation"
          :min-cell-area="labelMinCellArea"
          :suppress-overlap="labelSuppressOverlap"
          :force-label="labelForce"
          :connector="labelConnector"
          :connector-color="labelConnectorColor"
          :connector-width="labelConnectorWidth"
          :centroid-anchor="labelCentroidAnchor"
          :centroid-gap="labelCentroidGap"
        />
      </component>
      <VoronoiHoverLayer
        v-if="useVoronoiHover"
        @hover="onVoronoiHover"
        @click="emit('select', $event)"
      />
    </VoronoiLayer>
  </BaseCanvas>
</template>

<script setup>
import { computed, ref, useTemplateRef } from "vue";

import BaseCanvas from "./canvas/BaseCanvas.vue";
import ScatterLayer from "./layers/ScatterLayer.vue";
import AxisLayer from "./layers/AxisLayer.vue";
import YAxisLayer from "./layers/YAxisLayer.vue";
import VoronoiLayer from "./layers/VoronoiLayer.vue";
import VoronoiLabelLayer from "./layers/VoronoiLabelLayer.vue";
import VoronoiHoverLayer from "./layers/VoronoiHoverLayer.vue";
import MaskLayer from "./layers/MaskLayer.vue";

import { makeScaleProjector } from "../utils/projectors/scaleProjector.js";
import { idsToZoomDomain } from "../utils/idsToZoomDomain.js";
import { resolveInline, resolveSpacing } from "../utils/resolveInline.js";
import { SCATTER_PLOT_DEFAULTS as D } from "../presets/ScatterPlot.defaults.js";

const props = defineProps({
  data: { type: Array, default: () => [] },
  margin: { type: Object, default: () => ({ ...D.margin }) },
  padding: { type: Object, default: () => ({ ...D.padding }) },

  // Accessors
  xAccessor: { type: Function, default: D.xAccessor },
  yAccessor: { type: Function, default: D.yAccessor },
  xScaleType: { type: String, default: D.xScaleType },
  yScaleType: { type: String, default: D.yScaleType },
  nice: { type: Boolean, default: D.nice },
  xDomain: { type: Array, default: D.xDomain },
  yDomain: { type: Array, default: D.yDomain },
  xScale: { default: D.xScale },
  yScale: { default: D.yScale },

  // Dots
  radius: { default: D.radius },
  rScaleType: { type: String, default: D.rScaleType },
  dotSize: { type: Array, default: () => [...D.dotSize] },
  dotOpacity: { type: Number, default: D.dotOpacity },
  hoverScale: { type: Number, default: D.hoverScale },
  valueAccessor: { type: Function, default: D.valueAccessor },
  color: { default: D.color },
  colorAccessor: { type: Function, default: D.colorAccessor },
  fixedSize: { type: Boolean, default: D.fixedSize },
  sortByRadius: { type: Boolean, default: D.sortByRadius },

  // Stroke
  strokeColor: { type: String, default: D.strokeColor },
  strokeWidth: { type: Number, default: D.strokeWidth },
  strokeOpacity: { type: Number, default: D.strokeOpacity },
  hoverStrokeColor: { type: String, default: D.hoverStrokeColor },

  // Interaction
  highlighted: { type: [Array, String], default: () => [] },
  selected: { default: D.selected },
  // Highlight / dim
  highlightFill: { default: D.highlightFill },
  highlightFillOpacity: { type: Number, default: D.highlightFillOpacity },
  highlightStrokeColor: { default: D.highlightStrokeColor },
  highlightStrokeWidth: { type: Number, default: D.highlightStrokeWidth },
  highlightStrokeOpacity: { type: Number, default: D.highlightStrokeOpacity },
  dimFill: { default: D.dimFill },
  dimOpacity: { type: Number, default: D.dimOpacity },
  dimStrokeColor: { default: D.dimStrokeColor },
  dimStrokeWidth: { type: Number, default: D.dimStrokeWidth },
  dimStrokeOpacity: { type: Number, default: D.dimStrokeOpacity },

  // Axes
  showXAxis: { type: Boolean, default: D.showXAxis },
  showYAxis: { type: Boolean, default: D.showYAxis },
  xAxisSide: { type: String, default: D.xAxisSide },
  yAxisSide: { type: String, default: D.yAxisSide },
  rtl: { type: Boolean, default: D.rtl },
  xTickFormat: { type: Function, default: D.xTickFormat },
  yTickFormat: { type: Function, default: D.yTickFormat },
  xTicks: { type: Number, default: D.xTicks },
  yTicks: { type: Number, default: D.yTicks },
  // Incline x-axis tick labels (deg): >0 label ends at tick, <0 starts at tick.
  xTickAngle: { type: Number, default: D.xTickAngle },
  xTickFontSize: { type: Number, default: D.xTickFontSize },
  // Stagger horizontal x tick labels across N rows to reduce overlap (1 = off).
  xTickStagger: { type: Number, default: D.xTickStagger },
  showGrid: { type: Boolean, default: D.showGrid },
  gridColor: { type: String, default: D.gridColor },
  tickColor: { type: String, default: D.tickColor },
  tickTextColor: { type: String, default: D.tickTextColor },
  yTextTicksInside: { type: Boolean, default: D.yTextTicksInside },

  // Labels / hover / voronoi
  showLabels: { type: Boolean, default: D.showLabels },
  showHover: { type: Boolean, default: D.showHover },
  showCells: { type: Boolean, default: D.showCells },
  cellStroke: { type: String, default: D.cellStroke },
  cellStrokeWidth: { type: Number, default: D.cellStrokeWidth },
  labelAccessor: { type: Function, default: D.labelAccessor },
  useVoronoiHover: { type: Boolean, default: D.useVoronoiHover },
  labelOpacity: { type: Number, default: D.labelOpacity },
  labelOpacityAccessor: { type: Function, default: D.labelOpacityAccessor },
  labelBgColor: { type: String, default: D.labelBgColor },
  labelBgOpacity: { type: Number, default: D.labelBgOpacity },
  labelBgStroke: { type: String, default: D.labelBgStroke },
  labelBgStrokeWidth: { type: Number, default: D.labelBgStrokeWidth },
  labelTextColor: { type: String, default: D.labelTextColor },
  labelTextStroke: { type: String, default: D.labelTextStroke },
  labelTextStrokeWidth: { type: Number, default: D.labelTextStrokeWidth },
  labelFontSize: { type: Number, default: D.labelFontSize },
  labelFontWeight: { type: String, default: D.labelFontWeight },
  labelFontFamily: { type: String, default: D.labelFontFamily },
  labelCornerRadius: { type: Number, default: D.labelCornerRadius },
  labelPadding: { type: [Array, Number], default: () => D.labelPadding },
  labelSeparation: { type: Number, default: D.labelSeparation },
  labelMinCellArea: { type: Number, default: D.labelMinCellArea },
  labelSuppressOverlap: { type: Boolean, default: D.labelSuppressOverlap },
  labelForce: { type: Function, default: D.labelForce },
  labelConnector: { type: Boolean, default: D.labelConnector },
  labelConnectorColor: { type: String, default: D.labelConnectorColor },
  labelConnectorWidth: { type: Number, default: D.labelConnectorWidth },
  labelCentroidAnchor: { type: Boolean, default: D.labelCentroidAnchor },
  labelCentroidGap: { type: Number, default: D.labelCentroidGap },
  // Recompute the voronoi through the live zoomed scales (smooth labels/cells on
  // zoom) instead of the literal group-transform zoom. See VoronoiLayer.
  recomputeOnZoom: { type: Boolean, default: D.recomputeOnZoom },
  zoomRecomputeMode: { type: String, default: D.zoomRecomputeMode },

  // Zoom
  allowZoom: { type: Boolean, default: D.allowZoom },
  maxZoom: { type: Number, default: D.maxZoom },
  zoomAxes: { type: String, default: D.zoomAxes ?? "xy" },
  userZoomAxes: { type: String, default: D.userZoomAxes ?? null },
  duration: { type: Number, default: D.duration },
  // Pan/zoom clamping — keep the view inside the data borders (never scroll past
  // the plotted area). `clampPanInset` ({ x, y } px) shrinks the clamp box by the
  // chart's margin/padding so it matches the actual data area, not the full SVG.
  // With clampPan on, a programmatic zoomToIds is ALSO clamped, so a selection
  // near an edge stays clamped to that border (not re-centred) — by design.
  clampPan: { type: Boolean, default: D.clampPan },
  clampPanInset: { type: Object, default: D.clampPanInset },

  // Clip the dots + voronoi labels to the plot box (see defaults). `clipInset`
  // is a number (uniform px) or an object ({top,right,bottom,left} or logical
  // start/end) — the extra inset from the axis edge toward the data area.
  clipToPlot: { type: Boolean, default: D.clipToPlot },
  clipInset: { type: [Number, Object], default: D.clipInset },
});

const emit = defineEmits(["hover", "select", "zoom"]);

// True while the user is actively wheel/drag-zooming — used to suppress
// hover-with-data events so a tooltip doesn't reappear mid-gesture. A plain
// variable is enough (no template binding needs it reactive).
let isGesturing = false;

// Manual (wheel/drag) zoom: re-emit the transform, and drop any open tooltip —
// its anchor moves every frame during a gesture, so a held-open tooltip would
// hang mispositioned. Programmatic zoom doesn't fire this event.
function onCanvasZoom(e) {
  emit("zoom", e?.transform ?? e);
  emit("hover", null);
}
function onCanvasZoomStart() {
  isGesturing = true;
}
function onCanvasZoomEnd() {
  isGesturing = false;
}

// Direct (non-voronoi) hover/click handlers — hoisted (stable identity) instead
// of inline arrows in the template, and gathered into one object bound via
// v-bind. Hover is suppressed mid-gesture. The object only re-computes when
// `useVoronoiHover` flips.
function onScatterHover(e) {
  if (!isGesturing) emit("hover", e);
}
function onScatterClick(e) {
  emit("select", e);
}
const scatterHandlers = computed(() =>
  props.useVoronoiHover
    ? {}
    : { onHover: onScatterHover, onClick: onScatterClick },
);

// clampPanInset = the per-side PADDING inset within the plot. The clamp box lives
// in innerEl coords (BaseCanvas subtracts its own margin to get iw/ih), so the
// margin must NOT be added here — the projector's scales are already innerEl-
// relative. Emitting the padding per side positions the clamp box exactly on the
// data area, so pan is symmetric even with asymmetric margins. An explicit
// `clampPanInset` prop still overrides.
const resolvedClampPanInset = computed(
  () =>
    props.clampPanInset ?? {
      left:   resolvedPadding.value.left   ?? 0,
      right:  resolvedPadding.value.right  ?? 0,
      top:    resolvedPadding.value.top    ?? 0,
      bottom: resolvedPadding.value.bottom ?? 0,
    },
);

const scatterLayer = useTemplateRef("scatterLayer");
const canvasRef = useTemplateRef("canvasRef");

// Forward BaseCanvas's programmatic zoom API so callers with a templateRef
// on this ScatterPlot can drive zoom from the outside (linked scatter
// plots, useChartZoom composable, etc.).
// Fit a set of data points (by id) into the viewport. Thin middleman over
// zoomToDomain: turn ids → data-space bounding box (using THIS chart's data +
// accessors), then let the canvas do the scale-agnostic box→transform work.
//   zoomToIds(['china','usa','brazil'], { scale: 0.9 })
// opts: { scale (viewport fill, default 0.95), axes ("x"|"y"|"xy", defaults to
// the chart's zoomAxes), idAccessor, singlePointZoom, minSpan (floor on the
// fitted window as a fraction of the full data extent — number or {x,y} — so a
// tight cluster doesn't over-zoom), duration, ease }.
function zoomToIds(ids, opts = {}) {
  const dom = idsToZoomDomain(props.data, ids, {
    xAccessor: props.xAccessor,
    yAccessor: props.yAccessor,
    idAccessor: opts.idAccessor,
    scale: opts.scale,
    axes: opts.axes ?? props.zoomAxes ?? "xy",
    singlePointZoom: opts.singlePointZoom,
    minSpan: opts.minSpan,
    // Auto-detect log axes so the minSpan floor is computed in log space
    // (a linear floor balloons / breaks at the low end of a log scale).
    xLog: opts.xLog ?? props.xScaleType === "log",
    yLog: opts.yLog ?? props.yScaleType === "log",
  });
  if (dom) canvasRef.value?.zoomToDomain(dom, opts.duration, opts.ease);
}

defineExpose({
  zoomToDomain: (...a) => canvasRef.value?.zoomToDomain(...a),
  zoomToIds,
  setTransform: (...a) => canvasRef.value?.setTransform(...a),
  zoomToRect: (...a) => canvasRef.value?.zoomToRect(...a),
  zoomToScale: (...a) => canvasRef.value?.zoomToScale(...a),
  resetZoom: (...a) => canvasRef.value?.resetZoom(...a),
  zoomIn: (...a) => canvasRef.value?.zoomIn(...a),
  zoomOut: (...a) => canvasRef.value?.zoomOut(...a),
  redraw: (d) => canvasRef.value?.redraw(d),
  get svgEl() {
    return canvasRef.value?.svgEl;
  },
  get width() {
    return canvasRef.value?.width;
  },
  get height() {
    return canvasRef.value?.height;
  },
});

// Inner SVG dimensions reported by BaseCanvas via the draw payload.
const innerWidth = ref(0);
const innerHeight = ref(0);

function onCanvasDraw(payload) {
  if (payload?.innerWidth !== innerWidth.value)
    innerWidth.value = payload.innerWidth;
  if (payload?.innerHeight !== innerHeight.value)
    innerHeight.value = payload.innerHeight;
}

// Intercept hover events from VoronoiHoverLayer and swap the target for the
// actual scatter circle via ScatterLayer's getDotEl(), so Popper.js anchors
// the tooltip to the rendered dot rather than the invisible ghost.
function onVoronoiHover(event) {
  if (!event) {
    emit("hover", null);
    return;
  }
  if (isGesturing) return; // suppress hover-with-data mid-gesture
  const circle = scatterLayer.value?.getDotEl(event.data.id);
  emit("hover", circle ? { ...event, target: circle } : event);
}

const resolvedMargin = computed(() => resolveSpacing(props.margin, props.rtl));
const resolvedPadding = computed(() =>
  resolveSpacing(props.padding, props.rtl),
);
const resolvedYSide = computed(() => resolveInline(props.yAxisSide, props.rtl));

// Clip box inset (px on each physical side). A number = uniform; an object is
// RTL-resolved like margin/padding. Fed to the MaskLayer as its `padding`, so
// the clip box = SVG − margin − clipInset.
const resolvedClipInset = computed(() =>
  typeof props.clipInset === "number"
    ? {
        top: props.clipInset,
        right: props.clipInset,
        bottom: props.clipInset,
        left: props.clipInset,
      }
    : resolveSpacing(props.clipInset ?? {}, props.rtl),
);

// Conditional clip wrapper: MaskLayer (box-clips its slot) when clipToPlot,
// otherwise a transparent passthrough that just renders its slot. This keeps the
// ScatterLayer / VoronoiLabelLayer declared once while only *wrapping* them in a
// clip when asked (an always-on mask would add pointer-events:none + a clip we
// don't want when clipping is off).
const Passthrough = {
  inheritAttrs: false,
  setup:
    (_, { slots }) =>
    () =>
      slots.default?.(),
};
const clipWrapper = computed(() =>
  props.clipToPlot ? MaskLayer : Passthrough,
);

// Always-ready projector — rebuilt whenever data, dimensions, or scale config
// change.  When the reference changes, BaseCanvas's projector watcher fires a
// single draw signal and every layer re-renders.
//
// IMPORTANT — accessor props (xAccessor, yAccessor, …) must be stable
// function references in the parent template.  Two patterns work:
//   • Static:  const xAccessor = (d) => d.x          (module-level const)
//   • Dynamic: const xAccessor = computed(() => (d) => d[field.value])
// Never pass inline arrow functions directly in the template — they are new
// objects on every parent render and would cause this computed to re-evaluate
// (and fire a full redraw) on unrelated state changes like hover.
const scatterProjector = computed(() =>
  makeScaleProjector({
    data: props.data,
    width: innerWidth.value,
    height: innerHeight.value,
    xAccessor: props.xAccessor,
    yAccessor: props.yAccessor,
    xScaleType: props.xScaleType,
    yScaleType: props.yScaleType,
    nice: props.nice,
    xDomain: props.xDomain ?? undefined,
    yDomain: props.yDomain ?? undefined,
    xScale: props.xScale ?? undefined,
    yScale: props.yScale ?? undefined,
    rangePad: resolvedPadding.value,
    rtl: props.rtl,
  }),
);
</script>
