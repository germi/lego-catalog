<template>
  <BaseMap
    ref="basemap"
    :topo-data="topoData"
    topo-object-name="municipis"
    :feature-accessor="featureAccessor"
    :projection-type="projectionType"
    :super-region-merge-accessor="superRegionMergeAccessor"
    v-bind="$attrs"
  >
    <slot />
  </BaseMap>
</template>

<script setup>
import { ref, markRaw } from "vue";
import raw from "../../assets/maps/municipis";
import BaseMap from "./BaseMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

const topoData = markRaw(raw);

defineProps({
  featureAccessor: { type: Function, default: (d) => d.properties?.MUNICIPI },
  projectionType: { type: String, default: "geoIdentity" },
  superRegionMergeAccessor: { type: Function, default: (d) => d.properties?.COMARCA },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
