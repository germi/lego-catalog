<template>
  <div
    :class="[{ 'pt-1': !compact }, itemClass]"
    class="-mx-2 cursor-pointer rounded px-2 py-0.5"
    @click="$emit('select', { target: $refs.colorBar, data: item })"
    @mouseover="$emit('hover', { target: $refs.colorBar, data: item })"
    @mouseleave="$emit('hover', null)"
  >
    <!-- LABEL (above bar) -->
    <div
      v-if="showName && !compact"
      class="ot-bar-name relative mb-1 truncate text-sm"
    >
      {{ item.name }}
    </div>

    <!-- Flex wrapper: active when nameStart or numberOuter -->
    <div :class="nameStart || numberOuter ? 'flex items-center gap-2' : ''">
      <slot name="before" />
      <!-- NAME: outside-start -->
      <span
        v-if="showName && nameStart"
        class="ot-bar-name shrink-0 truncate text-sm"
        :class="nameAlignEnd ? 'text-end' : 'text-start'"
        :style="nameWidth ? { width: nameWidth } : {}"
        >{{ item.name }}</span
      >

      <!-- NUMBER: outside-start -->
      <span
        v-if="showNumber && numberOuter && !numberEnd"
        class="shrink-0 text-end text-sm tabular-nums"
        :style="numSpanStyle"
        >{{ item.displayValue || format(item.value) }}</span
      >

      <!-- BAR -->
      <div
        class="relative flex min-w-0 flex-1 items-center"
        :class="{
          rounded,
          'min-h-6': small,
          'min-h-8': !small,
          [highlightClass]: item.id === highlighted,
        }"
        :style="{ background: bgColor }"
      >
        <!-- LABEL pinned to zero axis -->
        <div
          class="ot-bar-label absolute inset-y-0 z-10 flex items-center"
          :class="{
            'px-1 text-xs': small,
            'px-3 text-sm': !small,
            'flex-row-reverse': isNegative,
          }"
          :style="
            isNegative
              ? { right: `${100 - zeroOffset}%` }
              : { left: `${zeroOffset}%` }
          "
        >
          <span
            v-if="showNumber && !numberEnd && !numberOuter"
            class="ot-bar-value inline-block font-semibold transition-all"
            :class="[
              isNegative ? 'ms-1.5 pe-1 text-start' : 'me-1.5 ps-1 text-end',
            ]"
            :style="numSpanStyle"
            >{{ item.displayValue || format(item.value) }}</span
          >
          <span>&nbsp;</span>
          <!-- name: inside bar (compact mode, only when not using nameStart) -->
          <span v-if="showName && compact && !nameStart" class="ot-bar-name">{{
            item.name
          }}</span>
        </div>

        <!-- BAR COLOR -->
        <div
          class="ot-bar-color absolute inset-y-0 flex items-center"
          ref="colorBar"
          :class="{
            [item.class]: true,
            'text-xs': small,
            'text-sm': !small,
            rounded,
            'flex-row-reverse': isNegative && numberEnd && !numberOuter,
          }"
        >
          <!-- VALUE: inside-end (mirrored for negative bars) -->
          <div class="flex-grow">&nbsp;</div>
          <span
            v-if="showNumber && numberEnd && !numberOuter"
            class="ot-bar-value inline-block transition-all"
            :class="
              isNegative ? 'ms-1.5 pe-0.5 text-start' : 'me-1.5 ps-0.5 text-end'
            "
            :style="numSpanStyle"
            >{{ item.displayValue || format(item.value) }}</span
          >
          <span v-else>&nbsp;</span>
        </div>

        <!-- COMPARE MARK -->
        <div
          v-if="item.compare !== null && item.compare !== undefined"
          ref="compare"
          class="ot-bar-compare absolute inset-y-0 h-full w-1 -translate-x-0.5 rounded print:hidden"
          style="opacity: 0"
        ></div>
      </div>

      <!-- NUMBER: outside-end -->
      <span
        v-if="showNumber && numberOuter && numberEnd"
        class="shrink-0 text-end text-sm tabular-nums"
        :style="numSpanStyle"
        >{{ item.displayValue || format(item.value) }}</span
      >
      <slot name="after" />
    </div>
    <!-- end flex wrapper -->
  </div>
</template>

<script>
import { ref } from "vue";
import gsap from "gsap";
import { BAR_CHART_ITEM_DEFAULTS as D } from "../presets/BarChart.defaults.js";

