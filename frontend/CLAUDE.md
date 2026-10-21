# CLAUDE.md

This file gives Claude Code context about this project. Update it when you set up a new project from this template.

---

## What this project is

The frontend of the Amazon price tracker: a Vue 3 + Vite SPA that charts price history
and manages products and alerts. Everything it renders comes from the Symfony +
API Platform backend in `../backend` (same repository — see the [root
README](../README.md)). There is no server-side rendering.

`npm run build` emits into `../backend/public/app/`, so in production Symfony serves the
API and this SPA from one origin. In dev, `VITE_API_URL` in `.env.development` points at
the Symfony dev server on port 8077.

---

## Tech stack

| Layer          | Library                                   |
| -------------- | ----------------------------------------- |
| Framework      | Vue 3 (Composition API, `<script setup>`) |
| Build          | Vite                                      |
| Routing        | Vue Router 4                              |
| Styling        | Tailwind CSS v4 (via `@tailwindcss/vite`) |
| Charts / maps  | D3 v7, TopoJSON                           |
| HTTP / caching | Axios (wrapped in `src/services/`)        |
| Animation      | GSAP                                      |
| Icons          | Heroicons, Iconify                        |
| Rich text      | Tiptap, Markdoc                           |
| i18n           | vue-i18n                                  |

