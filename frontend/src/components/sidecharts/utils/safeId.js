/**
 * Converts an arbitrary string into a value that is safe to use as an HTML
 * `id` attribute, a CSS class token, or a CSS ID selector fragment.
 *
 * Any character that is not a word character (`[a-zA-Z0-9_]`) or a hyphen is
 * replaced with an underscore.  The result can be interpolated directly into
 * `.class-name` or `#id-name` selectors without additional CSS escaping.
 *
 * @param {*} str - Value to sanitise (coerced to string).
 * @returns {string}
 */
export function safeId(str) {
  return String(str).replace(/[^\w-]/g, "_");
}
