// Published Google Sheets CSV URLs.
// Used by src/services/language.js (runtime) and scripts/consolidateGSheets.js (CLI).
// To update: File > Share > Publish to web > select tab > CSV, then paste the URL here.
//

// Option A — a single tab with one column per language (columns: key, en, es, …).
// Replace Option A above with this when using a multi-language sheet.
export const sheetUrls = {
  locales:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vThwy-HhDfKBbKLLurkVig7Fig-ApCGUEot3GL-0UkfWg7pPS1y9P9Hvs43Aell3lK-tgnSZ9L2jErH/pub?gid=0&single=true&output=csv",
};

// Option B — one URL per language, each pointing to a separate tab (columns: key, value).
// IMPORTANT: put the site's default language first — it is used as the fallback locale.
// export const sheetUrls = {
//   // DEFAULT
//   en: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSteCiS-mPqbPG9P6TFu6ZWGRkO4b0teXdK3aBu4PPG9I9F3_he8_NxtIg5gTwVWi42S0Q5iwCjkDYj/pub?gid=0&single=true&output=csv",
//   es: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSteCiS-mPqbPG9P6TFu6ZWGRkO4b0teXdK3aBu4PPG9I9F3_he8_NxtIg5gTwVWi42S0Q5iwCjkDYj/pub?gid=697957655&single=true&output=csv",
// };
