import * as d3 from "d3";

/**
 * Resolve an ease spec to a d3 ease function.
 *
 * Accepts:
 *   - a d3 ease function (returned as-is)
 *   - a d3 ease name string (e.g. "easeCubic", "easeLinear", "easeBackOut")
 *   - null / undefined / unknown → d3's default ease (`d3.easeCubic`)
 *
 * Layers throughout the library declare an `ease` prop defaulting to
 * `GLOBAL_DEFAULTS.ease` ("easeCubic").  Passing the prop through this
 * helper before handing it to `transition.ease(...)` keeps the override
 * surface consistent without forcing every call site to remember the
 * string→fn step.
 */
export function resolveEase(ease) {
  if (typeof ease === "function") return ease;
  if (typeof ease === "string" && typeof d3[ease] === "function") return d3[ease];
  return d3.easeCubic;
}
