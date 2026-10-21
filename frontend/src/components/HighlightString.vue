<template>
  <span
    v-for="(piece, i) in pieces"
    :key="i"
    :class="{ 'font-bold': piece.highlighted }"
    >{{ piece.text }}</span
  >
</template>

<script setup>
import { toRefs, computed } from "vue";

const props = defineProps({
  phrase: {
    type: String,
    default: "",
  },
  highlight: {
    type: String,
    default: "",
  },
});

const { phrase, highlight } = toRefs(props);

const pieces = computed(() => {
  return [
    {
      text: phrase.value,
      highlighted:
        highlight.value && phrase.value.match(new RegExp(highlight.value, "i")),
    },
  ];
  // fuck me this was complicated!
  // const regex = new RegExp(highlight.value, "gi");

  // const result = [];

  // const indexes = [];

  // while (true) {
  //   let array1 = regex.exec(phrase.value);
  //   if (!array1) break;
  //   const { index } = array1;
  //   indexes.push({ index, next: regex.lastIndex });
  // }

  // // add the first one
  // const first = indexes[0];
  // const last = indexes[indexes.length - 1];

  // if (first.index > 0) {
  //   result.push({
  //     text: phrase.value.slice(0, first.index),
  //     highlighted: false,
  //   });
  // }

  // for (let i = 0; i < indexes.length; i++) {
  //   const piece = indexes[i];
  //   const next = indexes[i + 1];
  //   result.push({
  //     text: phrase.value.slice(piece.index, piece.next),
  //     highlighted: true,
  //   });
  //   if (next)
  //     result.push({
  //       text: phrase.value.slice(piece.next, next.index),
  //       highlighted: false,
  //     });
  //   else if (last.next < phrase.value.length) {
  //     result.push({ text: phrase.value.slice(last.next), highlighted: false });
  //   }
  // }

  // return result;
});
</script>
