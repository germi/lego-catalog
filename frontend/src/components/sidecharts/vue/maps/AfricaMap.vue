<template>
  <WorldMap
    ref="worldmap"
    :remove-features="removeFeatures"
    v-bind="$attrs"
  >
    <slot />
  </WorldMap>
</template>

<script>
import codes from "../../assets/maps/country-codes.json";

const AFRICA = new Set([
  "DZA","EGY","LBY","MAR","SDN","TUN","ESH",
  "BEN","BFA","CPV","CIV","GMB","GHA","GIN","GNB","LBR","MLI","MRT","NER","NGA","SEN","SLE","TGO",
  "AGO","CMR","CAF","TCD","COD","GNQ","GAB","COG","STP",
  "BDI","COM","DJI","ERI","ETH","KEN","MDG","MWI","MUS","MOZ","RWA","SOM","SSD","TZA","UGA","ZMB","ZWE",
  "BWA","LSO","NAM","ZAF","SWZ",
]);

export const ALL_NON_AFRICA = Object.values(codes).filter((c) => !AFRICA.has(c));
</script>

<script setup>
import { ref } from "vue";
import WorldMap from "./WorldMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

defineProps({
  removeFeatures: { type: Array, default: () => ALL_NON_AFRICA },
});

const worldmap = ref(null);
defineExpose(createMapExpose(worldmap));
</script>
