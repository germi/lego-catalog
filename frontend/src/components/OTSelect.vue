<template>
  <Popover class="relative dark:text-black" v-slot="{ open }">
    <div>
      <PopoverButton
        class="relative w-full"
        :class="{
          [mainClass]: true,
          'text-gray-400': disabled,
          'hover:border-gray-200': disabled,
        }"
        :id="label"
        :disabled="disabled"
        @keydown="handleKeydown"
      >
        <div class="flex items-center justify-between">
          <slot
            name="button-content"
            :open="open"
            :displayed-name="displayedName"
            :disabled="disabled"
          >
            <span class="truncate" :aria-live="open ? 'polite' : 'off'">
              {{ displayedName }}
            </span>
            <ChevronDownIcon
              v-if="!disabled"
              class="-mr-1 ml-2 h-5 w-5 flex-shrink-0"
              aria-hidden="true"
              :class="{ [iconClass]: true }"
            />
            <button
              v-if="
                allowClear &&
                ((multiple && modelValue.length) || (!multiple && modelValue))
              "
              @click.stop="clear"
              class="absolute inset-y-0 right-0 shrink-0 rounded-lg border-none bg-white px-2.5 text-black hover:bg-gray-100"
              type="button"
            >
              <XMarkIcon class="h-5 w-5" />
            </button>
          </slot>
        </div>
      </PopoverButton>
    </div>

    <transition
      @after-enter="noSearchAutoFocus"
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <PopoverPanel
        v-slot="{ close }"
        class="absolute z-50 my-1 rounded-md border bg-white p-2 text-base font-normal shadow-md"
        :class="{
          'is-open': open,
          [popoverClass]: true,
          'right-0': right,
          'bottom-full mb-1': top,
          'mt-1': !top,
        }"
        @keydown="(e) => handleKeydown(e, close)"
      >
        <input
          v-if="allowSearch"
          ref="inputRef"
          type="text"
          class="mb-2 block w-full flex-grow rounded border border-gray-300 bg-gray-100 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
          v-model="search"
          @keydown.esc="close"
          @keydown.up.prevent="highlightPrev"
          @keydown.down.prevent="highlightNext"
          @keydown.enter.prevent="selectHighlighted(close)"
          @keydown.tab="(e) => handleKeydown(e, close)"
          :placeholder="placeholder"
          autocomplete="off"
          autocorrect="off"
        />

        <template v-if="filteredOptions.length > 0">
          <div
            v-if="multiple && allowSelectAll"
            class="-mt-1 mb-0.5 flex items-center gap-x-2"
          >
            <button
              @click="selectAll"
              class="text-xs text-gray-600 underline hover:text-gray-700"
            >
              Select all
            </button>
            <span>-</span>
            <button
              @click="clear"
              class="text-xs text-gray-600 underline hover:text-gray-700"
            >
              Clear
            </button>
          </div>
          <ul
            class="relative mb-0 max-h-[220px] w-full list-none space-y-1 overflow-y-auto overflow-x-hidden border-none pl-0 text-sm leading-6 text-gray-700"
          >
            <TreeSelectItem
              v-if="isTree"
              v-for="option in filteredOptions"
              :key="option.id"
              :data="option"
              :value="selectedIds"
              :leaf-only="leafOnly"
              :only-show-check-if-element-is-present="
                onlyShowCheckIfElementIsPresent
              "
              :force-single="forceSingle"
              @input="(e) => treeSelect(e, close)"
              :search="search"
            />
            <li
              v-else
              v-for="(option, i) in filteredOptions"
              :key="`option-${option.id}`"
              :ref="(el) => (optionsRef[i] = el)"
              class="relative my-0 flex cursor-pointer items-center gap-x-1 rounded px-2 py-2 focus:outline-none"
              :class="{
                'is-active bg-gray-100': i === highlightedIndex,
                'font-semibold': multiple
                  ? modelValue.includes(option.id)
                  : option.id === modelValue,
                'text-gray-400': option.disabled,
              }"
              tabindex="0"
              @mouseover="!option.disabled && (highlightedIndex = i)"
              @click="select(option, !multiple && close)"
              @keydown="(e) => handleKeydown(e, close)"
            >
              <slot
                name="option-content"
                :option="option"
                :highlighted="i === highlightedIndex"
                :selected="
                  multiple
                    ? modelValue.includes(option.id)
                    : option.id === modelValue
                "
              >
                <div class="flex items-center justify-between leading-tight">
                  <div class="relative mr-6 flex items-center">
                    {{ option.name }}
                  </div>
                  <div
                    class="text-primary-500 absolute inset-y-0 right-0 flex items-center pr-3"
                  >
                    <CheckIcon
                      v-if="
                        multiple
                          ? modelValue.includes(option.id)
                          : option.id === modelValue
                      "
                      class="h-5 w-5"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </slot>
            </li>
          </ul>
          <div v-if="showCloseBtn" class="flex justify-end border-t pt-2">
            <button class="ot-btn px-3 text-sm shadow-none" @click="close">
              Close
            </button>
          </div>
        </template>

        <div v-else class="input-dropdown-empty px-4 py-2 text-gray-500">
          {{ noResultsText }} "{{ search }}"
        </div>
      </PopoverPanel>
    </transition>
  </Popover>
