<template>
  <div ref="container" class="rose-chart-container">
    <svg
      ref="svgEl"
      class="rose-chart overflow-visible print:h-full print:w-full"
      :width="width"
      :height="height"
    >
      <defs>
        <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
          <stop class="stop1" offset="0%" stop-color="rgba(42, 157, 143, 1)" />
          <stop
            class="stop2"
            offset="100%"
            stop-color="rgba(255, 219, 100, 1)"
          />
        </linearGradient>
      </defs>
    </svg>
    <slot />
  </div>
</template>

<script setup>
import * as d3 from "d3";
import {
  ref,
  shallowRef,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  provide,
  toRef,
} from "vue";

// -- PROPS & EMITS --
const props = defineProps({
  data: {
    type: Array,
    default: () => [
      { id: 1, name: "Val 1", value: 70, color: "#bbbbbb", min: 50, max: 100 },
      { id: 2, name: "Val 2", value: 79, color: "teal", min: 60, max: 90 },
      { id: 3, name: "Val 3", value: 45, color: "salmon", min: 30, max: 70 },
      { id: 4, name: "Val 4", value: 25, color: "purple", min: 10, max: 50 },
    ],
  },
  duration: { type: Number, default: 500 },
  padAngle: { type: Number, default: 0.1 },
  padRadius: { type: Number, default: 0.25 },
  cornerRadius: { type: Number, default: 0 },
  labelsOutside: { type: Boolean, default: true },
  highlighted: { type: [String, Number], default: null },
  hoverColor: { type: String, default: "#f9fafb" },
  bgColor: { type: String, default: "transparent" },
  showCursorPointer: { type: Boolean, default: true },
  showLabels: { type: Boolean, default: true },
  margin: { type: Number, default: 5 },
  startAngle: { type: Number, default: 0 },
  endAngle: { type: Number, default: 360 },
  max: { type: Number, default: null },
  maxLabelWidth: { type: Number, default: 150 },
});

const emit = defineEmits(["select", "hover"]);

// -- TEMPLATE REFS --
const container = ref(null);
const svgEl = ref(null);

// -- LOCAL STATE --
const width = ref(200);
const height = ref(200);

// -- D3 STATE --
const svgGroup = shallowRef(null);

// -- LAYER SIGNAL PROVIDES --
// Provided to all layer components in the slot via inject("roseDraw").
// Layers watch this ref to know when to (re)draw.
const roseDraw = shallowRef(null);
provide("roseDraw", roseDraw);

// Highlighted provided as a reactive ref so layers can watch it independently
// without needing a full redraw signal for lightweight color-only updates.
provide("roseHighlighted", toRef(props, "highlighted"));

// -- COMPUTED DATA --

const processedData = computed(() => {
  if (!props.data.length || !props.data[0].values) {
    return props.data.map((item, index) => ({
      id: item.id ?? index + 1,
      name: item.name,
      value: item.value,
      color: item.color,
      min: item.min,
      max: item.max,
      hoverColor: item.hoverColor,
      textColor: item.textColor,
      refValue: item.refValue,
    }));
  }
  // Nested data: aggregate values across entries
  const valueMap = {};
  props.data.forEach((entry) => {
    Object.keys(entry.values).forEach((key) => {
      const item = entry.values[key];
      if (!valueMap[key]) {
        valueMap[key] = {
          id: key,
          name: item.name,
          total: 0,
          count: 0,
          color: item.color,
        };
      }
      valueMap[key].total += item.value;
      valueMap[key].count += 1;
    });
  });
  return Object.keys(valueMap).map((key, index) => {
    const { name, total, count, color } = valueMap[key];
    return { id: index + 1, name, value: Math.round(total / count), color };
  });
});

const computedMax = computed(() => {
  if (props.max) return props.max;
  return (
    d3.max(processedData.value, (d) =>
      d3.max([d.value, d.refValue ?? 0, d.max ?? 0, d.min ?? 0]),
    ) || 100
  );
});

const radius = computed(
  () => Math.min(width.value, height.value) / 2 - props.margin,
);

// All slices get the same value (computedMax) so the pie divides the circle equally.
// Each variant's layer then scales the radius based on actual data values.
const pie = computed(() =>
  d3
    .pie()
    .startAngle((props.startAngle * Math.PI) / 180)
    .endAngle((props.endAngle * Math.PI) / 180)
    .value(computedMax.value),
);

const arcs = computed(() => pie.value(processedData.value));

// -- CONTROLS OBJECT --
// Provided to all descendant layers so they can access shared chart state
// without needing a direct ref to BaseRose. Getter-based so values are always current.
const roseControls = {
  get arcs() {
    return arcs.value;
  },
  get radius() {
    return radius.value;
  },
  get computedMax() {
    return computedMax.value;
  },
  get duration() {
    return props.duration;
  },
  get highlighted() {
    return props.highlighted;
  },
  get hoverColor() {
    return props.hoverColor;
  },
  get bgColor() {
    return props.bgColor;
  },
  get showCursorPointer() {
    return props.showCursorPointer;
  },
  get showLabels() {
    return props.showLabels;
  },
  get labelsOutside() {
    return props.labelsOutside;
  },
  get padAngle() {
    return props.padAngle;
  },
  get padRadius() {
    return props.padRadius;
  },
  get cornerRadius() {
    return props.cornerRadius;
  },
  get maxLabelWidth() {
    return props.maxLabelWidth;
  },
  // The centered <g> element that layers append their groups into.
  get svgGroup() {
    return svgGroup.value;
  },
  emitSelect: (payload) => emit("select", payload),
  emitHover: (payload) => emit("hover", payload),
};
provide("roseControls", roseControls);

// -- DRAW --

function fireDraw() {
  roseDraw.value = { timestamp: Date.now() };
}

function draw() {
  if (!svgEl.value) return;

  if (!svgGroup.value) {
    svgGroup.value = d3.select(svgEl.value).append("g");
  }

  svgGroup.value.attr(
    "transform",
    `translate(${width.value / 2} ${height.value / 2})`,
  );
  fireDraw();
}

// -- RESIZE --

function setSize() {
  const el = container.value;
  if (el) {
    width.value = el.clientWidth;
    height.value = el.clientWidth; // square
  }
}

function resize() {
  const prevWidth = width.value;
  const prevHeight = height.value;
  setSize();
  if (prevWidth !== width.value || prevHeight !== height.value) {
    draw();
  }
}

let resizeObserver = null;

// -- LIFECYCLE --

onMounted(() => {
  setSize();
  draw();
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container.value);
  } else {
    window.addEventListener("resize", resize);
  }
});

onBeforeUnmount(() => {
  if (window.ResizeObserver) {
    resizeObserver?.unobserve(container.value);
  } else {
    window.removeEventListener("resize", resize);
  }
});

// -- WATCHERS --

watch(
  () => props.data,
  () => draw(),
  { deep: true },
);

watch([() => props.startAngle, () => props.endAngle], () => draw());
</script>
