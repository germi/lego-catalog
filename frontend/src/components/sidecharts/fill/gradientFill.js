/**
 * Gradient fill factories for SVG elements.
 * Follow the same { register(svgEl, context?), url(context?) } interface as texture.js,
 * so they work transparently with resolveFill().
 *
 * Supports two polar-aware modes for rose/polar charts:
 *   - mode: "chart"   — gradient spans full chart radius, segments are windows into it
 *   - mode: "segment" — gradient maps to each segment's own inner→outer radius
 *
 * Context object (provided by SegmentLayer for polar charts):
 *   { centerX, centerY, maxRadius, innerRadius, outerRadius }
 */

let idCounter = 0;

function ensureDefs(svgEl) {
  let defs = svgEl.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgEl.prepend(defs);
  }
  return defs;
}

function createStops(gradientEl, stops) {
  stops.forEach(({ offset, color, opacity }) => {
    const stop = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    if (opacity != null) stop.setAttribute("stop-opacity", String(opacity));
    gradientEl.appendChild(stop);
  });
}

/**
 * Creates a linear gradient fill object.
 *
 * @param {Object} options
 * @param {Array<{offset: string, color: string, opacity?: number}>} options.stops
 * @param {number} [options.x1=0] - Gradient line start X
 * @param {number} [options.y1=0] - Gradient line start Y
 * @param {number} [options.x2=0] - Gradient line end X
 * @param {number} [options.y2=1] - Gradient line end Y (default: top-to-bottom)
 * @param {string} [options.gradientUnits="objectBoundingBox"]
 * @param {string} [options.spreadMethod]
 * @param {string} [options.gradientTransform]
 */
export function linearGradient(options = {}) {
  const {
    stops = [],
    x1 = 0, y1 = 0, x2 = 0, y2 = 1,
    gradientUnits,
    spreadMethod,
    gradientTransform,
  } = options;

  const id = `lg-${++idCounter}`;
  let registered = false;

  return {
    register(svgEl) {
      if (registered && svgEl.querySelector(`#${id}`)) return;
      const defs = ensureDefs(svgEl);

      const el = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
      el.setAttribute("id", id);
      el.setAttribute("x1", String(x1));
      el.setAttribute("y1", String(y1));
      el.setAttribute("x2", String(x2));
      el.setAttribute("y2", String(y2));
      if (gradientUnits) el.setAttribute("gradientUnits", gradientUnits);
      if (spreadMethod) el.setAttribute("spreadMethod", spreadMethod);
      if (gradientTransform) el.setAttribute("gradientTransform", gradientTransform);

      createStops(el, stops);
      defs.appendChild(el);
      registered = true;
    },
    url() {
      return `url(#${id})`;
    },
  };
}

/**
 * Creates a radial gradient fill object.
 *
 * Supports polar-aware modes via the `mode` option:
 * - mode: "chart"   — gradient center = chart center, radius = chart maxRadius
 *                      All segments share the same gradient (color by distance from center).
 * - mode: "segment" — gradient maps to each segment's innerRadius→outerRadius
 *                      Each segment shows the full gradient range.
 * - (default)       — raw cx/cy/r values used as-is (standard SVG behavior)
 *
 * @param {Object} options
 * @param {Array<{offset: string, color: string, opacity?: number}>} options.stops
 * @param {string} [options.mode] - "chart", "segment", or undefined for default
 * @param {string|number} [options.cx="50%"] - Center X
 * @param {string|number} [options.cy="50%"] - Center Y
 * @param {string|number} [options.r="50%"] - Radius
 * @param {string|number} [options.fx] - Focal point X
 * @param {string|number} [options.fy] - Focal point Y
 * @param {string} [options.gradientUnits]
 * @param {string} [options.spreadMethod]
 * @param {string} [options.gradientTransform]
 */
export function radialGradient(options = {}) {
  const {
    stops = [],
    mode,
    cx = "50%", cy = "50%", r = "50%",
    fx, fy,
    gradientUnits,
    spreadMethod,
    gradientTransform,
  } = options;

  const baseId = `rg-${++idCounter}`;
  const registeredIds = new Set();

  function createGradientEl(gradId, attrs) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    el.setAttribute("id", gradId);
    Object.entries(attrs).forEach(([key, val]) => {
      if (val != null) el.setAttribute(key, String(val));
    });
    createStops(el, stops);
    return el;
  }

  return {
    register(svgEl, context) {
      const defs = ensureDefs(svgEl);

      if (mode === "chart" && context) {
        // Chart-relative: one shared gradient centered at polar origin
        if (registeredIds.has(baseId) && svgEl.querySelector(`#${baseId}`)) return;
        const el = createGradientEl(baseId, {
          cx: context.centerX,
          cy: context.centerY,
          r: context.maxRadius,
          fx: fx != null ? context.centerX : undefined,
          fy: fy != null ? context.centerY : undefined,
          gradientUnits: "userSpaceOnUse",
          spreadMethod,
          gradientTransform,
        });
        defs.appendChild(el);
        registeredIds.add(baseId);
      } else if (mode === "segment" && context) {
        // Segment-relative: unique gradient per segment radius range
        const segId = `${baseId}-${Math.round(context.innerRadius)}-${Math.round(context.outerRadius)}`;
        if (registeredIds.has(segId) && svgEl.querySelector(`#${segId}`)) return;
        const el = createGradientEl(segId, {
          cx: context.centerX,
          cy: context.centerY,
          r: context.outerRadius,
          fx: fx != null ? context.centerX : undefined,
          fy: fy != null ? context.centerY : undefined,
          gradientUnits: "userSpaceOnUse",
          spreadMethod,
          gradientTransform,
        });
        // Remap stops so 0% maps to innerRadius/outerRadius ratio
        const innerRatio = context.innerRadius / context.outerRadius;
        el.querySelectorAll("stop").forEach((stop) => {
          const origOffset = parseFloat(stop.getAttribute("offset")) / 100;
          const mapped = innerRatio + origOffset * (1 - innerRatio);
          stop.setAttribute("offset", `${(mapped * 100).toFixed(2)}%`);
        });
        defs.appendChild(el);
        registeredIds.add(segId);
      } else {
        // Default: raw values
        if (registeredIds.has(baseId) && svgEl.querySelector(`#${baseId}`)) return;
        const el = createGradientEl(baseId, {
          cx, cy, r, fx, fy,
          gradientUnits: gradientUnits || undefined,
          spreadMethod,
          gradientTransform,
        });
        defs.appendChild(el);
        registeredIds.add(baseId);
      }
    },

    url(context) {
      if (mode === "segment" && context) {
        return `url(#${baseId}-${Math.round(context.innerRadius)}-${Math.round(context.outerRadius)})`;
      }
      return `url(#${baseId})`;
    },
  };
}
