<template>
  <div ref="container" class="ot-canvas">
    <svg ref="svgEl" :width="width" :height="height">
      <defs />
      <g
        ref="innerGroupEl"
        :transform="`translate(${margin?.left ?? 0},${margin?.top ?? 0})`"
      />
    </svg>
    <slot />
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount, provide } from "vue";
import { createBaseCanvas } from "../../core/baseCanvas.js";

const props = defineProps({
  adjustSize:      { type: Boolean,            default: false },
  scale:           { type: Number,             default: 0.95 },
  projectionType:  { type: [String, Function], default: "geoMercator" },
  maxZoom:         { type: Number,             default: 16 },
  allowManualZoom: { type: Boolean,            default: true },
  zoomScale:       { type: Number,             default: 1 },
  rotateMode:      { type: Boolean,            default: false },
  northUp:         { type: Boolean,            default: false },
  duration:        { type: Number,             default: 750 },
  skipProjection:  { type: Boolean,            default: false },
  forceSquare:     { type: Boolean,            default: false },
  clampPan:        { type: Boolean,            default: false },
  clampPanInset:   { type: Object,             default: null },
  // Projector system (scatter / XY mode).  Pass an already-fit projector;
  // the canvas no longer needs the data to build one.
  projector:       { default: null },
  margin:          { type: Object,             default: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
  // Layout padding surfaced on the draw payload (payload.padding) so any layer
  // can self-position uniformly via `props.padding ?? payload.padding`. Passed
  // through as data only — innerDims still subtract margin only.
  padding:         { type: Object,             default: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) },
  ease:            { type: String,             default: "easeCubic" },
  // Which axes the canvas's zoom affects ("xy" | "x" | "y" | "none").
  // Forwarded onto `payload.zoomAxes` so every slotted layer can decide
  // whether to rescale x / y without the preset wiring per-layer props.
  zoomAxes:        { type: String,             default: "xy" },
  // Constrains which axes *user gestures* (wheel / drag) are allowed to move.
  // Defaults to null → same as zoomAxes.  Set to "x" to keep user panning
  // x-only while still allowing programmatic zoomToDomain({ y: … }).
  userZoomAxes:    { type: String,             default: null },
});

const emit = defineEmits(["draw", "zoom", "zoom-start", "zoom-end"]);

const container    = ref(null);
const svgEl        = ref(null);
const innerGroupEl = ref(null);
const width        = ref(100);
const height       = ref(100);

const drawSignal = shallowRef(null);
const zoomSignal = shallowRef(null);
// Always-current d3 zoom transform. Manual gestures don't fire draws (they
// dispatch onZoom, which is lighter per-frame) and programmatic zoom
// suppresses onZoom — so neither `draw` nor `zoom` alone is reliable as
// "where the user is looking right now". This ref is updated from BOTH
// paths so a freshly-mounted layer can read the live transform without
// poking at d3.zoomTransform(svgEl) directly.
const liveTransform = shallowRef(null);
provide("draw", drawSignal);
provide("zoom", zoomSignal);
provide("liveTransform", liveTransform);

let core          = null;
let pendingBounds = null;

// fitBounds must be a stable function defined before onMounted — child layer immediate
// watchers (which fire before the parent's onMounted) call controls.fitBounds(fc).
function fitBounds(fc) {
  if (core) core.fitBounds(fc);
  else pendingBounds = fc;
}

const controls = {
  get fitBounds()          { return fitBounds; },
  get zoomToRect()         { return core?.zoomToRect; },
  get animateRotation()    { return core?.animateRotation; },
  get canRotate()          { return core?.canRotate; },
  get projection()         { return core?.projection; },
  get initialRotateScale() { return core?.initialRotateScale; },
  get scale()              { return props.scale; },
  get maxZoom()            { return props.maxZoom; },
  get resetZoom()          { return core?.resetZoom; },
  get zoomIn()             { return core?.zoomIn; },
  get zoomOut()            { return core?.zoomOut; },
  get zoomToScale()        { return core?.zoomToScale; },
  get setTransform()       { return core?.setTransform; },
  get zoomToDomain()       { return core?.zoomToDomain; },
  get width()              { return width; },
  get height()             { return height; },
};
provide("controls", controls);

onMounted(() => {
  core = createBaseCanvas(svgEl.value, container.value, {
    ...props,
    onDraw:   (p) => {
      // Attach innerEl WITHOUT spreading — `{ ...p }` would invoke the payload's
      // live xScale / yScale / zoomTransform getters and freeze them to
      // snapshots, defeating the "read the current zoom at access time"
      // contract that lets a layer mount correctly into an already-zoomed canvas.
      p.innerEl = innerGroupEl.value;
      // Refresh liveTransform BEFORE waking the draw watchers so a layer that
      // mounts in response to this draw sees the matching transform.
      if (p.zoomTransform) liveTransform.value = p.zoomTransform;
      emit("draw", p);
      drawSignal.value = p;
    },
    onZoom:   (t) => {
      // Unwrap the rich { transform, xScale, yScale } event into just the
      // transform — that's what the live signal represents.
      liveTransform.value = t?.transform ?? t;
      zoomSignal.value = t;
      emit("zoom", t);
    },
    // Interactive-gesture lifecycle (wheel/drag start & end only).
    onZoomStart: (e) => emit("zoom-start", e),
    onZoomEnd:   (e) => emit("zoom-end", e),
    onResize: (w, h) => { width.value = w; height.value = h; },
  });
  if (pendingBounds) core.fitBounds(pendingBounds);
  core.init();
});

onBeforeUnmount(() => core?.destroy());

watch(() => props.projectionType,  (v)    => core?.setProjectionType(v));
watch(() => props.zoomScale,       (n, o) => core?.setZoomScale(n, o));
watch(() => props.rotateMode,      (v)    => core?.setRotateMode(v));
watch(() => props.allowManualZoom, (v)    => core?.setAllowManualZoom(v));
watch(() => props.clampPan,        (v)    => core?.setClampPan(v));
watch(() => props.clampPanInset,   (v)    => core?.setClampPanInset(v), { deep: true });
watch(() => props.projector,       (v)    => core?.setProjector(v));
watch(() => props.margin,          (v)    => core?.setMargin(v), { deep: true });
watch(() => props.padding,         (v)    => core?.setPadding(v), { deep: true });
watch(() => props.duration,        (v)    => core?.setDuration(v));
watch(() => props.ease,            (v)    => core?.setEase(v));
watch(() => props.zoomAxes,        (v)    => core?.setZoomAxes(v));
watch(() => props.userZoomAxes,    (v)    => core?.setUserZoomAxes(v));

defineExpose({
  resetZoom:    (...a) => core?.resetZoom(...a),
  zoomIn:       (...a) => core?.zoomIn(...a),
  zoomOut:      (...a) => core?.zoomOut(...a),
  zoomToRect:   (...a) => core?.zoomToRect(...a),
  zoomToScale:  (...a) => core?.zoomToScale(...a),
  setTransform: (...a) => core?.setTransform(...a),
  zoomToDomain: (...a) => core?.zoomToDomain(...a),
  redraw:       (d)    => core?.draw(d),
  width,
  height,
  svgEl: computed(() => svgEl.value),
});
</script>

<style scoped>
.ot-canvas {
  position: relative;
  touch-action: none;
  overscroll-behavior: none;
}
</style>