Chart components come from the **sidecharts** library, vendored into `src/components/sidecharts/` and wired in via a local `file:` dependency in `package.json`. See [Sidecharts library](#sidecharts-library) below.

---

## Project structure

```
src/
  pages/          ← one file per route (index.vue, page.vue, …)
  components/     ← shared UI and chart components
  functions/      ← Vue composables (useLoadData, useFilters, useTooltip, …)
  services/       ← data layer (see below and docs/DATA-SERVICE.md)
  utils/          ← pure helpers (colors, csvJsonUtils, helpers, ids, …)
  routes.js       ← all route definitions
  tailwind.css    ← Tailwind entry point (@theme, @plugin, component classes)
docs/
  DATA-SERVICE.md     ← how the data/API layer works
  LANGUAGE-SYSTEM.md  ← how labels / translations work
  SIDECHARTS.md       ← layer reference + how to build custom layers
  TAILWIND-V4.md      ← how to extend the theme in v4 (no tailwind.config.js)
  FONT-AWESOME.md     ← using the FontAwesome Pro package
  MCP-CLAUDE.md       ← MCP setup notes
scripts/
  csvToJson.js    ← npm run process-csv
  jsonToCsv.js    ← npm run process-json
  generatePDF.js  ← npm run generate-pdf
public/data/      ← static data files served at runtime (CSV, JSON, …)
```

---

## Data service

All data loading goes through `src/services/`. Read [docs/DATA-SERVICE.md](docs/DATA-SERVICE.md) before touching this layer.

Key rules:

- **Add project endpoints only in `src/services/data.js`** — that is the only file you should edit day-to-day.
- Reads pass `useCache: false`: the dashboard has to reflect a scrape or an edit straight away, and the factory's session cache would otherwise serve a stale list right after a mutation.
- `apiFactory.js` is a building block — do not modify it.
- Use `localApi` for files in `public/data/`, `externalApi` for the backend, `googleSheetsApi` for Google Sheets CSVs.
- In components, load data via the `useLoadData` composable (`src/functions/useLoadData.js`), not by calling the service directly.

---

## Routing

Routes are defined in `src/routes.js`. Each route maps to a page component in `src/pages/`.

- Route `meta.title` is used as the page title.
- A multi-language route structure (nested under `/:lang`) is commented out in `routes.js` as a reference — uncomment and adapt when the project needs it.
- The `/language` route is a built-in label editor; remove it from production if unused.
- **Always navigate by route name, never by path string.** Use `<RouterLink :to="{ name: 'routeName' }">` in templates and `router.push({ name: 'routeName' })` in scripts. Never use `to="/some/path"` or `router.push('/some/path')`.
- **Never use the `next()` callback in navigation guards.** It is deprecated in Vue Router 5. Return the value instead: `next()` → return nothing, `next(false)` → `return false`, `next("/path")` → `return "/path"` (prefer `return { name: "routeName" }`). See the guard in `src/main.js` for the pattern.
- **Never add `:key` to `<RouterView>`.** Keying on a route param (e.g. `:key="route.params.id"`) forces the page component to fully remount on every param change, which destroys in-progress transitions and any state the component is holding. If a page needs to react to param changes, use a `watch` on the relevant `route.params` value instead.

---

## npm scripts

| Command                | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Start dev server (exposed on local network)           |
| `npm run build`        | Standard build                                        |
| `npm run build-prod`   | Build with `--base` set for a subfolder deploy        |
| `npm run build-zip`    | `build-prod` + ZIP the dist folder for client handoff |
| `npm run process-csv`  | Run `scripts/csvToJson.js`                            |
| `npm run process-json` | Run `scripts/jsonToCsv.js`                            |
| `npm run generate-pdf` | Run `scripts/generatePDF.js`                          |
| `npm run update-sidecharts` | Re-download the sidecharts library into `src/components/sidecharts/` |

When deploying to a client's subfolder, update the `--base` path in `build-prod` inside `package.json` before running `build-zip`.

---

## Sidecharts library

Charts and maps come from the **sidecharts** library, vendored into `src/components/sidecharts/` and exposed as a local `file:` dependency in `package.json` (`"sidecharts": "file:./src/components/sidecharts"`). Import paths work exactly like in the upstream library:

```js
import { ScatterPlot, AxisLayer } from "sidecharts/vue";
import { resolveFill } from "sidecharts/fill";
```

In practice you rarely write these imports: `SidechartsResolver` in `vite.config.js` auto-imports any sidecharts Vue component on first use, so you can drop `<ScatterPlot>` or `<AxisLayer>` straight into a template. It reads the exported names from `src/components/sidecharts/vue/index.js` at config time — restart the dev server after `npm run update-sidecharts` so new components are picked up.

`PriceChart.vue` composes `BaseCanvas` and the layers by hand rather than using the
`<LineChart>` preset, because that preset's `computeFullYDomain` always anchors the y
axis at zero — which flattens a €175–€235 price series into an unreadable band at the
top of the plot. Its own projector supplies a tight y domain that the line, both axes
and the target reference line all share.

**Do not edit files under `src/components/sidecharts/` from this project** — they are overwritten on every update. Library changes go in the upstream sidecharts repo.

For the full layer reference, how to build custom layers, and the rule about core changes, see [docs/SIDECHARTS.md](docs/SIDECHARTS.md). Official docs: [ot-components-docs.netlify.app](http://ot-components-docs.netlify.app/).

### Updating

```bash
npm run update-sidecharts
```

This wipes `src/components/sidecharts/` and re-downloads from the upstream repo using `git clone --sparse` over SSH (requires OneTandem GitHub access).

The source is configured at the top of `scripts/update-sidecharts.mjs`:

```js
const REPO    = 'OneTandem/ot-component-test';
const BRANCH  = 'sidecharts';
const SUBPATH = 'sidecharts';
const DEST    = 'src/components/sidecharts';
```

Edit these constants when the library moves to its own repo (e.g. `OneTandem/ot-sidecharts` on `main` with `SUBPATH = ''`).

**First-time setup on a fresh clone**: run `npm run update-sidecharts` *before* `npm install` so the `file:` dependency target exists.

---

## Embed / integration build

This project can be embedded into a client CMS (WordPress, Geco, etc.) as a ZIP of the `dist/` folder. The host page needs:

```html
<script type="module" crossorigin src="/assets/index.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index.css" />
<div id="ot-app"></div>
```

The `--base` path in `build-prod` must match the asset path on the client's server (not necessarily the public URL).

---

## Language / labels

Labels and translations are managed via the language system. See [docs/LANGUAGE-SYSTEM.md](docs/LANGUAGE-SYSTEM.md).

**Every piece of declarative text visible in the app must be rendered through `OTText`**, not as a plain string or inline text node. `OTText` looks up the label by its `value` key in the active locale's JSON file (e.g. `public/data/lang/en.json`).

```vue
<OTText value="ABOUT.TITLE" />
```

For rich text (bold, links, lists, etc.) pass the `markdown` prop:

```vue
<OTText value="ABOUT.INTRO" markdown />
```

### Language file structure

Keys must be organized hierarchically by page or section — never use flat top-level keys. Use `PAGE.ELEMENT` or deeper nesting:

```json
{
  "ABOUT": {
    "TITLE": "About this project",
    "INTRO": "This dashboard shows **mobility data** for…"
  },
  "MAP": {
    "LEGEND_TITLE": "Legend",
    "TOOLTIP.VALUE": "Value"
  }
}
```

**Whenever you add a new `OTText` key — or any `t()` call — you must also add the corresponding entry to every locale file in `public/data/lang/` (e.g. `en.json`) in the same change.** Never leave a key that exists in the code but is missing from the language files.

### i18n API

```js
import { useI18n } from "vue-i18n";
const { t, locale, availableLocales, getLocaleMessage, setLocaleMessage } =
  useI18n();

t("OVERVIEW.TITLE"); // translate a key
locale.value; // current locale code
locale.value = "es"; // switch locale
availableLocales; // array of registered locale codes
getLocaleMessage(locale.value); // full message bundle for a locale
setLocaleMessage(locale, messages); // merge/replace bundle for a locale
```

### Saving labels

`LabelEditModal` calls `setLocaleMessage()` directly after saving. The `setNestedValue()` util builds the updated bundle object before passing it to vue-i18n.

- If the project has no translated UI, remove `...language` from `src/services/data.js` and drop the `/language` route.
- Locale switching uses the `/:lang` route prefix (see commented example in `routes.js`).

---

## Colors

**`src/utils/colors.js` is the single source of truth for all colors.** Never hardcode a hex value anywhere else in the project.

The file serves two consumers simultaneously:

1. **Tailwind utilities** — `tailwindColorsPlugin` (in `vite.config.js`) reads this file at build time and writes `src/utils/colors.generated.css`, a `@theme` block of `--color-*` custom properties that `src/tailwind.css` imports. Any color defined here is therefore immediately available as a Tailwind class (`bg-primary-500`, `text-coral-600`, etc.). There is **no `tailwind.config.js`** — this is Tailwind v4; see [docs/TAILWIND-V4.md](docs/TAILWIND-V4.md). Never edit `colors.generated.css` by hand.
2. **JS/D3/inline** — import the object directly when Tailwind utilities aren't enough (D3 scales, canvas, inline styles):

```js
import colors from "@/utils/colors";
colors.primary[500]; // '#0ea5e9'
colors.chartHighlight; // '#ffdd57'
```

### Adding colors

All additions go in `colors.js` only — three patterns:

```js
// Alias a Tailwind default palette
primary: twColors.sky,

// Custom palette (object of shades)
brand: { 400: "#ff5733", 500: "#e8472b", 600: "#cc3e25" },

// Flat value (no shades needed)
chartHighlight: "#ffdd57",
```

After saving, the new name is immediately usable as a Tailwind utility (`bg-brand-500`, `text-chart-highlight`) and via the JS import.

---

## Coding conventions

- Use `<script setup>` for all new components.
- Vue APIs (`ref`, `computed`, `watch`, etc.) and components are auto-imported — never add `import { ref } from 'vue'` or similar statements.
- Composables live in `src/functions/` and are named `use*.js`.
- Keep components focused: data fetching belongs in `useLoadData`, not in the template.
- Data files in `public/data/` are semicolon-delimited CSV by default (parsed by `localApi`). Use comma CSV or JSON when the source requires it and update the api client accordingly.
- Do not commit `.env` files. Document required env vars here:

```
VITE_API_URL=   # Base URL of the backend API (without /api suffix)
```

### Constants — column names and other identifiers

**All constants (CSV column names, status values, category keys, etc.) live in `src/utils/ids.js`.** Never use a raw string literal for a column name or other shared identifier anywhere in the codebase — define it once in `ids.js` and import it everywhere.

Constant names are always `UPPER_SNAKE_CASE`. CSV column names go under `COLUMNS`:

```js
import { COLUMNS } from "@/utils/ids";

d[COLUMNS.NAME]; // instead of d["Project Name"]
d[COLUMNS.STATUS]; // instead of d["Status"]
```

When adding a new column reference or shared key, add it to `ids.js` first, then use the constant in code.

### Number formatting

**Always use `number()` from `src/utils/helpers.js`** to format numeric values — never `toFixed`, `toLocaleString`, or manual string construction.

```js
import { number } from "@/utils/helpers";

number(1234567, 1, { abbr: true, decimal: ".", thousand: "," }); // "1.2M"
number(1234.5, 2); // "1.234,50" (default locale)
```

`number()` supports `abbr: true` for K / M / B suffixes. Default separators are European (`,` decimal, `.` thousand) — override with `decimal: "."` and `thousand: ","` for English output.

`src/utils/format.js` contains project-level presets built on `number()`. Add new presets there rather than repeating options inline.

---

## Image download

`ImageBtn` and `ImageWrapper` are shared components for letting users download a DOM element (charts, tables, etc.) as an image.

**`ImageBtn`** (`src/components/ImageBtn.vue`) renders a button that captures a target element via the [snapdom](https://github.com/zumerlab/snapdom) library and triggers a file download.

| Prop        | Type    | Default       | Description                           |
| ----------- | ------- | ------------- | ------------------------------------- |
| `elementId` | String  | `"image"`     | `id` of the DOM element to capture    |
| `filename`  | String  | `"image"`     | Downloaded file name (no extension)   |
| `format`    | String  | `"png"`       | `"png"` or `"svg"`                    |
| `width`     | Number  | `null`        | Fixed pixel width of the output image |
| `bgColor`   | String  | `"#fff"`      | Background fill color                 |
| `disabled`  | Boolean | `false`       | Disable the button                    |
| `btnClass`  | String  | _(gray pill)_ | Tailwind classes for the button       |

The button shows a spinner while capturing. Its default slot renders a `PhotoIcon`; replace it with any icon or label.

**`ImageWrapper`** (`src/components/ImageWrapper.vue`) wraps the target element and adds padding (without affecting layout) so the captured image has breathing room. Set `id` to match `elementId` on `ImageBtn`.

| Prop     | Type   | Default   | Description                                         |
| -------- | ------ | --------- | --------------------------------------------------- |
| `id`     | String | `"image"` | Must match `elementId` on `ImageBtn`                |
| `margin` | Number | `24`      | Padding (px) added around the content in the export |

Add the class `image-hidden` to any child element that should be excluded from the captured image (e.g. download buttons, tooltips, overlays).

```vue
<ImageWrapper id="my-chart" :margin="32">
  <MyChart />
  <ImageBtn element-id="my-chart" filename="my-chart" class="image-hidden" />
</ImageWrapper>
```

---

## Project-specific notes

> Fill this section in when setting up a new project.

- **Data source:** _e.g. local CSVs in public/data/, external API at …_
- **Backend repo:** _link or "none"_
- **Deploy target:** _Netlify / client CMS subfolder / …_
- **Languages / locales:** _e.g. es, en_
- **External chart library:** _repo name / npm package used for charts_
- **Known quirks:** _anything unusual about this specific project_
