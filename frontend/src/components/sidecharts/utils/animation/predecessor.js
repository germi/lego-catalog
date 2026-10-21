/**
 * Shared predecessor-resolution utilities for stacked chart animations.
 *
 * These functions are pure JavaScript — no D3, no Vue, no DOM.
 * They implement the Case A / Case B dispatch described in
 * docs/animation-abstraction-plan.md §3.
 *
 * Usage:
 *   import { buildCategoryOrders, findPredKey } from '@/components/sidecharts/animation/predecessor';
 *
 * Both SegmentLayer and RibbonChart use findPredKey.
 * buildCategoryOrders is for data-driven charts (RibbonChart, future shapes).
 * SegmentLayer builds its own equivalent from arc objects via buildArcOrders().
 */

/**
 * Builds a CategoryOrders map from an array of raw data items.
 *
 * Each item must have { id, values: { [seriesKey]: { order?: number } } }.
 * Returns Map<String(item.id), Array<{ key: string, order: number|null }>>,
 * where the array is sorted by order (nulls keep their input position).
 *
 * @param {Array} items - raw data items
 * @returns {Map}
 */
export function buildCategoryOrders(items) {
  const map = new Map();
  for (const item of items ?? []) {
    const values = item.values ?? {};
    const entries = Object.entries(values).map(([key, v]) => ({
      key,
      order: typeof v.order === "number" ? v.order : null,
    }));
    // Stable sort: numeric orders ascending, nulls preserve input position.
    entries.sort((a, b) => {
      if (a.order === null && b.order === null) return 0;
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      return a.order - b.order;
    });
    map.set(String(item.id), entries);
  }
  return map;
}

/**
 * Finds the predecessor series key for an entering or leaving element.
 *
 * Case A — element has a numeric `order`:
 *   Search the *opposite* frame's category entries for the element with the
 *   highest order strictly below ours. This includes elements that are entering
 *   or exiting (not just survivors), giving correct fold/unfold origins.
 *
 * Case B — element has no `order`:
 *   Walk the *own* frame's stacking order and return the last element that also
 *   appears in the opposite frame (the nearest surviving predecessor).
 *
 * Returns null when no predecessor exists (element is at the bottom of its stack).
 *
 * @param {object}          params
 * @param {string}          params.myKey        - series key of the element
 * @param {string}          params.catKey        - grouping key (categoryId, ringKey, …)
 * @param {'enter'|'leave'} params.direction
 * @param {Map}             params.prevOrders    - CategoryOrders from the previous frame
 * @param {Map}             params.currentOrders - CategoryOrders from the current frame
 * @returns {string|null}
 */
export function findPredKey({ myKey, catKey, direction, prevOrders, currentOrders }) {
  // "own" frame = the frame this element belongs to.
  // "opposite" frame = the other frame (where predecessor candidates live).
  // "walk" frame = whose stacking order we walk for Case B.
  const ownOrders      = direction === "enter" ? currentOrders : prevOrders;
  const oppositeOrders = direction === "enter" ? prevOrders    : currentOrders;
  const walkOrders     = direction === "enter" ? currentOrders : prevOrders;

  const ownEntry = ownOrders.get(catKey)?.find((e) => e.key === myKey);
  const myOrder  = ownEntry?.order ?? null;

  if (myOrder !== null) {
    // Case A: closest-below in opposite frame (includes entering/exiting elements).
    const entries = oppositeOrders.get(catKey) ?? [];
    let best = null;
    for (const e of entries) {
      if (typeof e.order !== "number") continue;
      if (e.order >= myOrder) continue;
      if (best === null || e.order > best.order) best = e;
    }
    return best?.key ?? null;
  }

  // Case B: last element in own stacking order that also exists in opposite frame.
  const walkEntries    = walkOrders.get(catKey) ?? [];
  const oppositeKeySet = new Set((oppositeOrders.get(catKey) ?? []).map((e) => e.key));
  let lastSurvivor = null;
  for (const e of walkEntries) {
    if (e.key === myKey) break;
    if (oppositeKeySet.has(e.key)) lastSurvivor = e.key;
  }
  return lastSurvivor;
}
