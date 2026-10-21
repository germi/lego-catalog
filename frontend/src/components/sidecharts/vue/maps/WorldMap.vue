<template>
  <BaseMap
    ref="basemap"
    :topo-data="topoData"
    topo-object-name="countries"
    :feature-accessor="featureAccessor"
    :remove-features="removeFeatures"
    v-bind="$attrs"
  >
    <slot />
  </BaseMap>
</template>

<script setup>
import { ref, markRaw } from "vue";
import raw from "../../assets/maps/countries-110m";
import codes from "../../assets/maps/country-codes";
import BaseMap from "./BaseMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

const topoData = markRaw(raw);

defineProps({
  featureAccessor: { type: Function, default: (d) => codes[d.id] },
  removeFeatures: { type: Array, default: () => ["ATA"] },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
