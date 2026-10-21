import { computed } from "vue";

/**
 * Returns the standard public API object for map wrapper components.
 * Pass the result directly to defineExpose().
 */
export function createMapExpose(basemapRef) {
  return {
    resetZoom: (...args) => basemapRef.value?.resetZoom(...args),
    zoomIn: (...args) => basemapRef.value?.zoomIn(...args),
    zoomOut: (...args) => basemapRef.value?.zoomOut(...args),
    zoomToFeature: (...args) => basemapRef.value?.zoomToFeature(...args),
    zoomToFitBounds: (...args) => basemapRef.value?.zoomToFitBounds(...args),
    zoomToFitData: (...args) => basemapRef.value?.zoomToFitData(...args),
    zoomToBBox: (...args) => basemapRef.value?.zoomToBBox(...args),
    animateToProjection: (...args) => basemapRef.value?.animateToProjection(...args),
    zoomToSuperRegion: (...args) => basemapRef.value?.zoomToSuperRegion(...args),
    zoomToCurrentSuperRegion: (...args) => basemapRef.value?.zoomToCurrentSuperRegion(...args),
    // Reactive SVG dimensions — Vue unwraps computed refs on template-ref access.
    width: computed(() => basemapRef.value?.width),
    height: computed(() => basemapRef.value?.height),
  };
}
