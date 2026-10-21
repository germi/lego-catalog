<template>
  <BaseMap
    ref="basemap"
    :topo-data="topoData"
    topo-object-name="provinces"
    :feature-accessor="featureAccessor"
    :projection-type="projectionType"
    :super-region-merge-accessor="superRegionMergeAccessor"
    :remove-features="removeFeatures"
    v-bind="$attrs"
  >
    <slot />
  </BaseMap>
</template>

<script setup>
import { ref, markRaw } from "vue";
import raw from "../../assets/maps/spain_provinces";
import BaseMap from "./BaseMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";
import { geoConicConformalSpain } from "d3-composite-projections";

defineOptions({ inheritAttrs: false });

const topoData = markRaw(raw);

defineProps({
  featureAccessor: { type: Function, default: (d) => d.properties?.region },
  projectionType: { type: String, default: geoConicConformalSpain },
  superRegionMergeAccessor: {
    type: Function,
    default: (d) => d.properties?.CODNUT1,
  },
  removeFeatures: { type: Array, default: () => [] },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
