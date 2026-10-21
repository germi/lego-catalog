<template>
  <div class="relative">
    <span
      :class="['switch-selected-' + currentItem, sliderClass]"
      :style="{
        transform: isRtl
          ? `translate(${-right}px, ${top}px) `
          : `translate(${left}px, ${top}px)`,
        width: `${width}px`,
        height: `${height}px`,
      }"
    ></span>

    <div
      class="relative flex"
      :class="[innerContainerClass]"
      ref="itemsContainer"
      role="tablist"
      aria-orientation="horizontal"
    >
      <template v-for="(item, i) in options" :key="i">
        <RouterLink
          :ref="(el) => (activeItems[item.id] = el)"
          :class="[
            'switch-item-' + i,
            {
              [itemActiveClass]: item.id === active,
              [itemInactiveClass]: item.id !== active,
            },
            itemClass,
          ]"
          :to="item.to"
          :exact="item.exact"
          :aria-label="item.title"
          :aria-current="item.id === active"
          :aria-selected="item.id === active"
          role="tab"
          @click="scrollIntoView"
          @mouseover="hover(item, $event)"
          @mouseleave="$emit('hover', null)"
        >
          <component
            v-if="item.icon"
            :is="item.icon"
            class="pointer-events-none h-5 w-5"
          />
          <span v-if="item.name" class="pointer-events-none"
            ><OTText v-if="useOTText" :value="item.name" /><template v-else>{{
              item.name
            }}</template></span
          >
        </RouterLink>
      </template>
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  useTemplateRef,
} from "vue";
import { useRoute } from "vue-router";

// ----------------------
// Props & Emits
// ----------------------
const props = defineProps({
  options: { type: Array, default: () => [] },
  value: { type: [String, Number], default: "" },
  exact: { type: Boolean, default: false },
  itemClass: {
    type: String,
    default:
      "text-gray-500 rounded-full hover:text-gray-600 transition font-medium py-2 px-4 bg-transparent focus:outline-none",
  },
  itemActiveClass: { type: String, default: "text-gray-600" },
  itemInactiveClass: { type: String, default: "" },
  roundedStyle: { type: String, default: "rounded-full" },
  sliderClass: {
    type: String,
    default:
      "absolute inset-y-0 my-1 w-full bg-white shadow-md rounded-full ease-out transition-all duration-500 switch-selector",
  },
  innerContainerClass: { type: String, default: "" },
  active: { type: String, default: "" },
  useOTText: { type: Boolean, default: true },
});

const emit = defineEmits(["hover"]);

// ----------------------
// Refs (data)
// ----------------------
const width = ref(0);
const left = ref(0);
const right = ref(0);
const height = ref(null);
const top = ref(0);

// ----------------------
// Helpers
// ----------------------
const isRtl = ref(document.dir === "rtl");
const route = useRoute();

// Access template refs
const itemsContainer = ref(null);
const activeItems = ref({}); // For dynamic refs: activeItems.value[props.active]

// ----------------------
// Computed
// ----------------------
const currentItem = computed(() => {
  return props.options.findIndex((e) => e.to.name === route.name);
});

// ----------------------
// Methods
// ----------------------
function hover(data, { target }) {
  emit("hover", { target, data });
}

function setPosition() {
  nextTick(() => {
    // console.log(activeItems.value[props.active]?.$el);
    const el = activeItems.value[props.active]?.$el;

    isRtl.value = document.dir === "rtl";

    if (el) {
      width.value = el.getBoundingClientRect().width;
      left.value = el.offsetLeft;

      if (isRtl.value) {
        right.value =
          itemsContainer.value.clientWidth - el.offsetLeft - width.value;
      } else {
        right.value = 0;
      }
    } else {
      width.value = 0;
      left.value = 0;
      right.value = 0;
    }
  });
}

function removeResizeObserver() {
  if (window.ResizeObserver && resizeObserver) {
    resizeObserver.unobserve(itemsContainer.value);
  } else {
    window.removeEventListener("resize", setPosition);
  }
}

function scrollIntoView() {
  // const el = activeItems.value[props.active]?.[0]?.$el;
  // if (el) el.scrollIntoView();
}

// ----------------------
// Watchers
// ----------------------
watch(
  () => route.fullPath,
  () => setPosition(),
);

// ----------------------
// Resize Observer
// ----------------------
let resizeObserver = null;

onMounted(() => {
  setPosition();

  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => setPosition());
    if (itemsContainer.value) resizeObserver.observe(itemsContainer.value);
  } else {
    window.addEventListener("resize", setPosition);
  }
});

onBeforeUnmount(() => {
  removeResizeObserver();
});
</script>
