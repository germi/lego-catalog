/**
 * Project color palette — single source of truth for colors.
 *
 * Used in two ways:
 *   1. Tailwind CSS utilities (bg-primary-500, text-coral-600, etc.)
 *      The tailwindColorsPlugin in vite.config.js reads this file at build
 *      time and generates @theme CSS custom properties for everything here.
 *   2. JS imports for D3 scales, Chart.js datasets, inline styles, etc.
 *      import colors from '@/utils/colors'
 *      colors.primary[500]  →  '#...'
 *
 * All values are hex (converted from Tailwind v4's oklch via colorUtils.js),
 * so they work reliably in D3, Canvas, and any RGB-based consumer.
 *
 * HOW TO ADD COLORS:
 *   - Alias an existing Tailwind palette:  primary: twColors.sky
 *   - Custom color:  brand: { 400: '#ff5733', 600: '#e04e2c' }
 *   - Flat value:    chartHighlight: '#ffdd57'
 *
 * NOTE: All default Tailwind palettes (slate, gray, red, sky, etc.) are
 * already available as Tailwind CSS utilities without any extra config.
 * They are included here so they can also be imported in JS.
 */

import { twColors } from "./colorUtils.js";

export default {
  // ── Tailwind defaults ─────────────────────────────────────────────────────
  // All built-in Tailwind v4 palettes as hex, ready for JS/D3 import.
  // These are also available as Tailwind utilities (bg-slate-200, etc.) already.
  ...twColors,

  // ── Project aliases & custom colors ──────────────────────────────────────
  // Add or override colors here. These become Tailwind utilities via the
  // tailwindColorsPlugin in vite.config.js.
  primary: twColors.sky,
  // accent: twColors.violet,
  // brand: { 400: '#ff5733', 500: '#e8472b', 600: '#cc3e25' },
};
