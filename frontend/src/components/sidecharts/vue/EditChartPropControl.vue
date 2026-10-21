<template>
  <div class="sc-prop-row">
    <label class="sc-prop-label">
      <span class="sc-prop-name">{{ propKey }}</span>
      <button
        v-if="isOverridden"
        class="sc-prop-reset"
        title="Reset to default"
        @click="$emit('reset')"
      >↺</button>
    </label>

    <div class="sc-prop-control">
      <!-- number → slider + numeric display -->
      <template v-if="control === 'number'">
        <input
          type="range"
          :min="numRange.min"
          :max="numRange.max"
          :step="numRange.step"
          :value="numericValue"
          @input="$emit('set', toNumber($event.target.value))"
        />
        <span class="sc-prop-value">
          {{ formatNumber(numericValue) }}<span v-if="hint?.unit" class="sc-prop-unit">{{ hint.unit }}</span>
        </span>
      </template>

      <!-- boolean → checkbox -->
      <template v-else-if="control === 'boolean'">
        <input
          type="checkbox"
          :checked="!!value"
          @change="$emit('set', $event.target.checked)"
        />
      </template>

      <!-- enum → select -->
      <template v-else-if="control === 'enum'">
        <select :value="value ?? ''" @change="$emit('set', $event.target.value)">
          <option v-for="opt in hint.options" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </template>

      <!-- color → color picker + hex text -->
      <template v-else-if="control === 'color'">
        <input
          type="color"
          :value="colorValue"
          @input="$emit('set', $event.target.value)"
        />
        <input
          type="text"
          class="sc-prop-text"
          :value="value ?? ''"
          placeholder="—"
          @change="$emit('set', $event.target.value || null)"
        />
      </template>

      <!-- color-map → one color picker per key -->
      <template v-else-if="control === 'color-map'">
        <div class="sc-color-map">
          <label v-for="(_, k) in (value ?? {})" :key="k" class="sc-color-map-row">
            <span>{{ k }}</span>
            <input
              type="color"
              :value="colorOrFallback(value[k])"
              @input="setColorMapKey(k, $event.target.value)"
            />
          </label>
        </div>
      </template>

      <!-- string → text input -->
      <template v-else-if="control === 'string'">
        <input
          type="text"
          class="sc-prop-text"
          :value="value ?? ''"
          @change="$emit('set', $event.target.value)"
        />
      </template>

      <!-- fallback: unsupported (functions, arrays, complex objects) -->
      <template v-else>
        <span class="sc-prop-unsupported">{{ unsupportedLabel }}</span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  propKey:      { type: String, required: true },
  value:        { default: undefined },
  defaultValue: { default: undefined },
  hint:         { type: Object, default: null },
  isOverridden: { type: Boolean, default: false },
});

const emit = defineEmits(["set", "reset"]);

// Decide which control widget to render.
const control = computed(() => {
  const h = props.hint;
  if (h?.type === "color")     return "color";
  if (h?.type === "color-map") return "color-map";
  if (Array.isArray(h?.options)) return "enum";

  const d = props.defaultValue;
  const v = props.value;
  const sample = d ?? v;

  if (typeof sample === "number") return "number";
  if (typeof sample === "boolean") return "boolean";
  if (typeof sample === "string") {
    if (sample.startsWith("#") && sample.length <= 9) return "color";
    return "string";
  }
  // null/undefined: infer from the hint's min/max if present
  if (h && (h.min !== undefined || h.max !== undefined)) return "number";
  // null default → leave editable as string (e.g., bgColor=null with type:color is handled above)
  return "fallback";
});

const numRange = computed(() => ({
  min:  props.hint?.min ?? 0,
  max:  props.hint?.max ?? 100,
  step: props.hint?.step ?? 1,
}));

const numericValue = computed(() => {
  if (typeof props.value === "number") return props.value;
  if (typeof props.defaultValue === "number") return props.defaultValue;
  return numRange.value.min;
});

function toNumber(s) {
  const step = numRange.value.step;
  const n = Number(s);
  // Snap to step precision so we don't show "0.30000000000004"
  const decimals = (String(step).split(".")[1] || "").length;
  return Number(n.toFixed(decimals));
}

function formatNumber(n) {
  const step = numRange.value.step;
  const decimals = (String(step).split(".")[1] || "").length;
  return decimals ? n.toFixed(decimals) : String(n);
}

const colorValue = computed(() => {
  const v = props.value;
  if (typeof v === "string" && v.startsWith("#")) return v;
  return "#000000";
});

function colorOrFallback(v) {
  return typeof v === "string" && v.startsWith("#") ? v : "#000000";
}

function setColorMapKey(k, newColor) {
  emit("set", { ...(props.value ?? {}), [k]: newColor });
}

const unsupportedLabel = computed(() => {
  const v = props.value ?? props.defaultValue;
  if (typeof v === "function") return "function";
  if (Array.isArray(v)) return `array (${v.length})`;
  if (v && typeof v === "object") return "object";
  return v === null ? "null" : "—";
});
</script>

<style scoped>
.sc-prop-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}
.sc-prop-label {
  flex: 0 0 130px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.sc-prop-name {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  color: #374151;
}
.sc-prop-reset {
  border: none;
  background: none;
  color: #d97706;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
  padding: 0 2px;
}
.sc-prop-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sc-prop-control input[type="range"] {
  flex: 1;
}
.sc-prop-value {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  min-width: 48px;
  text-align: right;
  color: #111827;
}
.sc-prop-unit {
  color: #9ca3af;
  margin-left: 2px;
}
.sc-prop-text {
  flex: 1;
  padding: 3px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, monospace;
}
.sc-prop-control select {
  flex: 1;
  padding: 3px 6px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
}
.sc-prop-control input[type="color"] {
  width: 32px;
  height: 24px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
}
.sc-prop-unsupported {
  font-style: italic;
  color: #9ca3af;
  font-size: 11px;
}
.sc-color-map {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
.sc-color-map-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  color: #374151;
}
</style>
