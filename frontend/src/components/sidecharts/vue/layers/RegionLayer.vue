<template></template>

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createRegionLayer } from "../../core/regionLayer.js";

const props = defineProps({
  topoData:                   { type: Object,           default: null },
  topoObjectName:             { type: String,           default: null },
  removeFeatures:             { type: Array,            default: () => [] },
  removeFeaturesForBounds:    { type: Array,            default: () => [] },
  superRegionMergeAccessor:   { type: Function,         default: null },
  featureAccessor:            { type: Function,         default: (d) => d.id },
  data:                       { type: Object,           default: () => ({}) },
  dataAccessor:               { type: Function,         default: (d) => d?.value },
  color:                      { type: [Object, Function], default: () => ({ min: "#DBEAFE", max: "#1E3A8A" }) },
  highlightColor:             { type: String,           default: "black" },
  noDataColor:                { type: [String, Object], default: "#DDDEDD" },
  strokeColor:                { type: String,           default: "#fff" },
  strokeColorNoData:          { type: String,           default: "#fff" },
  showBorders:                { type: Boolean,          default: false },
  borderColor:                { type: String,           default: "white" },
  showCompositionBorders:     { type: Boolean,          default: true },
  compositionBorderColor:     { type: String,           default: "#666" },
  strokeWidth:                { type: Number,           default: 1 },
  strokeDasharray:            { type: String,           default: "none" },
  superRegionStrokeWidth:     { type: Number,           default: 2 },
  selectedStrokeDasharray:    { type: String,           default: "none" },
  highlighted:                { type: [Number, String], default: null },
  highlightedStrokeWidth:     { type: Number,           default: null },
  highlightedStrokeDasharray: { type: String,           default: "none" },
  highlightOnlyWithData:      { type: Boolean,          default: true },
  duration:                   { type: Number,           default: 750 },
  scope:                      { type: String,           default: "region" },
  selectedSuperRegion:        { type: [String, Number], default: null },
  fitBoundsToData:            { type: Boolean,          default: false },
  extent:                     { type: Array,            default: null },
  registerBounds:             { type: Boolean,          default: true },
  order:                      { type: Number,           default: undefined },
});

const emit = defineEmits(["select", "hover", "superRegionClick"]);

const draw           = inject("draw");
const zoom           = inject("zoom");
const controls       = inject("controls", null);
const layerContainer = inject("layerContainer", null);

const core = createRegionLayer({
  onHover:            (e)  => emit("hover", e),
  onSelect:           (e)  => emit("select", e),
  onSuperRegionClick: (id) => emit("superRegionClick", id),
});

const getProps = () => ({ ...props, controls, layerContainer });

// Draw / zoom signals from BaseCanvas
watch(draw, (payload) => { if (payload) core.render(payload, getProps()); }, { immediate: true });
watch(zoom, (t)       => { if (t) core.onZoom(t); });

// Register bounds with canvas whenever the bounds-relevant feature collection changes.
// immediate: true ensures the canvas has bounds before its first draw.
watch(
  [() => props.topoData, () => props.topoObjectName,
   () => props.removeFeatures, () => props.removeFeaturesForBounds,
   () => props.featureAccessor],
  () => core.fitBoundsIfNeeded(getProps()),
  { immediate: true, deep: true },
);

// Data fill updates (color changes, no DOM restructuring)
watch(() => props.data, () => core.updateData(getProps()), { deep: true });

// Geometry changes — full redraw
watch(
  [() => props.topoData, () => props.topoObjectName,
   () => props.removeFeatures, () => props.superRegionMergeAccessor,
   () => props.featureAccessor],
  () => core.rerender(getProps()),
  { deep: true },
);

// Highlight-only updates
watch([() => props.highlighted, () => props.strokeDasharray],
  () => core.updateHighlight(getProps()));

// Super-region selection change
watch(() => props.selectedSuperRegion, () => core.updateSuperRegion(getProps()));

// Scope (region vs superRegion visibility)
watch(() => props.scope, () => core.updateScope(getProps()));

// Fit bounds to data zoom behavior
watch(() => props.fitBoundsToData, () => core.updateFitBoundsToData(getProps()));

// Border redraws
watch([() => props.showBorders, () => props.borderColor],
  () => core.updateBorders(getProps()));
watch([() => props.showCompositionBorders, () => props.compositionBorderColor],
  () => core.updateCompositionBorders(getProps()));

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());

defineExpose({
  zoomToFeature:            (f, d)  => core.zoomToFeature(f, d),
  zoomToBBox:               (b, d)  => core.zoomToBBox(b, d),
  zoomToFitBounds:          (d)     => core.zoomToFitBounds(d),
  zoomToFitData:            (d)     => core.zoomToFitData(d),
  zoomToSuperRegion:        (id, d) => core.zoomToSuperRegion(id, d),
  zoomToCurrentSuperRegion: (d)     => core.zoomToCurrentSuperRegion(d),
});
</script>
