# Language system

- [Key parts](#key-parts)
  - [Components](#components-srccomponentslanguage)
  - [Language editor route](#language-editor-route-language)
  - [Composable](#composable-srcfunctionsuseloadlabelsjs)
  - [Utilities](#utilities)
  - [CLI scripts](#cli-scripts)
- [Multilanguage](#multilanguage)
- [Backend connection](#backend-connection)
  - [Symfony backend](#symfony-backend)
  - [Google Sheets](#google-sheets)

## Key parts

### Components (`src/components/language/`)

- **`OTText.vue`** — The main component for rendering any translatable text. Always use `<OTText>` instead of `$t()` directly. It renders the translated string and, when the app is in edit mode (`?mode=edit`), wraps it with an inline edit button that opens a modal to update the label. Supports a `markdown` prop for rich text content.
- **`LabelEditModal.vue`** — Modal dialog for editing a label's value across all locales. Opened by `OTText` in edit mode.
- **`MarkdownEditor.vue`** — WYSIWYG rich text editor (TipTap-based) used inside `LabelEditModal` when the label is markdown.
- **`OTMarkdown.vue`** — Renders a markdown string as HTML using Markdoc.
- **`LabelTreeItem.vue`** — Recursive tree view used in the `/language` page to browse all labels.
- **`LanguageSwitcher.vue`** — Dropdown to switch between available locales.

### Language editor route (`/language`)

The app includes a built-in route at `/language` that provides a tree view of all labels for browsing and editing. This page is intended for development and content review — it lists every key in the current locale and allows inline editing.

### Composable (`src/functions/useLoadLabels.js`)

`useLoadLabels` fetches labels from an external backend (own API or Google Sheets) and merges them into the vue-i18n messages at runtime. Enable it by uncommenting the `useLoadLabels()` call in `App.vue`. See the **Backend connection** section below for configuration.

### Utilities

- **`src/utils/language.js`** — Helpers for reading/writing nested label objects (`getNestedValue`, `setNestedValue`) and persisting edits to locale JSON files during development via `saveLabel`.
- **`src/utils/csvJsonUtils.js`** — Conversion functions between CSV and nested JSON (`jsonToCsv`, `csvToJson`, `flattenJson`, `unflattenJson`, `multiLangJsonToCsv`, `multiLangCsvToJson`). Used by both the app and the CLI scripts.

### Vite plugin (`vite-plugins/locale-writer.js`)

This plugin is what makes the in-browser label editor actually useful in dev mode: when you click a label, edit its text, and save, the change is written straight back to the `src/locales/*.json` files on disk — no manual copy-pasting required.

Under the hood it registers a `POST /__save-locale` endpoint on the Vite dev server. When `saveLabel` (in `src/utils/language.js`) is called from the browser, it hits that endpoint and the plugin updates the right key in the right JSON file. Nested keys use dot-notation (e.g. `"nav.home"`).

The plugin only exists in `npm run dev`. In production, label editing requires a Symfony backend — see [Symfony backend](#symfony-backend).

### CLI scripts

Three npm scripts for working with locale files. Each supports two modes: **per-language** (pass a language code) and **multi-language** (omit the language code to work with all locales at once in a single CSV).

- **`npm run process-json`** — Converts locale JSON to CSV.
  ```bash
  npm run process-json -- en   # reads src/locales/en.json → writes scripts/en.csv
  npm run process-json         # reads all src/locales/*.json → writes scripts/locales.csv (key,en,es,… columns)
  ```

- **`npm run process-csv`** — Converts a CSV file back to JSON.
  ```bash
  npm run process-csv -- en           # reads scripts/en.csv → writes scripts/en.json
  npm run process-csv -- en --merge   # reads scripts/en.csv → merges into src/locales/en.json
  npm run process-csv                 # reads scripts/locales.csv → writes scripts/{lang}.json for each language
  npm run process-csv -- --merge      # reads scripts/locales.csv → merges into src/locales/{lang}.json for each language
  ```
  Without `--merge`, inspect the output in `scripts/` before copying to `src/locales/` manually.

- **`npm run consolidate-gsheets`** — Downloads locale CSVs from Google Sheets and smart-merges them.
  ```bash
  npm run consolidate-gsheets           # fetches all locales → writes scripts/{lang}.json
  npm run consolidate-gsheets -- --merge  # fetches all locales → merges into src/locales/{lang}.json
  ```
  Behaviour depends on how `sheetUrls` is configured in `src/services/languageSheetUrls.js` — see the [Google Sheets](#google-sheets) section.

  Without `--merge`, inspect the output in `scripts/` before committing.

**Smart merge behaviour** (applies to both `process-csv --merge` and `consolidate-gsheets --merge`): incoming values always win over what is currently in `src/locales/`, but any keys that exist locally and are absent in the incoming source are preserved. This means local-only labels are never lost.

## Multilanguage

By default, the template runs in single-language mode (English only). To enable multilanguage support (Spanish in this example):

1. **`src/main.js`** — Uncomment the Spanish locale import and add it to the messages object:

   ```js
   import es from "./locales/es.json";
   ```

   ```js
   messages: {
     en,
     es,
   },
   ```

2. **`src/routes.js`** — Comment out the single-language routes and uncomment the multilanguage version that wraps pages under `/:lang(en|es)`:

   ```js
   // Single language (comment out):
   // export const routes = [
   //   { path: "/", name: "home", component: Home, ... },
   //   ...
   // ];

   // Multilanguage (uncomment):
   export const routes = [
     {
       path: "/:lang(en|es)",
       component: Template,
       children: [ ... ],
     },
     { path: "/:pathMatch(.*)*", redirect: "/en" },
   ];
   ```

3. **`src/components/NavBar.vue`** — Optionally uncomment the `<LanguageSwitcher />` component to show a language toggle in the navigation bar:

   ```html
   <LanguageSwitcher />
   ```

Add new languages by creating a new JSON file in `src/locales/` (e.g. `fr.json`), importing it in `main.js`, adding it to `messages`, and extending the route pattern (e.g. `/:lang(en|es|fr)`).

## Backend connection

By default, labels are loaded from the static JSON files in `src/locales/`. To load labels dynamically from a backend, uncomment the following line in **`src/App.vue`**:

```js
const { loading } = useLoadLabels();
```

### Symfony backend

No additional configuration is needed. `useLoadLabels` will call the external API endpoints defined in `src/services/data.js` (`getLabels` / `postLabels`) to fetch and update labels per locale.

### Google Sheets

To use a published Google Sheet as the labels backend:

0. **`src/App.vue`** — Uncomment the `useLoadLabels()` call (see [Backend connection](#backend-connection) above).

1. **`src/functions/useLoadLabels.js`** — Set the flag to `true`:

   ```js
   const USE_GOOGLE_SHEETS = true;
   ```

2. **`src/services/languageSheetUrls.js`** — Update `sheetUrls` with your published sheet URLs. Two formats are supported:

   **Per-language tabs** — one URL per locale, each pointing to a separate sheet tab:
   ```js
   export const sheetUrls = {
     en: "https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?gid=0&single=true&output=csv",
     es: "https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?gid=SHEET_TAB_GID&single=true&output=csv",
   };
   ```
   Each tab must have `key` and `value` columns.

   **Single multi-language sheet** — one tab with a `key` column plus one column per language (`en`, `es`, …):
   ```js
   export const sheetUrls = {
     locales: "https://docs.google.com/spreadsheets/d/e/YOUR_SHEET_ID/pub?gid=0&single=true&output=csv",
   };
   ```
   When `sheetUrls.locales` is present, `consolidate-gsheets` treats the sheet as a multi-language CSV and extracts one JSON file per language column.

   To publish a sheet: File > Share > Publish to web > select the tab > CSV, then paste the URL here.

   This file is the single source of truth for sheet URLs — it is imported by both the runtime (`src/services/language.js`) and the CLI (`scripts/consolidateGSheets.js`). Only edit URLs here.
