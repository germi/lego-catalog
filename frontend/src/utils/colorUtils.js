/**
 * oklchToHex — converts an oklch(L% C H) CSS string to a hex color.
 *
 * Tailwind v4 stores its color palette as oklch values. This function converts
 * them to hex so they work with D3 color scales, Canvas, and any JS consumer
 * that expects hex or standard RGB.
 *
 * Non-oklch strings ('inherit', 'transparent', plain hex, etc.) pass through unchanged.
 */
export function oklchToHex(str) {
  if (typeof str !== "string") return str;
  const m = str.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)\s*\)/);
  if (!m) return str;

  let L = Number(m[1]);
  if (m[2] === "%") L /= 100; // normalize to [0, 1]
  const C = Number(m[3]);
  const H = Number(m[4]);

  // OKLCH → OKLab
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab → linear sRGB (Bradford-adapted D65 matrix)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3,
    m3 = m_ ** 3,
    s3 = s_ ** 3;
  const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  // Linear sRGB → gamma-encoded sRGB
  const toGamma = (x) => {
    const v = Math.max(0, Math.min(1, x));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  const r = Math.round(toGamma(rLin) * 255);
  const g = Math.round(toGamma(gLin) * 255);
  const bl = Math.round(toGamma(bLin) * 255);

  return "#" + [r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Recursively converts all values in a Tailwind color scale object to hex.
 * Handles both palette objects ({ 50: 'oklch(...)', 100: 'oklch(...)', ... })
 * and flat string values ('inherit', 'transparent', '#000', etc.).
 */
function convertScale(scale) {
  if (typeof scale === "string") return oklchToHex(scale);
  return Object.fromEntries(
    Object.entries(scale).map(([shade, value]) => [shade, oklchToHex(value)])
  );
}

/**
 * All Tailwind v4 default colors, converted to hex.
 *
 * Includes every palette shipped with Tailwind v4: slate, gray, zinc, neutral,
 * stone, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky,
 * blue, indigo, violet, purple, fuchsia, pink, rose, plus flat values like
 * 'black', 'white', 'transparent', etc.
 *
 * These are also already available as Tailwind CSS utilities (bg-sky-500, etc.)
 * without any configuration — this export is for JS/D3/Canvas use.
 */
import rawColors from "tailwindcss/colors";

export const twColors = Object.fromEntries(
  Object.entries(rawColors).map(([name, scale]) => [name, convertScale(scale)])
);
