<template>
  <OTModal :is-open="isOpen" @close="cancel">
    <template #header>
      <div>
        Edit label:
        <span class="rounded bg-gray-100 p-1 px-2 font-mono text-sm">{{
          labelKey
        }}</span>
      </div>
    </template>
    <template #body>
      <div class="mb-4 flex items-center justify-between border-b border-gray-200">
        <div class="flex gap-1">
          <button
            v-for="loc in availableLocales"
            :key="loc"
            class="-mb-px px-4 py-2 text-sm font-medium uppercase"
            :class="
              activeTab === loc
                ? 'border-primary-700 text-primary-700 border-b-2'
                : 'text-gray-400 hover:text-gray-600'
            "
            @click="activeTab = loc"
          >
            {{ loc }}
          </button>
        </div>
        <OTToggle
          v-if="showEditorToggle"
          v-model="editorEnabled"
          small
          label-position="start"
          class="-mb-px"
        >
          <span class="text-xs text-gray-500">Markdown</span>
        </OTToggle>
      </div>

      <template v-for="loc in availableLocales" :key="loc">
        <div v-show="activeTab === loc">
          <MarkdownEditor
            v-if="showEditor"
            v-model="inputs[loc]"
          />
          <textarea
            v-else
            class="h-48 w-full rounded border border-gray-300 p-4 text-sm"
            v-model="inputs[loc]"
          ></textarea>
        </div>
      </template>

      <div class="mt-4 flex items-center justify-between gap-2">
        <button
          class="ot-btn border-gray-100 bg-gray-100 hover:border-gray-200 hover:bg-gray-200 hover:text-gray-700"
          @click="cancel"
        >
          Cancel
        </button>
        <button
          class="ot-btn bg-primary-700 hover:border-primary-800 hover:bg-primary-800 relative text-white"
          @click="save"
        >
          <span :class="{ 'opacity-0': saving }">Save</span>
          <LoadingSpinner
            :loading="saving"
            class="inset-0"
            border-class="h-6 w-6 border-2 border-white"
            bg-color-class="bg-none"
          />
        </button>
      </div>
    </template>
  </OTModal>
</template>

<script setup>
import { useI18n } from "vue-i18n";
import { getNestedValue, saveLabel } from "@/utils/language";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  labelKey: {
    type: String,
    required: true,
  },
  defaultLocale: {
    type: String,
    default: null,
  },
  useEditor: {
    type: Boolean,
    default: false,
  },
  showEditorToggle: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:isOpen"]);

const i18n = useI18n();
const locale = computed(() => i18n.locale.value);
const availableLocales = computed(() => i18n.availableLocales);

const activeTab = ref(locale.value);
const inputs = ref({});
const saving = ref(false);
const editorEnabled = ref(false);

const showEditor = computed(() => editorEnabled.value);

// Populate inputs from all locales when modal opens
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      activeTab.value = props.defaultLocale || locale.value;
      const values = {};
      for (const loc of availableLocales.value) {
        values[loc] =
          getNestedValue(i18n.messages.value[loc], props.labelKey) || "";
      }
      inputs.value = values;
      // Default toggle state: on if useEditor, off otherwise
      editorEnabled.value = props.useEditor;
    }
  },
);

async function save() {
  saving.value = true;
  try {
    await saveLabel(
      i18n.messages.value,
      availableLocales.value,
      props.labelKey,
      inputs.value,
    );
    emit("update:isOpen", false);
  } finally {
    saving.value = false;
  }
}

function cancel() {
  emit("update:isOpen", false);
}
</script>
