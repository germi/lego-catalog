<template></template>

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createSegmentLayer, SEGMENT_LAYER_DEFAULTS } from "../../core/segmentLayer.js";

const props = defineProps({
  data:                 { type: Array,    default: () => SEGMENT_LAYER_DEFAULTS.data },
  max:                  { type: Number,   default: SEGMENT_LAYER_DEFAULTS.max },
  scaleType:            { type: String,   default: SEGMENT_LAYER_DEFAULTS.scaleType },
  innerRadius:          { type: Number,   default: SEGMENT_LAYER_DEFAULTS.innerRadius },
  innerRadiusFn:        { type: Function, default: SEGMENT_LAYER_DEFAULTS.innerRadiusFn },
  outerRadiusFn:        { type: Function, default: SEGMENT_LAYER_DEFAULTS.outerRadiusFn },
  cornerRadius:         { type: Number,   default: SEGMENT_LAYER_DEFAULTS.cornerRadius },
  padAngle:             { type: Number,   default: SEGMENT_LAYER_DEFAULTS.padAngle },
  padRadius:            { type: Number,   default: SEGMENT_LAYER_DEFAULTS.padRadius },
  startAngle:           { type: Number,   default: SEGMENT_LAYER_DEFAULTS.startAngle },
  endAngle:             { type: Number,   default: SEGMENT_LAYER_DEFAULTS.endAngle },
  interactive:          { type: Boolean,  default: SEGMENT_LAYER_DEFAULTS.interactive },
  showCursorPointer:    { type: Boolean,  default: SEGMENT_LAYER_DEFAULTS.showCursorPointer },
  fillColor:            {                 default: SEGMENT_LAYER_DEFAULTS.fillColor },
  hoverColor:           {                 default: SEGMENT_LAYER_DEFAULTS.hoverColor },
  strokeColor:          { type: String,   default: SEGMENT_LAYER_DEFAULTS.strokeColor },
  strokeWidth:          { type: Number,   default: SEGMENT_LAYER_DEFAULTS.strokeWidth },
  fillOpacity:          { type: Number,   default: SEGMENT_LAYER_DEFAULTS.fillOpacity },
  strokeOpacity:        { type: Number,   default: SEGMENT_LAYER_DEFAULTS.strokeOpacity },
  useDataColorAsStroke: { type: Boolean,  default: SEGMENT_LAYER_DEFAULTS.useDataColorAsStroke },
  mode:                 { type: String,   default: SEGMENT_LAYER_DEFAULTS.mode },
  angleValue:           { type: Function, default: () => SEGMENT_LAYER_DEFAULTS.angleValue },
  precomputedAngles:    { type: Boolean,  default: SEGMENT_LAYER_DEFAULTS.precomputedAngles },
  order:                { type: Number,   default: SEGMENT_LAYER_DEFAULTS.order },
  layerId:              { type: String,   default: SEGMENT_LAYER_DEFAULTS.layerId },
  series:               { type: Array,    default: () => SEGMENT_LAYER_DEFAULTS.series },
  stacked:              { type: Boolean,  default: SEGMENT_LAYER_DEFAULTS.stacked },
  arcLine:              { type: Boolean,  default: SEGMENT_LAYER_DEFAULTS.arcLine },
});

const emit = defineEmits(["select", "hover"]);

const draw            = inject("draw");
const roseControls    = inject("roseControls");
const roseHighlighted = inject("roseHighlighted");

const core = createSegmentLayer({
  onSelect: (d) => emit("select", d),
  onHover:  (d) => emit("hover",  d),
});

// roseControls is a getter object — passing it by reference keeps all getters live.
const getProps = () => ({ ...props, roseControls });

watch(draw, (payload) => core.render(payload, getProps()), { immediate: true });

watch(
  [
    () => props.data,
    () => props.series,
    () => props.stacked,
    // IMPORTANT: callers MUST pass stable references for innerRadiusFn /
    // outerRadiusFn (e.g. a `const` arrow in <script setup>, not an inline
    // arrow in the template). Inline arrows get a fresh reference on every
    // parent render — including hover-driven re-renders — and would fire a
    // spurious rerender here that starts a new "arc" transition. RoseChart
    // already does this (see hitInnerRadiusFn / segInnerRadiusFn / segOuterRadiusFn).
    () => props.innerRadiusFn,
    () => props.outerRadiusFn,
    () => props.scaleType,
    () => props.max,
    // Visual props — included so live changes (fillOpacity for a fade,
    // strokeWidth for a "grow", colour swaps, cornerRadius/padAngle tweaks)
    // actually trigger a rerender. The core transitions style attrs over
    // `duration` on the update branch so the change animates, not snaps.
    () => props.fillOpacity,
    () => props.strokeOpacity,
    () => props.strokeWidth,
    () => props.strokeColor,
    () => props.fillColor,
    () => props.cornerRadius,
    () => props.padAngle,
    () => props.padRadius,
    () => props.interactive,
    () => props.arcLine,
  ],
  () => core.rerender(getProps()),
  { deep: true },
);

watch(roseHighlighted, (newVal, prevVal) =>
  core.updateHighlight(newVal, prevVal, getProps()),
);

watch(() => props.order, (order) => core.setOrder(order), { immediate: true });

onBeforeUnmount(() => core.destroy());
</script>
