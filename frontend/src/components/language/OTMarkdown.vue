<template>
  <div class="ot-markdown" v-html="renderedHtml"></div>
</template>

<script setup>
import Markdoc from "@markdoc/markdoc";
// import { ref } from "vue";

const props = defineProps({
  value: String,
  options: {
    type: Object,
    // markdoc config object
    // make use <a> links use target="_blank"
    // default: () => ({
    //   nodes: {
    //     link: {
    //       render: "a",
    //       attributes: {
    //         href: { type: String },
    //         title: { type: String, required: false },
    //       },
    //       transform(node, config) {
    //         return {
    //           ...node.transform(config),
    //           attributes: {
    //             ...node.transform(config).attributes,
    //             target: "_blank",
    //             rel: "noopener noreferrer", // Optional, for security
    //           },
    //         };
    //       },
    //     },
    //   },
    // }),
    // default: () => ({
    //   tags: {
    //     link: {
    //       render: "a",
    //       attributes: {
    //         target: { type: String, default: "_blank" },
    //       },
    //     },
    //   },
    // }),
    default: () => ({
      nodes: {
        document: {
          render: null,
        },
      },
    }),
  },
});

function render(node) {}

const renderedHtml = computed(() => {
  const ast = Markdoc.parse(props.value);
  const content = Markdoc.transform(ast, props.options);
  const result = Markdoc.renderers.html(content);

  // add target="_blank" to all links. find <a and add target="_blank"

  const final = result.replace(
    /<a /g,
    '<a target="_blank" rel="noopener noreferrer" ',
  );
  return final;
});
</script>
