<template>
  <BaseMap
    ref="basemap"
    class="flex justify-center"
    :topo-data="topoData"
    topo-object-name="udalerriak"
    :feature-accessor="featureAccessor"
    :projection-type="projectionType"
    :super-region-merge-accessor="superRegionMergeAccessor"
    v-bind="$attrs"
  >
    <slot />
  </BaseMap>
</template>

<script setup>
import { ref, markRaw, onMounted } from "vue";
import BaseMap from "./BaseMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

// udalerriak.json is a very big file, so we import it dynamically. Vite will split it into a separate chunk and only load it when this component is mounted.
const topoData = ref(null);
onMounted(async () => {
  const { default: raw } = await import("../../assets/maps/udalerriak.json");
  topoData.value = markRaw(raw);
});

defineProps({
  featureAccessor: { type: Function, default: (d) => d.properties?.ud_kodea },
  projectionType: { type: String, default: "geoIdentity" },
  superRegionMergeAccessor: {
    type: Function,
    default: (d) => d.properties.es_kod,
  },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
