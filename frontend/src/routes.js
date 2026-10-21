import Home from "./pages/index.vue";
import Part from "./pages/part.vue";
import Language from "./pages/language.vue";
import NotFound from "./pages/[...404].vue";

/** @type {import('vue-router').RouterOptions['routes']} */
export const routes = [
  {
    path: "/",
    name: "home",
    component: Home,
    meta: { title: "Parts" },
  },

  // Parts are addressed by their catalogue number, not by database id: the number is
  // what you have in hand when you go looking for one.
  {
    path: "/part/:number",
    name: "part",
    component: Part,
    meta: { title: "Part" },
  },

  // Built-in label browser/editor. In dev, edits are written straight back to
  // src/locales/*.json by vite-plugins/locale-writer.js.
  {
    path: "/language",
    name: "language",
    component: Language,
    meta: { title: "Language Editor" },
  },

  { path: "/:path(.*)", component: NotFound },
];
