<template>
  <BaseMap
    ref="basemap"
    :topo-data="topoData"
    topo-object-name="states"
    :feature-accessor="featureAccessor"
    :projection-type="projectionType"
    v-bind="$attrs"
  >
    <slot />
  </BaseMap>
</template>

<script setup>
import { ref, markRaw } from "vue";
import raw from "../../assets/maps/states-10m";
import BaseMap from "./BaseMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

const topoData = markRaw(raw);

defineProps({
  featureAccessor: { type: Function, default: (d) => d.id },
  projectionType: { type: String, default: "geoAlbersUsa" },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
