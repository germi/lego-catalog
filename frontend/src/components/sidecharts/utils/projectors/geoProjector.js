import * as d3 from "d3";

/**
 * Creates a Projector wrapping a D3 geographic projection.  Always returns a
 * ready-to-use projector — the projection is fit eagerly from the feature
 * collection + dimensions you pass in.  There is no `fit()` method; if any
 * input changes, build a new projector (typically via Vue `computed()` or
 * React `useMemo()`).
 *
 * @param {Object}          options
 * @param {Object}          options.geoData         - GeoJSON FeatureCollection used for bounds
 * @param {number}          options.width           - SVG width to fit to
 * @param {number}          options.height          - SVG height to fit to (fallback when bounds are degenerate)
 * @param {string|Function} [options.projectionType]- d3 projection name / factory / instance
 *                                                    (default: "geoMercator")
 * @param {Function}        [options.coordAccessor] - (d) => [lon, lat]
 *                                                    (default: d => [d.longitud, d.latitud])
 * @param {number}          [options.scale]         - padding factor (default 0.95)
 *
 * @returns {Projector|null} - { type, fn, invert, raw, idealHeight } or null.
 *
 * Projector interface:
 *   type        — "geo"
 *   fn(d)       — (d) => [svgX, svgY] | null
 *   invert      — ([x,y]) => [lon, lat] | null
 *   raw         — { geoProjection, path }
 *   idealHeight — aspect-correct height for the given width; parent may resize
 *                 the canvas to match.
 */
export function makeGeoProjector({
  geoData,
  width,
  height,
  projectionType = "geoMercator",
  coordAccessor  = (d) => [d.longitud, d.latitud],
  scale          = 0.95,
} = {}) {
  if (!geoData || !width || !height) return null;

  const proj    = createProjection(projectionType);
  const pathGen = d3.geoPath().projection(proj);

  proj.scale(1).translate([0, 0]);
  const b = pathGen.bounds(geoData);

  let idealHeight = height;
  if (b && isFinite(b[0][0]) && isFinite(b[1][0])) {
    const bw = b[1][0] - b[0][0];
    const bh = b[1][1] - b[0][1];
    idealHeight = bh > 0 ? (bw > 0 ? (width / bw) * bh : height) : height;

    const s = scale / Math.max(bw / width, bh / idealHeight);
    const t = [
      (width       - s * (b[1][0] + b[0][0])) / 2,
      (idealHeight - s * (b[1][1] + b[0][1])) / 2,
    ];
    proj.scale(s).translate(t);
  } else {
    proj.scale(scale).translate([width / 2, height / 2]);
  }

  return {
    type: "geo",

    fn(d) {
      const coords = coordAccessor(d);
      if (!coords) return null;
      return proj(coords);
    },

    invert([x, y]) {
      return proj?.invert?.([x, y]) ?? null;
    },

    raw: { geoProjection: proj, path: pathGen },

    idealHeight,
  };
}

function createProjection(projectionType) {
  if (typeof projectionType === "function") {
    if (typeof projectionType.scale === "function") return projectionType; // already an instance
    return projectionType();
  }
  const factory = d3[projectionType];
  if (!factory) {
    console.warn(`[geoProjector] Unknown projectionType "${projectionType}", falling back to geoMercator`);
    return d3.geoMercator().scale(1).translate([0, 0]);
  }
  const p = factory().scale(1).translate([0, 0]);
  if (projectionType === "geoIdentity") p.reflectY(true);
  return p;
}
