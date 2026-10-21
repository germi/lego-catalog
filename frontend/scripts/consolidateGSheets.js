import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { csvToJson, multiLangCsvToJson } from "../src/utils/csvJsonUtils.js";
import { sheetUrls } from "../src/services/languageSheetUrls.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merge = process.argv.includes("--merge");

/**
 * Deep merge two nested objects.
 * - Keys present in `incoming` always win.
 * - Keys present only in `local` are preserved.
 */
function deepMerge(local, incoming) {
  const result = { ...local };
  for (const [key, value] of Object.entries(incoming)) {
    if (value && typeof value === "object" && !Array.isArray(value) &&
        local[key] && typeof local[key] === "object" && !Array.isArray(local[key])) {
      result[key] = deepMerge(local[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function writeLocale(lang, incoming) {
  const localePath = path.resolve(__dirname, `../src/locales/${lang}.json`);
  const local = fs.existsSync(localePath)
    ? JSON.parse(fs.readFileSync(localePath, "utf8"))
    : {};
  const merged = deepMerge(local, incoming);

  if (merge) {
    fs.writeFileSync(localePath, JSON.stringify(merged, null, 2));
    console.log(`Merged → src/locales/${lang}.json`);
  } else {
    const outPath = path.resolve(__dirname, `${lang}.json`);
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2));
    console.log(`Saved scripts/${lang}.json (run with --merge to write to src/locales/)`);
  }
}

async function consolidate() {
  if (sheetUrls.locales) {
    // Multi-language mode: single CSV with one column per language
    console.log("Fetching locales (multi-language CSV)...");
    const response = await fetch(sheetUrls.locales);
    if (!response.ok) throw new Error(`Failed to fetch locales: ${response.statusText}`);
    const csv = await response.text();
    const locales = multiLangCsvToJson(csv);
    for (const [lang, incoming] of Object.entries(locales)) {
      writeLocale(lang, incoming);
    }
  } else {
    // Per-language mode: one URL per language code
    for (const [lang, url] of Object.entries(sheetUrls)) {
      console.log(`Fetching ${lang}...`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch ${lang}: ${response.statusText}`);
      const csv = await response.text();
      const incoming = csvToJson(csv);
      writeLocale(lang, incoming);
    }
  }
}

consolidate().catch((err) => {
  console.error(err);
  process.exit(1);
});
