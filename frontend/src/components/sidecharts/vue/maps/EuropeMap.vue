<template>
  <BaseMap
    ref="basemap"
    :topo-data="topoData"
    :topo-object-name="topoObjectName"
    :feature-accessor="featureAccessor"
    :projection-type="projectionType"
    v-bind="$attrs"
  >
    <slot />
  </BaseMap>
</template>

<script setup>
import { ref, markRaw } from "vue";
import raw from "../../assets/maps/eurostat_regions_2024_processed";
import BaseMap from "./BaseMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

const topoData = markRaw(raw);

defineProps({
  featureAccessor: { type: Function, default: (d) => d.properties?.id },
  projectionType: { type: String, default: "geoIdentity" },
  topoObjectName: { type: String, default: "cntrg" },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
