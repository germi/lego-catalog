import { nextTick, ref } from "vue";

/**
 * Shared-element transitions between the dashboard and the product modal.
 *
 * Uses the View Transition API in its same-document form: a Vue Router navigation never
 * leaves the document, so `document.startViewTransition()` is the right tool (the
 * cross-document `@view-transition` rule is for real page loads). The browser snapshots
 * the page, lets us change it, snapshots again, and morphs every element whose
 * `view-transition-name` appears in both states. The product image and title carry the
 * same names on the card and in the modal, so they fly from one to the other.
 *
 * The rule everything here exists to respect: **a name must be unique in each
 * snapshot**, or the browser skips the whole transition. The dashboard stays rendered
 * underneath the modal, so if every card were named, the "after" state of an open would
 * hold two `product-image`s — the card and the modal. So only one card is ever named,
 * the one being opened or closed (`transitioningProductId`), and only while the modal
 * is not showing it. On open that card is the source; on close it is the destination.
 *
 * Browsers without the API, and anyone who prefers reduced motion, simply navigate.
 */
export const transitioningProductId = ref(null);

export const VT_IMAGE = "product-image";
export const VT_TITLE = "product-title";
export const VT_PRICE = "product-price";
export const VT_ASIN = "product-asin";
export const VT_CHART = "product-chart";

const isProduct = (route) => route.name === "product";

function shouldAnimate(to, from) {
  if (typeof document === "undefined" || !document.startViewTransition)
    return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
    return false;
  // The very first navigation has no previous state to morph from.
  if (!from.matched.length) return false;

  // Only opening or closing the modal. Filter changes on either side stay instant —
  // animating them would freeze and crossfade the whole dashboard on every chip click.
  return isProduct(to) !== isProduct(from);
}

export function installViewTransitions(router) {
  // Resolves the update callback once the new route has rendered.
  let finishUpdate = null;

  router.beforeResolve(async (to, from) => {
    if (!shouldAnimate(to, from)) return;

    // Name the card *before* the old snapshot is taken.
    transitioningProductId.value = String(
      isProduct(to) ? to.params.id : from.params.id,
    );
    await nextTick();

    // Hold the navigation until the browser has captured the old state; the update
    // callback is where it lets us change the DOM, so that is where we let it commit.
    await new Promise((resolve) => {
      const transition = document.startViewTransition(
        () =>
          new Promise((done) => {
            finishUpdate = done;
            resolve();
          }),
      );

      const clear = () => {
        transitioningProductId.value = null;
      };
      transition.finished.then(clear, clear);

      // A skipped transition is silent by default. Say why while developing — almost
      // always a duplicated view-transition-name.
      transition.ready.catch((reason) => {
        if (import.meta.env.DEV)
          console.warn("[view-transition] skipped:", reason?.message ?? reason);
      });
    });
  });

  // Runs for failed and cancelled navigations too, so the browser is never left waiting.
  router.afterEach(async () => {
    if (!finishUpdate) return;

    const done = finishUpdate;
    finishUpdate = null;

    // The new route renders on the next tick, and the dialog teleports into its portal
    // one tick after that. Releasing earlier would snapshot a page with no modal in it.
    await nextTick();
    await nextTick();
    done();
  });
}
