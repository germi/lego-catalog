/**
 * Helpers for the LineLayer / AreaLayer "in-between scales" choreography
 * when category ranges shift (years slide forward, etc.).
 *
 * The shared assumption: structural changes between two datasets happen at
 * the **edges** of the ordered id list. e.g.
 *
 *   prev = ["2000", "2001", "2002", "2003"]
 *   curr = ["2001", "2002", "2003", "2004"]
 *
 * — "2000" drops off the left, "2004" appends on the right.  When that
 * pattern holds we can morph the line shape through an intermediate
 * union-of-ids domain instead of snapping it abruptly.
 *
 * For middle changes (an id removed/added in the interior) we fall back
 * to a simple value-morph at the new domain.
 */

/**
 * Build the union of two ordered id lists by padding `primary` with
 * `secondary`'s start/end overflow.  `primary` stays in place; only the
 * portions of `secondary` that fall outside the [primary[0], primary[last]]
 * run get added.
 *
 *   mergeEdges(["B", "C"], ["A", "B", "C", "D"]) → ["A", "B", "C", "D"]
 *   mergeEdges(["A", "B"], ["B", "C"])           → ["A", "B", "C"]
 *   mergeEdges(["A", "B"], ["A", "B"])           → ["A", "B"]
 *
 * @param {Array<string|number>} primary
 * @param {Array<string|number>} secondary
 * @returns {Array<string|number>}
 */
export function mergeEdges(primary, secondary) {
  if (!primary?.length) return secondary?.slice() ?? [];
  if (!secondary?.length) return primary.slice();

  const first = primary[0];
  const last  = primary[primary.length - 1];

  const firstIdx = secondary.indexOf(first);
  const lastIdx  = secondary.lastIndexOf(last);

  const startPad = firstIdx > 0 ? secondary.slice(0, firstIdx) : [];
  const endPad   = lastIdx >= 0 && lastIdx < secondary.length - 1
    ? secondary.slice(lastIdx + 1)
    : [];

  return [...startPad, ...primary, ...endPad];
}

/**
 * Return `secondary`'s ids that fall before/after `primary`'s id range —
 * the "padding" pieces that `mergeEdges` would add.
 *
 * @param {Array<string|number>} primary
 * @param {Array<string|number>} secondary
 * @returns {{ startPad: Array, endPad: Array }}
 */
export function diffEdges(primary, secondary) {
  if (!primary?.length || !secondary?.length) {
    return { startPad: [], endPad: [] };
  }
  const first = primary[0];
  const last  = primary[primary.length - 1];
  const firstIdx = secondary.indexOf(first);
  const lastIdx  = secondary.lastIndexOf(last);
  return {
    startPad: firstIdx > 0 ? secondary.slice(0, firstIdx) : [],
    endPad:   lastIdx >= 0 && lastIdx < secondary.length - 1
      ? secondary.slice(lastIdx + 1)
      : [],
  };
}

/**
 * `mergeEdges` for whole datums.  Pads `primary` with `secondary`'s edge
 * overflow, keyed by `idOf(datum)`.  Shared ids preserve the corresponding
 * datum from `primary`; padding ids come from `secondary`.
 */
export function mergeDataEdges(primary, secondary, idOf = (d) => d.id) {
  if (!primary?.length) return secondary?.slice() ?? [];
  if (!secondary?.length) return primary.slice();
  const mergedIds = mergeEdges(primary.map(idOf), secondary.map(idOf));
  const primaryById   = new Map(primary.map((d) => [idOf(d), d]));
  const secondaryById = new Map(secondary.map((d) => [idOf(d), d]));
  return mergedIds.map((id) => primaryById.get(id) ?? secondaryById.get(id));
}

/**
 * Test whether the difference between `prev` and `curr` lives only at the
 * edges — every id shared between the two lists must form a contiguous
 * run with matching order in both.
 *
 * Used to decide whether to run the three-phase choreography (true) or
 * fall back to a single value-morph render (false).
 */
export function isEdgeOnlyChange(prev, curr) {
  if (!prev?.length || !curr?.length) return false;

  const inCurr = new Set(curr);
  const inPrev = new Set(prev);

  const sharedInPrev = contiguousShared(prev, inCurr);
  const sharedInCurr = contiguousShared(curr, inPrev);

  if (!sharedInPrev || !sharedInCurr) return false;
  if (sharedInPrev.length !== sharedInCurr.length) return false;
  for (let i = 0; i < sharedInPrev.length; i++) {
    if (sharedInPrev[i] !== sharedInCurr[i]) return false;
  }
  return true;
}

// Returns the contiguous slice of `arr` whose every element is in `otherSet`,
// or null if the shared elements are scattered (some non-shared id sits
// between two shared ones).
function contiguousShared(arr, otherSet) {
  let first = -1;
  let last  = -1;
  for (let i = 0; i < arr.length; i++) {
    if (otherSet.has(arr[i])) {
      if (first === -1) first = i;
      last = i;
    }
  }
  if (first === -1) return null;
  for (let i = first; i <= last; i++) {
    if (!otherSet.has(arr[i])) return null;
  }
  return arr.slice(first, last + 1);
}
