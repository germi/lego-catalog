<template>
  <div class="relative overflow-hidden">
    <ArrowRightIcon
      class="ot-animate-bounce-right absolute right-2 top-[40.5px] z-10 h-4 w-4 rotate-90 transform transition-opacity duration-500"
      :class="{
        'opacity-0': arrivedState.right || !canScroll,
        'opacity-100': !arrivedState.right && canScroll,
      }"
    />
    <ArrowLeftIcon
      class="ot-animate-bounce-left absolute left-2 top-[40.5px] z-10 h-4 w-4 rotate-90 transform transition-opacity duration-500"
      :class="{
        'opacity-0': arrivedState.left || !canScroll,
        'opacity-100': !arrivedState.left && canScroll,
      }"
    />
    <div
      class="ot-table-scroll relative overflow-scroll"
      :class="{
        'ot-table-scroll-right':
          !arrivedState.right && arrivedState.left && canScroll,
        'ot-table-scroll-left':
          !arrivedState.left && arrivedState.right && canScroll,
        'ot-table-scroll-x':
          !arrivedState.left && !arrivedState.right && canScroll,
      }"
      ref="el"
    >
      <!-- shadow ring-1 ring-black ring-opacity-5 md:rounded-lg -->
      <table class="min-w-full divide-y divide-gray-300">
        <thead class="bg-gray-50">
          <tr>
            <th
              v-for="(col, i) in columns"
              :key="col.id || col"
              scope="col"
              class="whitespace-nowrap bg-gray-50 text-sm font-semibold"
              :class="{
                'py-3.5 pl-4 pr-3 text-left sm:pl-6': i === 0,
                'px-3 py-3.5 text-left': i !== 0 && i !== columns.length - 1,
                'py-3.5 pl-3 pr-4 text-left sm:pr-6': i === columns.length - 1,
                'sticky left-0 ': (col.id || col) === fixedColumn,
              }"
            >
              <RouterLink
                :to="{
                  ...route,
                  query: {
                    ...route.query,
                    [sortName]: col.id || col,
                    [dirName]:
                      sort === (col.id || col)
                        ? dir === 'ASC'
                          ? 'DESC'
                          : 'ASC'
                        : dir,
                  },
                }"
                class="group inline-flex"
              >
                <!-- dynamic-named scoped slot  -->
                <slot :name="`header-${col.id || col}`" v-bind="col">
                  {{ col.name || col.id || col }}
                </slot>

                <span
                  v-if="sort === (col.id || col)"
                  class="ml-2 flex-none rounded bg-gray-200 text-gray-900 group-hover:bg-gray-300"
                >
                  <ChevronDownIcon
                    class="duration-250 h-5 w-5 transition"
                    aria-hidden="true"
                    :class="{ 'scale-y-[-1]': dir === 'DESC' }"
                  />
                </span>
                <span
                  v-else
                  class="invisible ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible"
                >
                  <ChevronDownIcon
                    class="invisible h-5 w-5 flex-none rounded text-gray-400 group-hover:visible group-focus:visible"
                    aria-hidden="true"
                    :class="{ 'scale-y-[-1]': dir === 'DESC' }"
                  />
                </span>
              </RouterLink>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200">
          <!-- bg-white -->
          <!-- <transition-group
          name="flip-list-instant"
          tag="tbody"
          class="divide-y divide-gray-200"
          appear
        > -->
          <tr
            v-for="row in sorted"
            :key="row.id"
            @click="$emit('select', row)"
            :class="rowClass"
          >
            <td
              v-for="(col, i) in columns"
              :key="col.id || col"
              class="whitespace-nowrap bg-white text-sm"
              :class="{
                'py-4 pl-4 pr-3 font-medium sm:pl-6': i === 0,
                'px-3 py-4 text-left text-gray-500':
                  i !== 0 && i !== columns.length - 1,
                'py-4 pl-3 pr-4 text-left text-gray-500 sm:pr-6':
                  i === columns.length - 1,
                'sticky left-0': (col.id || col) === fixedColumn,
              }"
            >
              <!-- dynamic-named scoped slot  -->
              <slot :name="col.id || col" v-bind="row">
                {{ row[columns[i].id || columns[i]] }}
              </slot>
            </td>
          </tr>
          <!-- </transition-group> -->
        </tbody>
      </table>
    </div>

    <OTPagination
      v-if="rows.length > itemsPerPage"
      :items-per-page="itemsPerPage"
      :total-items="rows.length"
      :current-page="page"
      @changePage="changePage"
      class="mx-4 py-6 sm:mx-6"
    />
  </div>
</template>

