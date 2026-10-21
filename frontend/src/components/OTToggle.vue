<template>
  <SwitchGroup>
    <div
      class="group flex items-center"
      :class="[small ? 'gap-x-1' : 'gap-x-2']"
    >
      <SwitchLabel
        v-if="labelPosition === 'start'"
        class="cursor-pointer"
        :class="[labelClass]"
      >
        <slot></slot>
      </SwitchLabel>

      <Switch
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', $event)"
        :class="[
          modelValue ? enabledClass : disabledClass,
          switchClass,
          small ? smallClass : largeClass,
        ]"
        class="relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out"
      >
        <span class="sr-only">Use setting</span>
        <span
          aria-hidden="true"
          :class="[
            modelValue && small ? 'translate-x-[12px]' : 'translate-x-0',
            modelValue && !small ? 'translate-x-[15px]' : 'translate-x-0',
            small ? 'h-[15px] w-[15px]' : 'h-[21px] w-[21px]',
          ]"
          class="pointer-events-none inline-block transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
        />
      </Switch>

      <SwitchLabel
        v-if="labelPosition === 'end'"
        class="cursor-pointer"
        :class="[labelClass]"
      >
        <slot></slot>
      </SwitchLabel>
    </div>
  </SwitchGroup>
</template>

<script setup>
import { Switch, SwitchGroup, SwitchLabel } from "@headlessui/vue";

defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  enabledClass: {
    type: String,
    default: "bg-gray-500",
  },
  disabledClass: {
    type: String,
    default: "bg-gray-300",
  },
  small: {
    type: Boolean,
    default: false,
  },
  smallClass: {
    type: String,
    default: "h-[19px] w-[31px]",
  },
  largeClass: {
    type: String,
    default: "h-[25px] w-[40px]",
  },
  labelClass: {
    type: String,
    default: "text-gray-900 text-xs",
  },
  labelPosition: {
    type: String,
    default: "start",
  },
  switchClass: {
    type: String,
    default:
      "ot-ring focus:outline-none group-hover:ring-2 group-hover:ring-blue-400 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-0",
  },
});
</script>
