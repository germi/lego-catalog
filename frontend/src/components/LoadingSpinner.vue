<template>
  <div
    v-if="loading"
    class="absolute flex items-center justify-center"
    :class="{ [bgColorClass]: true }"
  >
    <div
      class="inline-block animate-spin rounded-full border-r-transparent"
      :class="{ [borderClass]: true }"
      role="status"
    >
      <span class="sr-only">Loading...</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    borderClass: {
      type: String,
      default: "h-8 w-8 border-gray-700 border-4",
    },
    loading: {
      type: Boolean,
      default: false,
    },
    error: {
      type: [Boolean, Object],
      default: false,
    },
    data: {
      type: Boolean,
      default: false,
    },
    bgColorClass: {
      type: String,
      default: "bg-gray-100 opacity-50",
    },
  },
  data() {
    return {
      firstLoad: true,
    };
  },
  watch: {
    data() {
      this.firstLoad = false;
    },
  },
  computed: {
    errorProcessed() {
      return typeof this.error === "object" ? true : this.error;
    },
  },
};
</script>
