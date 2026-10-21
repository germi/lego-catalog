# Tailwind CSS v4 — How theme extension works

This project uses Tailwind CSS v4. The way you extend the theme (colors, fonts,
text sizes, spacing, etc.) changed significantly from v3. This doc explains both
approaches so you know what changed and what to do now.

---

## What changed from v3

In **v3**, all theme configuration lived in `tailwind.config.js`:

```js
// tailwind.config.js (v3 — no longer used)
module.exports = {
  theme: {
    extend: {
      colors: { primary: { 500: '#0ea5e9' } },
      fontFamily: { sans: ['"Inter var"', 'sans-serif'] },
      fontSize: { 'display': ['3rem', { lineHeight: '1.1' }] },
    },
  },
};
```

In **v4**, there is no `tailwind.config.js`. Theme extension happens directly in
`src/tailwind.css` using the `@theme` directive. Under the hood, Tailwind v4 uses
CSS custom properties for everything.

---

## How to extend the theme in v4

All theme extensions go in the `@theme` block inside `src/tailwind.css`.

### Fonts

```css
@theme {
  --font-sans: "Inter var", ui-sans-serif, system-ui, sans-serif;
  --font-display: "Playfair Display", serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

This generates utilities like `font-sans`, `font-display`, `font-mono`.

### Font sizes

```css
@theme {
  --text-display: 3rem;
  --text-display--line-height: 1.1;
  --text-xs: 0.75rem;
}
```

This generates `text-display`, `text-xs`, etc.

### Spacing / sizing

```css
@theme {
  --spacing-18: 4.5rem;   /* adds p-18, m-18, w-18, etc. */
  --spacing-128: 32rem;
}
```

### Border radius

```css
@theme {
  --radius-xl: 1rem;
  --radius-pill: 9999px;
}
```

Generates `rounded-xl`, `rounded-pill`, etc.

### Screens (breakpoints)

```css
@theme {
  --breakpoint-xs: 30rem;
  --breakpoint-3xl: 120rem;
}
```

---

## Colors — handled separately via `colors.js`

Colors are **not** added manually to `@theme`. Instead, edit `src/utils/colors.js`.

### How it works

`src/utils/colorUtils.js` converts Tailwind v4's `oklch(…)` color values to hex
using a pure-math conversion function, then exports the entire default palette as
`twColors`. This means you never have to hardcode hex values for Tailwind's built-in
colors — they stay in sync automatically.

`src/utils/colors.js` spreads `twColors` and adds project-specific aliases/customs:

```js
import { twColors } from './colorUtils.js';

export default {
  // All Tailwind default palettes (slate, gray, red, sky, …) — as hex
  ...twColors,

  // Project aliases
  primary: twColors.sky,

  // Custom project colors (added alongside defaults, not replacing them)
  coral: { 400: '#fb923c', 600: '#ea580c' },
};
```

At dev/build time, `vite-plugins/tailwind-colors.js` reads `colors.js` and writes
`src/utils/colors.generated.css` — a `@theme` block with a CSS custom property for
every color. `src/tailwind.css` imports that file:

```css
@import "./utils/colors.generated.css";
```

`colors.generated.css` is gitignored and regenerated automatically. **Never edit it
directly.**

### Why write to disk instead of injecting via transform

Tailwind v4's `@reference` directive (used in Vue `<style>` blocks to make
`@apply` work) reads CSS files directly from disk, bypassing Vite's module
transform pipeline. Writing the generated theme to an actual file ensures
`@reference` picks up the colors too.

### What's available

All default Tailwind palettes are already CSS utilities (no config needed):
`bg-slate-200`, `text-emerald-600`, `border-rose-400`, etc.

Custom colors like `primary` and `coral` above become utilities too:
`bg-primary-700`, `text-coral-400`, etc.

### JS / D3 usage

```js
import colors from '@/utils/colors';

// Full Tailwind palette available:
colors.sky[500]      // '#00a6f4'  (Tailwind v4 sky-500)
colors.red[300]      // '#fca4a4'

// Project aliases:
colors.primary[700]  // same as colors.sky[700]

// In a D3 scale:
const colorScale = d3.scaleOrdinal().range([
  colors.primary[500],
  colors.coral[400],
  colors.gray[300],
]);
```

> Note: Tailwind v4 updated its color palette. Values differ slightly from v3
> (richer saturation via a wider color gamut). The hex values exported here are
> the closest sRGB equivalents of the v4 oklch colors.

---

## Using `@apply` in Vue `<style>` blocks

In Tailwind v4, `@apply` inside a Vue component's `<style>` block requires a
`@reference` at the top so Tailwind knows where to find the theme and utilities:

```vue
<style scoped>
@reference "../tailwind.css";

.my-class {
  @apply bg-primary-500 text-white;
}
</style>
```

The path must point to `src/tailwind.css` (adjust `../` based on the component's
location). This is only needed when using `@apply` — utility classes used directly
in the template (`class="bg-primary-500"`) work without any extra setup.

---

## Plugins

Tailwind plugins are declared in `src/tailwind.css` with `@plugin`:

```css
@plugin "@tailwindcss/forms";
@plugin "@tailwindcss/typography";
```

No plugin array in a config file needed.

---

## Reference: CSS custom property naming

| Category   | Pattern                        | Example utility      |
| ---------- | ------------------------------ | -------------------- |
| Colors     | `--color-{name}-{shade}`       | `bg-primary-700`     |
| Font family| `--font-{name}`                | `font-sans`          |
| Font size  | `--text-{name}`                | `text-display`       |
| Spacing    | `--spacing-{name}`             | `p-18`, `gap-18`     |
| Radius     | `--radius-{name}`              | `rounded-pill`       |
| Breakpoint | `--breakpoint-{name}`          | `xs:hidden`          |

Full reference: https://tailwindcss.com/docs/theme
