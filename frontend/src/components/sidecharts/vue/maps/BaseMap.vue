<template>
  <!--
    BaseMap = BaseCanvas + RegionLayer.
    For maps that need multiple RegionLayers, use BaseCanvas directly.
  -->
  <BaseCanvas
    ref="canvas"
    :adjust-size="adjustSize"
    :scale="scale"
    :projection-type="projectionType"
    :max-zoom="maxZoom"
    :allow-manual-zoom="allowManualZoom"
    :zoom-scale="zoomScale"
    :rotate-mode="rotateMode"
    :north-up="northUp"
    :clamp-pan="clampPan"
    :duration="duration"
    @draw="$emit('draw', $event)"
    @zoom="$emit('zoom', $event)"
  >
    <!--
      "before" slot: layers placed here mount before the main RegionLayer, so their SVG
      groups appear underneath it in z-order. Use for background/underlay layers.
    -->
    <slot name="before" />
    <RegionLayer
      ref="regionLayer"
      :topo-data="topoData"
      :topo-object-name="topoObjectName"
      :remove-features="removeFeatures"
      :remove-features-for-bounds="removeFeaturesForBounds"
      :super-region-merge-accessor="superRegionMergeAccessor"
      :feature-accessor="featureAccessor"
      :data="data"
      :data-accessor="dataAccessor"
      :color="color"
      :highlight-color="highlightColor"
      :no-data-color="noDataColor"
      :stroke-color="strokeColor"
      :stroke-color-no-data="strokeColorNoData"
      :show-borders="showBorders"
      :border-color="borderColor"
      :show-composition-borders="showCompositionBorders"
      :composition-border-color="compositionBorderColor"
      :stroke-width="strokeWidth"
      :super-region-stroke-width="superRegionStrokeWidth"
      :selected-stroke-dasharray="selectedStrokeDasharray"
      :highlighted="highlighted"
      :highlighted-stroke-width="highlightedStrokeWidth"
      :highlighted-stroke-dasharray="highlightedStrokeDasharray"
      :highlight-only-with-data="highlightOnlyWithData"
      :duration="duration"
      :scope="scope"
      :selected-super-region="selectedSuperRegion"
      :fit-bounds-to-data="fitBoundsToData"
      :extent="extent"
      :order="order"
      @select="$emit('select', $event)"
      @hover="$emit('hover', $event)"
      @super-region-click="$emit('superRegionClick', $event)"
    />
    <slot />
  </BaseCanvas>
</template>

<script setup>
import { ref, computed } from "vue";
import BaseCanvas from "../canvas/BaseCanvas.vue";
import RegionLayer from "../layers/RegionLayer.vue";

// -- PROPS & EMITS --
const props = defineProps({
  topoData: { type: Object, default: null },
  topoObjectName: { type: String, default: null },
  removeFeatures: { type: Array, default: () => [] },
  removeFeaturesForBounds: { type: Array, default: () => [] },
  superRegionMergeAccessor: { type: Function, default: null },
  featureAccessor: { type: Function, default: (d) => d.id },
  data: { type: Object, default: () => ({}) },
  dataAccessor: { type: Function, default: (d) => d?.value },
  color: {
    type: [Object, Function],
    default: () => ({ min: "#DBEAFE", max: "#1E3A8A" }),
  },
  highlightColor: { type: String, default: "black" },
  noDataColor: { type: [String, Object], default: "#DDDEDD" },
  strokeColor: { type: String, default: "#fff" },
  strokeColorNoData: { type: String, default: "#fff" },
  showBorders: { type: Boolean, default: false },
  borderColor: { type: String, default: "white" },
  showCompositionBorders: { type: Boolean, default: true },
  compositionBorderColor: { type: String, default: "#666" },
  strokeWidth: { type: Number, default: 1 },
  superRegionStrokeWidth: { type: Number, default: 2 },
  selectedStrokeDasharray: { type: String, default: "none" },
  highlighted: { type: [Number, String], default: null },
  highlightedStrokeWidth: { type: Number, default: null },
  highlightedStrokeDasharray: { type: String, default: "none" },
  adjustSize: { type: Boolean, default: false },
  scale: { type: Number, default: 0.95 },
  extent: { type: Array, default: null },
  projectionType: { type: [String, Function], default: "geoMercator" },
  maxZoom: { type: Number, default: 16 },
  fitBoundsToData: { type: Boolean, default: false },
  allowManualZoom: { type: Boolean, default: true },
  zoomScale: { type: Number, default: 1 },
  highlightOnlyWithData: { type: Boolean, default: true },
  duration: { type: Number, default: 750 },
  scope: { type: String, default: "region" },
  selectedSuperRegion: { type: [String, Number], default: null },
  rotateMode: { type: Boolean, default: false },
  northUp: { type: Boolean, default: false },
  clampPan: { type: Boolean, default: false },
  order: { type: Number, default: undefined },
});

defineEmits(["select", "hover", "zoom", "superRegionClick", "draw"]);

// -- REFS --
const canvas = ref(null);
const regionLayer = ref(null);

// -- EXPOSE --
defineExpose({
  // Generic canvas mechanics — forwarded from BaseCanvas
  resetZoom: (...args) => canvas.value?.resetZoom(...args),
  zoomIn:    (...args) => canvas.value?.zoomIn(...args),
  zoomOut:   (...args) => canvas.value?.zoomOut(...args),
  // Geo zoom — owned by RegionLayer (it holds the features and projection)
  zoomToFeature:            (...args) => regionLayer.value?.zoomToFeature(...args),
  zoomToBBox:               (...args) => regionLayer.value?.zoomToBBox(...args),
  zoomToFitBounds:          (...args) => regionLayer.value?.zoomToFitBounds(...args),
  zoomToFitData:            (...args) => regionLayer.value?.zoomToFitData(...args),
  zoomToSuperRegion:        (...args) => regionLayer.value?.zoomToSuperRegion(...args),
  zoomToCurrentSuperRegion: (...args) => regionLayer.value?.zoomToCurrentSuperRegion(...args),
  // animateToProjection is driven automatically by BaseCanvas watching :projection-type.
  // Kept as a no-op for backward compatibility with callers that invoke it directly.
  animateToProjection: () => {},
  // Dimensions
  width:  computed(() => canvas.value?.width),
  height: computed(() => canvas.value?.height),
});
</script>
