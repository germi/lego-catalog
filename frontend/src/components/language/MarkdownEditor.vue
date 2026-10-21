<template>
  <div class="markdown-editor rounded border border-gray-300">
    <!-- Toolbar -->
    <div class="flex gap-0.5 border-b border-gray-200 px-2 py-1.5">
      <button
        type="button"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        :class="{ 'bg-gray-200 text-gray-900': editor?.isActive('bold') }"
        @click="editor?.chain().focus().toggleBold().run()"
        title="Bold"
      >
        <span class="text-sm font-bold">B</span>
      </button>
      <button
        type="button"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        :class="{ 'bg-gray-200 text-gray-900': editor?.isActive('italic') }"
        @click="editor?.chain().focus().toggleItalic().run()"
        title="Italic"
      >
        <span class="text-sm italic">I</span>
      </button>

      <div class="mx-1 w-px bg-gray-200"></div>

      <button
        type="button"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        :class="{ 'bg-gray-200 text-gray-900': editor?.isActive('bulletList') }"
        @click="editor?.chain().focus().toggleBulletList().run()"
        title="Bullet list"
      >
        <ListBulletIcon class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        :class="{ 'bg-gray-200 text-gray-900': editor?.isActive('orderedList') }"
        @click="editor?.chain().focus().toggleOrderedList().run()"
        title="Ordered list"
      >
        <NumberedListIcon class="h-4 w-4" />
      </button>

      <div class="mx-1 w-px bg-gray-200"></div>

      <button
        type="button"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        :class="{ 'bg-gray-200 text-gray-900': editor?.isActive('link') }"
        @click="toggleLink"
        title="Link"
      >
        <LinkIcon class="h-4 w-4" />
      </button>
      <button
        type="button"
        class="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
        @click="insertImage"
        title="Image"
      >
        <PhotoIcon class="h-4 w-4" />
      </button>
    </div>

    <!-- Editor -->
    <EditorContent :editor="editor" class="prose prose-sm max-w-none p-4" />
  </div>
</template>

<script setup>
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Markdoc from "@markdoc/markdoc";
import TurndownService from "turndown";
import {
  ListBulletIcon,
  NumberedListIcon,
  LinkIcon,
  PhotoIcon,
} from "@heroicons/vue/24/outline";

const props = defineProps({
  modelValue: {
    type: String,
    default: "",
  },
});

const emit = defineEmits(["update:modelValue"]);

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

// Convert markdown to HTML for tiptap
function markdownToHtml(md) {
  if (!md) return "";
  const ast = Markdoc.parse(md);
  const content = Markdoc.transform(ast);
  return Markdoc.renderers.html(content);
}

// Convert HTML back to markdown for storage
function htmlToMarkdown(html) {
  if (!html) return "";
  return turndown.turndown(html);
}

const editor = useEditor({
  content: markdownToHtml(props.modelValue),
  extensions: [
    StarterKit,
    Link.configure({
      openOnClick: false,
      HTMLAttributes: {
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    Image.configure({
      inline: true,
    }),
  ],
  onUpdate: ({ editor }) => {
    emit("update:modelValue", htmlToMarkdown(editor.getHTML()));
  },
});

// Sync external changes into the editor
watch(
  () => props.modelValue,
  (val) => {
    if (!editor.value) return;
    const currentMarkdown = htmlToMarkdown(editor.value.getHTML());
    if (val !== currentMarkdown) {
      editor.value.commands.setContent(markdownToHtml(val));
    }
  },
);

function toggleLink() {
  if (!editor.value) return;

  if (editor.value.isActive("link")) {
    editor.value.chain().focus().unsetLink().run();
    return;
  }

  const url = window.prompt("URL:");
  if (url) {
    editor.value.chain().focus().setLink({ href: url }).run();
  }
}

function insertImage() {
  if (!editor.value) return;
  const url = window.prompt("Image URL:");
  if (url) {
    editor.value.chain().focus().setImage({ src: url }).run();
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style>
.markdown-editor .ProseMirror {
  outline: none;
  min-height: 10rem;
}
</style>
