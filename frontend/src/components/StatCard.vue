<template>
  <div
    class="overflow-hidden rounded-lg bg-white px-4 py-5 shadow-sm ring-1 ring-gray-900/5 sm:p-6"
  >
    <dt class="truncate text-sm font-medium text-gray-500">
      <OTText :value="label" />
    </dt>
    <dd class="mt-1 flex items-baseline gap-2">
      <span
        class="text-2xl font-semibold tracking-tight text-gray-900 tabular-nums"
        :style="
          valueTransitionName
            ? { viewTransitionName: valueTransitionName }
            : null
        "
      >
        {{ value }}
      </span>
      <span v-if="hint" class="text-sm font-medium" :class="hintClass">{{
        hint
      }}</span>
    </dd>
  </div>
</template>

<script setup>
const props = defineProps({
  /** A label key, not literal text — see docs/LANGUAGE-SYSTEM.md. */
  label: { type: String, required: true },
  value: { type: [String, Number], default: "—" },
  hint: { type: String, default: null },
  /** "up" reads as a price rise (bad), "down" as a drop (good). */
  tone: { type: String, default: "neutral" },
  /** Lets the value take part in a view transition — see functions/viewTransitions.js. */
  valueTransitionName: { type: String, default: null },
});

const hintClass = computed(
  () =>
    ({
      up: "text-rose-600",
      down: "text-emerald-600",
      neutral: "text-gray-500",
    })[props.tone] ?? "text-gray-500",
);
</script>