</template>

<script setup>
import { ChevronDownIcon, CheckIcon, XMarkIcon } from "@heroicons/vue/20/solid";
import { computed, ref, toRefs, watch } from "vue";

const props = defineProps({
  options: {
    type: Array,
    default: () => [
      { id: "1", name: "Option 1" },
      { id: "2", name: "Option 2" },
      { id: "3", name: "Option 3" },
    ],
  },
  placeholder: {
    type: String,
    default: "Search",
  },
  mainClass: {
    type: String,
    default: "bg-white py-2 px-4 rounded-lg border border-gray-300",
  },
  popoverClass: {
    type: String,
    default: "w-full",
  },
  defaultOptionName: {
    type: String,
    default: "All",
  },
  noResultsText: {
    type: String,
    default: "No results found for",
  },
  label: {
    type: String,
    default: "",
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  iconClass: {
    type: String,
    default: "",
  },
  right: {
    type: Boolean,
    default: false,
  },
  top: {
    type: Boolean,
    default: false,
  },
  showCloseBtn: {
    type: Boolean,
    default: false,
  },
  allowSearch: {
    type: Boolean,
    default: true,
  },
  optionsText: {
    type: String,
    default: "options",
  },
  leafOnly: {
    type: Boolean,
    default: false,
  },
  allowClear: {
    type: Boolean,
    default: false,
  },
  allowSelectAll: {
    type: Boolean,
    default: false,
  },
  //used for the tree select
  forceSingle: {
    type: Boolean,
    default: false,
  },
  onlyShowCheckIfElementIsPresent: {
    type: Boolean,
    default: false,
  },
});

const model = defineModel();
const {
  options,
  optionsText,
  allowSearch,
  defaultOptionName,
  leafOnly,
  forceSingle,
  onlyShowCheckIfElementIsPresent,
} = toRefs(props);

const multiple = computed(() => Array.isArray(model.value));
const search = ref("");
const inputRef = ref(null);
const optionsRef = ref([]);
const highlightedIndex = ref(0);

const slugify = (text) => {
  const accentsMap = {
    a: "á|à|ã|â|À|Á|Ã|Â",
    e: "é|è|ê|É|È|Ê",
    i: "í|ì|î|Í|Ì|Î",
    o: "ó|ò|ô|õ|Ó|Ò|Ô|Õ",
    u: "ú|ù|û|ü|Ú|Ù|Û|Ü",
    c: "ç|Ç",
    n: "ñ|Ñ",
  };
  return Object.keys(accentsMap).reduce(
    (acc, cur) => acc.replace(new RegExp(accentsMap[cur], "g"), cur),
    text.toLowerCase(),
  );
};

const isTree = computed(() => options.value.some((e) => e.children));

const selectedIds = computed({
  get() {
    if (Array.isArray(model.value)) return model.value;
    if (model.value == null) return [];
    return [model.value];
  },
  set(value) {
    const processed = (Array.isArray(value) ? value : [])
      .filter((id) => id != null)
      .map((id) => id + "");
    if (multiple.value) model.value = processed;
    else model.value = processed[0] ?? null;
  },
});

const filterText = (search, options) => {
  if (!search.trim()) return options;
  const regex = new RegExp(slugify(search), "i");
  if (!isTree.value) {
    return options.filter(
      (option) => slugify(option.name).search(regex) !== -1,
    );
  }
  const filterTree = (nodes) => {
    return nodes
      .map((node) => {
        const matches = slugify(node.name).search(regex) !== -1;
        const filteredChildren = node.children ? filterTree(node.children) : [];
        if (matches || filteredChildren.length) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      })
      .filter(Boolean);
  };
  return filterTree(options);
};

const filteredOptions = computed(() => filterText(search.value, options.value));

const displayedName = computed(() => {
  if (multiple.value && model.value.length > 1) {
    return `${model.value.length} ${optionsText.value}`;
  } else if (multiple.value && model.value.length === 1) {
    // need to recursively find the name
    const option = findOptionById(options.value, model.value[0]);
    return option ? option.name : defaultOptionName.value;
    // return options.value.find((e) => e.id === model.value[0])?.name;
  } else if (!multiple.value && model.value) {
    // need to recursively find the name
    const option = findOptionById(options.value, model.value);
    return option ? option.name : defaultOptionName.value;
  } else {
    return defaultOptionName.value;
  }
});

function findOptionById(options, id) {
  for (const option of options) {
    if (option.id === id) return option;
    if (option.children) {
      const found = findOptionById(option.children, id);
      if (found) return found;
    }
  }
  return null;
}

watch(
  () => filteredOptions.value,
  () => {
    optionsRef.value = [];
  },
);

// Auto focus:
// If allowSearch is true, focus the search input, if not focus the first option.
const noSearchAutoFocus = () => {
  if (allowSearch.value && inputRef.value) {
    inputRef.value.focus();
  } else if (optionsRef.value.length > 0) {
    optionsRef.value[0]?.focus();
  }
};

const handleKeydown = (event, closeFn) => {
  const isPopoverOpen = typeof closeFn === "function";

  if (event.key === "Tab") {
    if (isPopoverOpen) {
      event.preventDefault();
      if (allowSearch.value && inputRef.value) {
        inputRef.value.focus();
      } else {
        highlightNext();
      }
    }
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    if (allowSearch.value && inputRef.value) {
      inputRef.value.focus();
    } else {
      highlightNext();
    }
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightPrev();
  } else if (event.key === "Enter") {
    if (isPopoverOpen) {
      event.preventDefault();
      // For multiple selection, don't close immediately so more options can be selected
      if (multiple.value) {
        selectHighlighted();
      } else {
        selectHighlighted(closeFn);
      }
    }
  } else if (event.key === "Escape") {
    closeFn?.();
  } else if (event.key === " " && event.target.tagName === "BUTTON") {
    event.preventDefault();
    event.target.click();
  }
};

const select = (option, close) => {
  if (multiple.value) {
    const currentValue = [...model.value];
    if (currentValue.includes(option.id)) {
      currentValue.splice(currentValue.indexOf(option.id), 1);
    } else {
      currentValue.push(option.id);
    }
    model.value = currentValue;
  } else {
    if (model.value === option.id) {
      model.value = null;
    } else {
      model.value = option.id;
    }
    close?.();
  }
};

const selectAll = () => {
  model.value = filteredOptions.value.map((option) => option.id);
};

const clear = () => {
  model.value = multiple.value ? [] : null;
};

const highlight = (index) => {
  highlightedIndex.value =
    index < 0
      ? filteredOptions.value.length - 1
      : index % filteredOptions.value.length;
  scrollToHighlighted();
};

const scrollToHighlighted = () => {
  const option = optionsRef.value[highlightedIndex.value];
  if (option) {
    option.scrollIntoView({ block: "nearest" });
  }
};

const highlightPrev = () => {
  const prevIndex = findEnabledIndex(-1);
  highlight(prevIndex);
};

const highlightNext = () => {
  const nextIndex = findEnabledIndex(1);
  highlight(nextIndex);
};

const findEnabledIndex = (step) => {
  let i = highlightedIndex.value + step;
  const length = filteredOptions.value.length;
  while (i >= 0 && i < length) {
    if (!filteredOptions.value[i]?.disabled) return i;
    i += step;
  }
  return step > 0 ? 0 : length - 1;
};

const selectHighlighted = (close) => {
  select(filteredOptions.value[highlightedIndex.value], close);
};

const treeSelect = ({ data }, close) => {
  const clickedId = (data?.id ?? "") + "";
  if (!clickedId) return;

  const currentSelectedIds = selectedIds.value;
  const isAlreadySelected = currentSelectedIds.includes(clickedId);

  if (forceSingle.value) {
    // In forceSingle mode, only allow one selection at a time
    selectedIds.value = isAlreadySelected ? [] : [clickedId];
    if (leafOnly.value) close();
    return;
  }

  if (onlyShowCheckIfElementIsPresent.value) {
    // In this mode, only toggle the clicked node
    selectedIds.value = isAlreadySelected
      ? currentSelectedIds.filter((id) => id !== clickedId)
      : [...currentSelectedIds, clickedId];

    if (leafOnly.value) close();
    return;
  }

  // Default mode
  const idsToToggle = getNodeAndChildrenIds(data).map((id) => id + "");
  selectedIds.value = isAlreadySelected
    ? currentSelectedIds.filter((id) => !idsToToggle.includes(id))
    : [...new Set([...currentSelectedIds, ...idsToToggle])];

  if (leafOnly.value) close();
};

const getNodeAndChildrenIds = (node) => {
  const ids = [node.id];
  if (node.children?.length) {
    for (const child of node.children) {
      ids.push(...getNodeAndChildrenIds(child));
    }
  }
  return ids;
};
</script>
