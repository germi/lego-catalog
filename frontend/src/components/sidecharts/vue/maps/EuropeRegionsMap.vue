<template>
  <BaseMap
    ref="basemap"
    :topo-data="topoData"
    :topo-object-name="display === 'regions' ? 'nutsrg' : 'cntrg'"
    :feature-accessor="featureAccessor"
    :projection-type="projectionType"
    stroke-color="black"
    :order="1"
    v-bind="$attrs"
  >
    <!--
      Country underlay (cntrg) — rendered first so it sits below the NUTS regions.
      register-bounds="false": nutsrg owns the viewport bounds.
      No data/interaction; just a solid fill to show country shapes behind the regions.
    -->
    <template v-if="display === 'regions'" #before>
      <RegionLayer
        :topo-data="topoData"
        topo-object-name="cntrg"
        :feature-accessor="featureAccessor"
        :register-bounds="false"
        :no-data-color="countriesColor"
        stroke-color="#ccc"
        stroke-color-no-data="orange"
        :stroke-width="1"
        :show-borders="false"
        :show-composition-borders="false"
        :highlight-only-with-data="true"
        :order="0"
      />
    </template>

    <!--
      Kosovo disputed-border overlay. register-bounds="false" so it doesn't
      override the NUTS viewport. no-data-color="none" keeps the fill transparent
      (these are LineString features — only the stroke matters).
    -->
    <RegionLayer
      :topo-data="kosovoTopoData"
      topo-object-name="borders"
      :feature-accessor="(d) => d.properties.id"
      :register-bounds="false"
      no-data-color="none"
      stroke-color="red"
      stroke-color-no-data="red"
      :stroke-width="2"
      stroke-dasharray="4"
      :show-borders="false"
      :show-composition-borders="false"
      :highlight-only-with-data="false"
      :order="2"
    />
    <slot />
  </BaseMap>
</template>

<script setup>
import { ref, markRaw } from "vue";
import raw from "../../assets/maps/eurostat_regions_2024_processed";
import kosovoRaw from "../../assets/maps/kosovo_borders.json";
import BaseMap from "./BaseMap.vue";
import RegionLayer from "../layers/RegionLayer.vue";
import { createMapExpose } from "../composables/useMapExpose.js";

defineOptions({ inheritAttrs: false });

const topoData = markRaw(raw);
const kosovoTopoData = markRaw(kosovoRaw);

defineProps({
  display: { type: String, default: "regions" }, // "regions" | "countries"
  featureAccessor: { type: Function, default: (d) => d.properties?.id },
  projectionType: { type: String, default: "geoIdentity" },
  /** Fill color or texture for the countries underlay layer (cntrg). */
  countriesColor: { type: [String, Object], default: "#e0e0e0" },
});

const basemap = ref(null);
defineExpose(createMapExpose(basemap));
</script>
