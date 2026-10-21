import * as d3 from "d3";

const PREFIX = "ot-flag-";
const sanitize = (id) => String(id).replace(/[^a-zA-Z0-9_-]/g, "_");

/**
 * Creates a flag fill object compatible with resolveFill — works exactly like
 * fromTexture but renders a flag image clipped to the shape of the element.
 *
 * Uses patternUnits="objectBoundingBox" so the image scales to any element's
 * bounding box automatically — no position or size tracking needed.
 * Works great for circular markers: the flag fills the circle and is clipped
 * to the circular shape by the SVG paint model.
 *
 * Usage — anywhere a fill / color string is accepted:
 *
 *   // Per-datum flag on markers (resolved via ScatterLayer's d.color path):
 *   const markers = data.map(d => ({ ...d, color: fromFlag(d.iso) }));
 *
 *   // Flag as global color (all circles show the same flag):
 *   <ScatterLayer :color="fromFlag('FRA')" />
 *
 *   // Flag only on hover (per-datum):
 *   const markers = data.map(d => ({ ...d, hoverFill: fromFlag(d.iso) }));
 *
 *   // Region fill in BaseMap data:
 *   const data = { FRA: { color: fromFlag("FRA") } };
 *
 * @param {string} id           — flag identifier used in the image filename
 *                                (e.g. "FRA", "uk", "US")
 * @param {object} [opts]
 * @param {string} [opts.basePath]  — base URL path for flag images
 *                                    (default: BASE_URL + "img/flags/")
 * @param {string} [opts.extension] — filename extension (default: ".svg")
 */
export function fromFlag(id, { basePath: bp, extension = ".svg" } = {}) {
  const path = bp ?? ((import.meta.env?.BASE_URL ?? "/") + "img/flags/");
  const href = `${path}${id}${extension}`;
  const pid = `${PREFIX}${sanitize(id)}`;

  return {
    register(svgEl) {
      // Ensure <defs> exists (BaseMap always creates one, but guard anyway).
      let defs = d3.select(svgEl).select("defs");
      if (defs.empty()) {
        defs = d3.select(svgEl).insert("defs", ":first-child");
      }
      // Idempotent — skip if already registered.
      if (!defs.select(`#${pid}`).empty()) return;

      const pattern = defs
        .append("pattern")
        .attr("id", pid)
        // objectBoundingBox: tile covers the element's own bounding box (x=0..1, y=0..1).
        // The image fills the tile → flag scales to any element size automatically.
        .attr("patternUnits", "objectBoundingBox")
        .attr("patternContentUnits", "objectBoundingBox")
        .attr("x", 0).attr("y", 0)
        .attr("width", 1).attr("height", 1);

      pattern
        .append("image")
        .attr("x", 0).attr("y", 0)
        .attr("width", 1).attr("height", 1)
        .attr("href", href)
        .attr("preserveAspectRatio", "xMidYMid slice");
    },

    url() { return `url(#${pid})`; },
  };
}
