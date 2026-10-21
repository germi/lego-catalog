<template>
  <BaseMap
    ref="basemap"
    class="flex justify-center"
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
import { ref } from "vue";
import BaseMap from "./BaseMap.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

defineProps({
  topoData: { type: Object, default: null },
  topoObjectName: { type: String, default: null },
  featureAccessor: { type: Function, default: (d) => d.id },
  projectionType: { type: String, default: "geoIdentity" },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
