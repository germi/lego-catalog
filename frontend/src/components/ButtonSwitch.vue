<template>
  <div class="relative" :class="mainClass">
    <span
      :class="['switch-selected-' + currentItem, sliderClass]"
      :style="{
        transform: `translate(${left}px, ${top}px)`,
        width: `${width}px`,
        height: `${height}px`,
      }"
    ></span>

    <div class="relative" :class="[innerContainerClass]" ref="itemsContainer">
      <button
        v-for="(item, i) in internalOptions"
        :key="i"
        :ref="
          (el) => {
            items[item.id] = el;
          }
        "
        :class="[
          'switch-item-' + i,
          { [itemActiveClass]: item.id == modelValue },
          itemClass,
        ]"
        @click="select(item, $event)"
        @mouseenter="$emit('hover', { target: $event.target, data: item })"
        @mouseleave="$emit('hover', null)"
      >
        <component
          v-if="item.icon"
          :is="item.icon"
          class="pointer-events-none inline-block h-4 w-4"
          :class="{ 'me-1': item.name }"
        />
        <span v-if="item.name" class="pointer-events-none">{{
          item.name
        }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { ref } from "vue";

export default {
  props: {
    options: {
      type: Array,
      default: () => [
        { name: "Lorem", id: 1 },
        { name: "Ipsum", id: 2 },
        { name: "Dolor sit amet", id: 3 },
        { name: "Consectetur", id: 4 },
      ],
    },
    modelValue: {
      type: [String, Number, Boolean],
      default: 1,
    },
    itemClass: {
      type: String,
      default:
        "text-gray-600 rounded-full hover:text-gray-700 font-medium py-2 px-4 bg-transparent focus:outline-none",
    },
    itemActiveClass: {
      type: String,
      default: "text-gray-600",
    },
    sliderClass: {
      type: String,
      default:
        "absolute inset-y-0 my-1 bg-white shadow-md rounded-full ease-out transition-all duration-500 switch-selector",
    },
    innerContainerClass: {
      type: String,
      default: "",
    },
    mainClass: {
      type: String,
      default: "rounded-full bg-gray-100 p-1 text-sm shadow-inner inline-block",
    },
  },
  data() {
    return {
      width: 0,
      left: 0,
      height: null,
      top: 0,
    };
  },
  setup() {
    const itemsContainer = ref(null);
    const items = ref({});

    return {
      itemsContainer,
      items,
    };
  },
  computed: {
    currentItem() {
      return this.internalOptions.findIndex((e) => e.id === this.modelValue);
    },
    internalOptions() {
      return this.options.map((e) => {
        if (typeof e === "object") return e;
        return {
          id: e,
          name: e,
        };
      });
    },
  },
  watch: {
    modelValue() {
      this.setPosition();
    },
  },
  mounted() {
    this.setPosition();

    // https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
    if (ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.setPosition();
      });

      this.resizeObserver.observe(this.itemsContainer);
    } else {
      // for IE
      window.addEventListener("resize", this.setPosition);
    }
  },
  beforeUnmount() {
    this.removeResizeObserver();
  },
  methods: {
    removeResizeObserver() {
      if (ResizeObserver) {
        this.resizeObserver.unobserve(this.itemsContainer);
      } else {
        // for IE
        window.removeEventListener("resize", this.setPosition);
      }
    },
    select(item, { target }) {
      this.width = target.getBoundingClientRect().width;
      this.left = target.offsetLeft;

      this.height = target.getBoundingClientRect().height;
      this.top = target.offsetTop;

      this.$emit("update:modelValue", item.id);
    },
    setPosition() {
      this.$nextTick(function () {
        const el = this.items[this.modelValue];

        if (el) {
          this.width = el.getBoundingClientRect().width;
          this.left = el.offsetLeft;

          this.height = el.getBoundingClientRect().height;
          this.top = el.offsetTop;
        }
      });
    },
  },
};
</script>
