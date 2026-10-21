/**
 * Computes phase durations for enter/exit/update animations when the data structure changes.
 *
 * @param {object} opts
 * @param {number}  opts.duration     - Base animation duration
 * @param {boolean} opts.hasExits     - Whether elements are leaving (drives phase 1 length)
 * @param {boolean} opts.hasEnters    - Whether elements are entering (drives enterDelay)
 * @param {boolean} [opts.waitForPhase2=true] - Whether entering elements should also wait
 *   for surviving elements to reposition (phase 2) before appearing.
 *   Pass false when surviving elements are already at their destination positions.
 * @param {boolean} [opts.phase1OnSlide=false] - Give surviving elements a phase-1
 *   window even when nothing exits, as long as they still need to reposition
 *   (`waitForPhase2`). This lets them settle in place (e.g. update heights at their
 *   OLD x) BEFORE sliding — the same vertical-then-horizontal choreography the
 *   exit case already has. Without it, a pure-enter change has no phase 1, so
 *   survivors slide first and only then update. Opt-in so the cartesian
 *   ribbon/axis can use it while rose/segment keep the original exits-only phase 1.
 * @param {boolean} [opts.valuesChanged=true] - Whether any surviving element's
 *   value actually changed. On a pure-enter change where every survivor keeps the
 *   same value (compute it with `survivingValuesChanged`), the phase-1 value
 *   window has nothing to animate, so it is dropped (0 dur) and the transition
 *   collapses back to slide + grow (2 windows instead of 3). Ignored when exits
 *   are present, since exits always need phase 1 to collapse.
 *
 * @returns {{ phase1Dur: number, enterDelay: number }}
 */
export function computeEnterPhasing({ duration, hasExits, hasEnters, waitForPhase2 = true, phase1OnSlide = false, valuesChanged = true }) {
  const phase1Dur  = (hasExits || (phase1OnSlide && waitForPhase2 && valuesChanged)) ? duration : 0;
  const enterDelay = hasEnters ? phase1Dur + (waitForPhase2 ? duration : 0) : 0;
  return { phase1Dur, enterDelay };
}

/**
 * True when any SURVIVING category (an id present in both frames) has a
 * different value for any series. Drives the `valuesChanged` input above:
 * when it returns false on a pure-enter change, the value phase is skipped.
 *
 * Operates on the standard `{ id, values: { key: { value } } }` data shape
 * shared by the cartesian (ribbon/axis) and rose (segment/label) layers, so
 * every layer that calls it agrees on the result — they share this helper the
 * same way they share `computeEnterPhasing`.
 *
 * Note: this compares RAW values only, not rendered positions. If a new
 * category pushes the auto-scale max up, survivors rescale even with identical
 * raw values; callers that auto-scale may want to also treat a max change as
 * `valuesChanged` to avoid an instant resize.
 *
 * @param {Array} prevData  Previous frame data.
 * @param {Array} currData  Current frame data.
 * @returns {boolean}
 */
export function survivingValuesChanged(prevData, currData) {
  if (!prevData?.length || !currData?.length) return true;
  const prevById = new Map(prevData.map((d) => [String(d.id), d]));
  for (const cur of currData) {
    const prev = prevById.get(String(cur.id));
    if (!prev) continue; // entering category — not a survivor
    const cv = cur.values ?? {};
    const pv = prev.values ?? {};
    // Only check keys that existed in the PREVIOUS frame. A new series key
    // appearing in cv is a structural enter, not a value mutation on a survivor.
    for (const k of Object.keys(pv)) {
      if (cv[k]?.value !== pv[k]?.value) return true;
    }
  }
  return false;
}