export default {
  name: "BarChartItem",
  props: {
    item: {
      type: Object,
      default: () => ({ id: "1", name: "Data 1", value: 30 }),
    },
    max:            { type: Number,             default: D.max },
    min:            { type: Number,             default: D.min },
    color:          { type: [String, Function], default: D.color },
    compareColor:   { type: [String, Function], default: D.compareColor },
    compact:        { type: Boolean,            default: D.compact },
    duration:       { type: Number,             default: D.duration },
    showName:       { type: Boolean,            default: D.showName },
    showNumber:     { type: Boolean,            default: D.showNumber },
    bgColor:        { type: String,             default: D.bgColor },
    delayEnter:     { type: Number,             default: D.delayEnter },
    small:          { type: Boolean,            default: D.small },
    numberEnd:      { type: Boolean,            default: D.numberEnd },
    numberOuter:    { type: Boolean,            default: D.numberOuter },
    nameStart:      { type: Boolean,            default: D.nameStart },
    nameWidth:      { type: String,             default: D.nameWidth },
    nameAlignEnd:   { type: Boolean,            default: D.nameAlignEnd },
    rounded:        { type: Boolean,            default: D.rounded },
    itemClass:      { type: String,             default: D.itemClass },
    format:         { type: Function,           default: D.format },
    highlighted:    { type: [String, Number],   default: D.highlighted },
    highlightClass: { type: String,             default: D.highlightClass },
    numWidth:       { type: Number,             default: D.numWidth },
  },
  emits: ["hover", "select"],
  setup() {
    const colorBar = ref(null); // bar element
    const compare = ref(null); // compare mark element
    return { colorBar, compare };
  },
  mounted() {
    this.animateEnter();
  },
  watch: {
    item() {
      this.animateChange();
    },
  },
  computed: {
    barColor() {
      if (this.item.color) return this.item.color;
      if (typeof this.color === "function") return this.color(this.item.value);
      return this.color;
    },
    colorCompare() {
      if (this.item.compareColor) return this.item.compareColor;
      if (typeof this.compareColor === "function")
        return this.compareColor(this.item.compare);
      return this.compareColor;
    },
    isNegative() {
      return this.item.value < 0;
    },
    // total range across min→max
    barRange() {
      return this.max - this.min;
    },
    // where the zero axis sits as a % from the left
    zeroOffset() {
      return this.min < 0 ? (-this.min / this.barRange) * 100 : 0;
    },
    // left edge of the colored bar
    barLeft() {
      if (this.item.value >= 0) return `${this.zeroOffset}%`;
      return `${((this.item.value - this.min) / this.barRange) * 100}%`;
    },
    // width of the colored bar
    barWidth() {
      const absVal = Math.abs(this.item.value);
      return `max(${(absVal / this.barRange) * 100}%, 2px)`;
    },
    // left position of the compare mark
    compareLeft() {
      if (this.item.compare === null || this.item.compare === undefined)
        return null;
      return `${((this.item.compare - this.min) / this.barRange) * 100}%`;
    },
    // compute width for value label
    numSpanStyle() {
      const len =
        this.numWidth ??
        (this.item.displayValue || this.format(this.item.value)).length;
      return { width: `${len + 0}ch` };
    },
  },
  methods: {
    animateEnter() {
      // bar: always grows outward from the zero axis
      gsap.fromTo(
        this.$refs.colorBar,
        {
          left: `${this.zeroOffset}%`,
          width: "0%",
          backgroundColor: this.barColor,
        },
        {
          duration: this.duration,
          delay: this.delayEnter,
          // ease: "power4.out",
          left: this.barLeft,
          width: this.barWidth,
          backgroundColor: this.barColor,
        },
      );
      // compare
      if (this.item.compare !== null && this.item.compare !== undefined) {
        gsap.fromTo(
          this.$refs.compare,
          {
            left: `${this.zeroOffset}%`,
            backgroundColor: this.colorCompare,
            opacity: 0,
          },
          {
            duration: this.duration,
            delay: this.delayEnter,
            // ease: "power4.out",
            left: this.compareLeft,
            backgroundColor: this.colorCompare,
            opacity: 1,
          },
        );
      }
    },
    animateChange() {
      // bar
      gsap.to(this.$refs.colorBar, {
        duration: this.duration,
        // ease: "back.inOut(1.7)",
        left: this.barLeft,
        width: this.barWidth,
        backgroundColor: this.barColor,
      });

      // compare
      if (this.item.compare !== null && this.item.compare !== undefined) {
        gsap.to(this.$refs.compare, {
          duration: this.duration,
          // ease: "back.inOut(1.7)",
          left: this.compareLeft,
          backgroundColor: this.colorCompare,
          opacity: 1,
        });
      } else {
        gsap.to(this.$refs.compare, {
          duration: this.duration,
          opacity: 0,
        });
      }
    },
  },
};
</script>
