import Home from "./pages/index.vue";
import Part from "./pages/part.vue";
import Sets from "./pages/sets.vue";
// `Set` is taken by the global built-in, so the component gets a clearer alias here.
import SetPage from "./pages/set.vue";
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

  {
    path: "/sets",
    name: "sets",
    component: Sets,
    meta: { title: "Sets" },
  },

  // Sets are addressed by their catalogue number too, variant suffix included.
  {
    path: "/set/:number",
    name: "set",
    component: SetPage,
    meta: { title: "Set" },
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
