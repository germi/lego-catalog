/**
 * Resolves a fill value for an SVG element.
 * Accepts either a plain color string or a fill object (texture or gradient)
 * that implements { register(svgEl, context?), url(context?) }.
 * When given a fill object, registers its definition in the SVG <defs> and returns
 * the url() reference — registration is idempotent so calling this repeatedly
 * with the same fill instance is safe.
 *
 * Returns null when value is falsy so callers can chain with ??.
 *
 * @param {string|object|null|undefined} value — color string, texture, or gradient object
 * @param {SVGSVGElement} svgEl — the root SVG element to register patterns/gradients into
 * @param {object} [context] — optional context for polar-aware gradients
 * @returns {string|null}
 */
export function resolveFill(value, svgEl, context) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value.register === "function") {
    value.register(svgEl, context);
    return value.url(context);
  }
  return null;
}