<script setup>
import { ChevronDownIcon } from "@heroicons/vue/20/solid";
import { useScroll } from "@vueuse/core";
import { ArrowRightIcon, ArrowLeftIcon } from "@heroicons/vue/24/outline";
import OTPagination from "@/components/OTPagination.vue";
import { useRoute } from "vue-router";

const route = useRoute();

const props = defineProps({
  columns: {
    type: Array,
    default: () => [],
    // { id: String, name: String, sort?: Array }
    // sort: ["usi", { name: IDS.FEEDBACKS, dir: "DESC" }],
    // it can be a String or an Object with name and dir
  },
  rows: {
    type: Array,
    default: () => [],
  },
  fixedColumn: {
    type: String,
    default: null,
  },
  defaultSort: {
    type: String,
    default: "id",
  },
  defaultSortDir: {
    type: String,
    default: "ASC",
  },
  prefix: {
    type: String,
    default: "",
  },
  itemsPerPage: {
    type: Number,
    default: 10,
  },
  rowClass: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["select"]);

const { rows, columns, defaultSort, prefix, itemsPerPage, defaultSortDir } =
  toRefs(props);

const sortName = computed(
  () => `${prefix.value ? prefix.value + "-" : ""}sort`
);
const dirName = computed(() => `${prefix.value ? prefix.value + "-" : ""}dir`);

const sort = computed(() => route.query[sortName.value] || defaultSort.value);
const dir = computed(() => route.query[dirName.value] || defaultSortDir.value);

const page = ref(1);
const changePage = (p) => {
  page.value = p;
};

const sorted = computed(() => {
  // is there a custom sort order for this column?
  const sorting = columns.value.find((e) => e.id === sort.value)?.sort;

  return rows.value
    .sort((a, b) => {
      if (sorting) {
        if (Array.isArray(sorting)) {
          // sorting is an array of column priorities
          for (const key of sorting) {
            //if the key is an object, it has a name and a direction
            if (typeof key === "object") {
              const { name, dir: direction } = key;
              if (a[name] > b[name]) return direction === "ASC" ? 1 : -1;
              if (a[name] < b[name]) return direction === "ASC" ? -1 : 1;
            } else {
              // otherwise the key is just the name of the column and we use the generic direction
              if (a[key] < b[key]) return dir.value === "ASC" ? -1 : 1;
              if (a[key] > b[key]) return dir.value === "ASC" ? 1 : -1;
            }
          }
        }
        // the sorting is a function
        else {
          return sorting(a, b);
        }
      }
      // no custom sort order, sort by the column
      if (a[sort.value] < b[sort.value]) return dir.value === "ASC" ? -1 : 1;
      if (a[sort.value] > b[sort.value]) return dir.value === "ASC" ? 1 : -1;
      return 0;
    })
    .slice(
      itemsPerPage.value * (page.value - 1),
      itemsPerPage.value * page.value
    );
});

// horizontal scroll fading styles
const el = ref(null);
const { x, y, isScrolling, arrivedState, directions } = useScroll(el);

// there is a bug in the useScroll that says we didn't reach the end when we actually did (there is no scrollable content)
// so I have to bypass that by checking if the scrollable content is smaller than the container
// using the muration observer
const canScroll = ref(null);

const computeCanScroll = () => {
  // console.log("computeCanScroll");
  if (!el.value) return false;
  canScroll.value = el.value.scrollWidth > el.value.clientWidth;
};

let mutationObserver = null;
onMounted(() => {
  if (window.MutationObserver) {
    mutationObserver = new MutationObserver(() => {
      computeCanScroll();
    });
    mutationObserver.observe(el.value, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  }
});
</script>

<style scoped>
.ot-table-scroll {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}
.ot-table-scroll::-webkit-scrollbar {
  display: none;
}
.ot-table-scroll-right {
  /* @apply pr-0 ; */
  mask-image: linear-gradient(
    to right,
    black calc(100% - 48px),
    transparent 100%
  );
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.ot-table-scroll-left {
  /* @apply pr-0 ; */
  mask-image: linear-gradient(
    to left,
    black calc(100% - 48px),
    transparent 100%
  );
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.ot-table-scroll-x {
  /* @apply pr-0 ; */
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 48px,
    black calc(100% - 48px),
    transparent 100%
  );
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

@keyframes ot-bounce-right {
  0%,
  100% {
    transform: translateX(-25%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateX(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}

@keyframes ot-bounce-left {
  0%,
  100% {
    transform: translateX(25%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateX(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
}
.ot-animate-bounce-right {
  animation: ot-bounce-right 1s infinite;
}
.ot-animate-bounce-left {
  animation: ot-bounce-left 1s infinite;
}
</style>
