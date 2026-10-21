import { createApp } from "vue";
import "./tailwind.css";
import App from "./App.vue";
import { createRouter, createWebHashHistory } from "vue-router/auto";
import { createHead } from "@unhead/vue/client";
import { routes } from "./routes.js";
import i18n from "./i18n";
import { installViewTransitions } from "./functions/viewTransitions";

const app = createApp(App);
const head = createHead();

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    // Opening or closing the product modal must not scroll the dashboard behind it —
    // the card has to still be where it was for the image to fly back into it.
    if (to.matched[0] && to.matched[0] === from.matched[0]) return false;

    if (to.name !== from.name) {
      return { top: 0 };
    }
  },
});

installViewTransitions(router);

// Handle language changes and RTL
router.beforeEach((to) => {
  const lang = to.params.lang || "ca";
  document.documentElement.lang = lang;

  // Set locale in i18n
  i18n.global.locale.value = lang;
});

app.use(router);
app.use(head);
app.use(i18n);
app.mount("#ot-app");
// app.mount("body");
