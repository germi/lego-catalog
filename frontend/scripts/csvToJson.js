import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { csvToJson, multiLangCsvToJson } from "../src/utils/csvJsonUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lang = process.argv.slice(2).find((a) => !a.startsWith("--"));
const merge = process.argv.includes("--merge");

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

function writeLocale(l, data) {
  if (merge) {
    const localePath = path.resolve(__dirname, `../src/locales/${l}.json`);
    const local = fs.existsSync(localePath)
      ? JSON.parse(fs.readFileSync(localePath, "utf8"))
      : {};
    const merged = deepMerge(local, data);
    fs.writeFileSync(localePath, JSON.stringify(merged, null, 2));
    console.log(`Merged → src/locales/${l}.json`);
  } else {
    fs.writeFileSync(path.resolve(__dirname, `${l}.json`), JSON.stringify(data, null, 2));
    console.log(`Saved scripts/${l}.json (run with --merge to write to src/locales/)`);
  }
}

if (!lang) {
  // Multi-language mode: read scripts/locales.csv → one file per language
  const csvPath = path.resolve(__dirname, "locales.csv");
  if (!fs.existsSync(csvPath)) {
    console.error("scripts/locales.csv not found. Run npm run process-json (without a language) first.");
    process.exit(1);
  }
  const csv = fs.readFileSync(csvPath, "utf8");
  const locales = multiLangCsvToJson(csv);
  for (const [l, data] of Object.entries(locales)) {
    writeLocale(l, data);
  }
} else {
  // Single-language mode
  const csv = fs.readFileSync(path.resolve(__dirname, `${lang}.csv`), "utf8");
  const incoming = csvToJson(csv);
  writeLocale(lang, incoming);
}
