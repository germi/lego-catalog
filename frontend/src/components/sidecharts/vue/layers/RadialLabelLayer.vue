<template></template>

<script setup>
import { inject, watch, onBeforeUnmount } from "vue";
import { createRadialLabelLayer, RADIAL_LABEL_LAYER_DEFAULTS } from "../../core/radialLabelLayer.js";

const props = defineProps({
  data:               { type: Array,    default: () => RADIAL_LABEL_LAYER_DEFAULTS.data },
  max:                { type: Number,   default: RADIAL_LABEL_LAYER_DEFAULTS.max },
  scaleType:          { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.scaleType },
  labelKey:           { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.labelKey },
  labelsOutside:      { type: Boolean,  default: RADIAL_LABEL_LAYER_DEFAULTS.labelsOutside },
  circularLabels:     { type: Boolean,  default: RADIAL_LABEL_LAYER_DEFAULTS.circularLabels },
  lineLabelDistance:  { type: Number,   default: RADIAL_LABEL_LAYER_DEFAULTS.lineLabelDistance },
  paddingLineLabel:   { type: Number,   default: RADIAL_LABEL_LAYER_DEFAULTS.paddingLineLabel },
  radiusFn:           { type: Function, default: RADIAL_LABEL_LAYER_DEFAULTS.radiusFn },
  outerRadiusFn:      { type: Function, default: RADIAL_LABEL_LAYER_DEFAULTS.outerRadiusFn },
  showLabels:         { type: Boolean,  default: RADIAL_LABEL_LAYER_DEFAULTS.showLabels },
  maxLabelWidth:      { type: Number,   default: RADIAL_LABEL_LAYER_DEFAULTS.maxLabelWidth },
  showValues:         { type: Boolean,  default: RADIAL_LABEL_LAYER_DEFAULTS.showValues },
  valueKey:           { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.valueKey },
  valueSeries:        { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.valueSeries },
  format:             { type: Function, default: () => RADIAL_LABEL_LAYER_DEFAULTS.format },
  minAngle:           { type: Number,   default: RADIAL_LABEL_LAYER_DEFAULTS.minAngle },
  textColor:          { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.textColor },
  valueLabelColor:    { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.valueLabelColor },
  fontSize:           { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.fontSize },
  valueFontSize:      { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.valueFontSize },
  fontWeight:         { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.fontWeight },
  valueFontWeight:    { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.valueFontWeight },
  mode:               { type: String,   default: RADIAL_LABEL_LAYER_DEFAULTS.mode },
  angleValue:         { type: Function, default: () => RADIAL_LABEL_LAYER_DEFAULTS.angleValue },
  order:              { type: Number,   default: RADIAL_LABEL_LAYER_DEFAULTS.order },
});

const draw         = inject("draw");
const roseControls = inject("roseControls");
const core         = createRadialLabelLayer();
const getProps     = () => ({ ...props, roseControls });

watch(draw, (payload) => core.render(payload, getProps()), { immediate: true });
watch(() => props.data, () => core.rerender(getProps()), { deep: true });
watch(() => props.order, (order) => core.setOrder(order), { immediate: true });
onBeforeUnmount(() => core.destroy());
</script>
