<template>
  <transition-group
    :name="transitionName"
    tag="ul"
    :class="{ 'space-y-0': small, 'space-y-1': !small }"
    :style="{ '--dur': `${props.duration}s` }"
    class="relative"
  >
    <li
      v-for="item in dataWithComponents"
      :key="item.name"
      :ref="
        (el) => {
          if (el) items[item.name] = el;
        }
      "
    >
      <slot v-bind="{ item, component: item.component }">
        <component :is="item.component" />
      </slot>
    </li>
  </transition-group>
</template>

<script setup>
import {
  ref,
  toRefs,
  watch,
  onBeforeUpdate,
  onMounted,
  computed,
  useSlots,
  h,
} from "vue";
import BarChartItem from "./BarChartItem.vue";
import gsap from "gsap";
import { BAR_CHART_DEFAULTS as D } from "../presets/BarChart.defaults.js";

// PROPS
const props = defineProps({
  data:           { type: Array,            default: () => D.data },
  max:            { type: Number,           default: D.max },
  min:            { type: Number,           default: D.min },
  duration:       { type: Number,           default: D.duration },
  color:          { type: [String, Function], default: D.color },
  compareColor:   { type: [String, Function], default: D.compareColor },
  small:          { type: Boolean,          default: D.small },
  compact:        { type: Boolean,          default: D.compact },
  showName:       { type: Boolean,          default: D.showName },
  showNumber:     { type: Boolean,          default: D.showNumber },
  numberEnd:      { type: Boolean,          default: D.numberEnd },
  numberOuter:    { type: Boolean,          default: D.numberOuter },
  nameStart:      { type: Boolean,          default: D.nameStart },
  nameWidth:      { type: String,           default: D.nameWidth },
  nameAlignEnd:   { type: Boolean,          default: D.nameAlignEnd },
  bgColor:        { type: String,           default: D.bgColor },
  rounded:        { type: Boolean,          default: D.rounded },
  itemClass:      { type: String,           default: D.itemClass },
  format:         { type: Function,         default: D.format },
  highlighted:    { type: [String, Number], default: D.highlighted },
  highlightClass: { type: String,           default: D.highlightClass },
});

// EMITS
const emits = defineEmits(["hover", "select"]);

const slots = useSlots();
const { data, max, min } = toRefs(props);

// use given max or compute from data (clamped to 0 so purely negative data stays unchanged)
const computedMax = computed(() => {
  if (max.value !== null) return max.value;
  return Math.max(
    0,
    ...data.value.map((e) => Math.max(e.value, e.compare ?? e.value)),
  );
});

// use given min or compute from data (clamped to 0 so purely positive data stays unchanged)
const computedMin = computed(() => {
  if (min.value !== null) return min.value;
  const allValues = data.value.flatMap((e) => [
    e.value,
    e.compare !== null && e.compare !== undefined ? e.compare : e.value,
  ]);
  return Math.min(0, Math.min(...allValues));
});

// Plain variable (non-reactive) — updated in the data watcher before each render cycle.
let currentDelayEnter = 0;
const transitionName = ref("");

onMounted(() => {
  transitionName.value = "flip-list";
});

// max formatted label length across all items — so all items share the same number span width
const maxFormattedLength = computed(() =>
  Math.max(
    ...data.value.map(
      (item) => (item.displayValue || props.format(item.value)).length,
    ),
  ),
);

// render function for emitting the slot
const renderSlot = (item) => {
  return h(
    BarChartItem,
    {
      item,
      ...props,
      max: computedMax.value,
      min: computedMin.value,
      numWidth: maxFormattedLength.value,
      delayEnter: currentDelayEnter,
      onHover: (e) => emits("hover", e),
      onSelect: (e) => emits("select", e),
    },
    {
      before: slots.before ? () => slots.before({ item }) : undefined,
      after: slots.after ? () => slots.after({ item }) : undefined,
    },
  );
};

// DATA ANIMATION
const items = ref({});

onBeforeUpdate(() => {
  items.value = {};
});

const computedData = ref(data.value);

const dataWithComponents = computed(() => {
  if (!data.value) return [];
  return data.value.map((item) => ({
    ...item,
    component: renderSlot(item),
  }));
});

watch(data, (newVal, oldVal) => {
  // WHICH ARE EXITING
  const exit = oldVal.filter((e1) => !newVal.find((e2) => e2.name === e1.name));

  currentDelayEnter = exit.length ? 1 : 0;
  transitionName.value = exit.length ? "flip-list" : "flip-list-fast";

  // only if there are exiting elements
  if (exit.length) {
    // first hide the exiting elements (if we do it with Vue's CSS animations,
    // the exiting elements move vertically, an unwanted side effect)
    exit.forEach((e) => {
      gsap.to(items.value[e.name], {
        duration: props.duration,
        opacity: 0,
      });
    });

    // and then we replace the data
    // which will update the current elements
    // and then trigger the entering Vue CSS transition animation
    setTimeout(() => {
      computedData.value = newVal;
    }, props.duration * 1000);
  }
  // otherwise, do it right away
  else computedData.value = newVal;
});
</script>

<style scoped>
.flip-list-move,
.flip-list-fast-move {
  transition: transform var(--dur) ease var(--dur);
}

/* LEAVE */

.flip-list-leave-to,
.flip-list-fast-leave-to {
  opacity: 0;
}

.flip-list-leave-active,
.flip-list-fast-leave-active {
  position: absolute;
  width: 100%;
}

/* ENTER — with delay (after exits+reposition: 1x exit + 1x reposition = 2x dur) */
.flip-list-enter-active {
  transition: opacity var(--dur) ease-in-out calc(var(--dur) * 2);
}

/* ENTER — no delay (initial load or no exits) */
.flip-list-fast-enter-active {
  transition: opacity var(--dur) ease-in-out 0ms;
}

.flip-list-enter-from,
.flip-list-fast-enter-from {
  opacity: 0;
}

.flip-list-enter-to,
.flip-list-fast-enter-to {
  opacity: 1;
}
</style>
