<template />

<script setup>
import { computed, inject, watch, onBeforeUnmount } from "vue";
import { createVoronoiLabelLayer, VORONOI_LABEL_LAYER_DEFAULTS } from "../../core/voronoiLabelLayer.js";

const props = defineProps({
  opacity:         { type: Number,            default: VORONOI_LABEL_LAYER_DEFAULTS.opacity },
  opacityAccessor: { type: Function,          default: VORONOI_LABEL_LAYER_DEFAULTS.opacityAccessor },
  text:            { type: [Function, String], default: VORONOI_LABEL_LAYER_DEFAULTS.text },
  fontSize:      { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.fontSize },
  fontFamily:    { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.fontFamily },
  fontWeight:    { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.fontWeight },
  textColor:     { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.textColor },
  // Legibility halo around the glyphs. `null` = off; e.g. `"white"`.
  textStroke:      { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.textStroke },
  textStrokeWidth: { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.textStrokeWidth },
  bgColor:       { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.bgColor },
  bgOpacity:     { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.bgOpacity },
  bgStroke:      { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.bgStroke },
  bgStrokeWidth: { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.bgStrokeWidth },
  padding:       { type: [Array, Number],    default: () => VORONOI_LABEL_LAYER_DEFAULTS.padding },
  cornerRadius:  { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.cornerRadius },
  markerRadius:  { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.markerRadius },
  separation:    { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.separation },
  fixedSize:     { type: Boolean,            default: VORONOI_LABEL_LAYER_DEFAULTS.fixedSize },
  // Radius-scale props — mirror ScatterLayer so label offsets follow dot sizes.
  radius:        {                           default: VORONOI_LABEL_LAYER_DEFAULTS.radius },
  rScaleType:    { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.rScaleType },
  dotSize:       { type: Array,              default: () => [...VORONOI_LABEL_LAYER_DEFAULTS.dotSize] },
  valueAccessor: { type: Function,           default: VORONOI_LABEL_LAYER_DEFAULTS.valueAccessor },
  // Supply the full dataset when this layer renders only a subset, so the
  // radius scale domain matches the main ScatterLayer.
  radiusData:      { type: Array,              default: null },
  // Per-datum background colour accessor — (d) => cssColor.  Wins over bgColor.
  bgColorAccessor: { type: Function,           default: null },
  // Decluttering (opt-in) — see VORONOI_LABEL_LAYER_DEFAULTS.
  minCellArea:     { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.minCellArea },
  suppressOverlap: { type: Boolean,            default: VORONOI_LABEL_LAYER_DEFAULTS.suppressOverlap },
  forceLabel:      { type: Function,           default: VORONOI_LABEL_LAYER_DEFAULTS.forceLabel },
  // Leader line connecting each dot to its label across the separation gap.
  connector:       { type: Boolean,            default: VORONOI_LABEL_LAYER_DEFAULTS.connector },
  connectorColor:  { type: String,             default: VORONOI_LABEL_LAYER_DEFAULTS.connectorColor },
  connectorWidth:  { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.connectorWidth },
  centroidAnchor:  { type: Boolean,            default: VORONOI_LABEL_LAYER_DEFAULTS.centroidAnchor },
  centroidGap:     { type: Number,             default: VORONOI_LABEL_LAYER_DEFAULTS.centroidGap },
  visible:       { type: Boolean,            default: true },
  order:         { type: Number,             default: undefined },
});

const draw         = inject("draw");
const zoom         = inject("zoom");
const voronoiDraw  = inject("voronoiDraw");
const voronoiOrder = inject("voronoiOrder", null);
const voronoiZoomMode = inject("voronoiZoomMode", null);
const voronoiGesture  = inject("voronoiGesture", null);
// When a MaskLayer wraps this label, render into its clipped <g> so the labels
// can't spill past the plot. Null (no mask) → the base layer uses innerEl.
const layerContainer = inject("layerContainer", null);
// Effective order: own prop > parent VoronoiLayer's cascaded order > undefined.
const effectiveOrder = computed(() => props.order ?? voronoiOrder?.value);

const core = createVoronoiLabelLayer();

const getProps = () => ({
  ...props,
  recomputeOnZoom: voronoiZoomMode?.value ?? false,
  layerContainer: layerContainer?.value ?? layerContainer ?? null,
});

watch(draw,        (payload) => { if (payload) core.render(payload, getProps(), voronoiDraw.value); }, { immediate: true });
watch(zoom,        (t)       => { if (t) core.onZoom(t); });
watch(voronoiDraw, (state)   => core.rerender(getProps(), state));
watch(() => voronoiGesture?.value, (d) => core.applyGestureTransform?.(d));

watch(
  [
    () => props.opacity,
    () => props.opacityAccessor,
    () => props.text,
    () => props.fontSize,
    () => props.fontFamily,
    () => props.fontWeight,
    () => props.textColor,
    () => props.textStroke,
    () => props.textStrokeWidth,
    () => props.bgColor,
    () => props.bgOpacity,
    () => props.bgStroke,
    () => props.bgStrokeWidth,
    () => props.padding,
    () => props.cornerRadius,
    () => props.markerRadius,
    () => props.separation,
    () => props.fixedSize,
    () => props.minCellArea,
    () => props.suppressOverlap,
    () => props.forceLabel,
    () => props.connector,
    () => props.connectorColor,
    () => props.connectorWidth,
    () => props.centroidAnchor,
    () => props.centroidGap,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(() => props.visible, (v) => core.setVisible(v), { immediate: true });
watch(effectiveOrder,      (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
