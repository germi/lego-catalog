import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { jsonToCsv, multiLangJsonToCsv } from "../src/utils/csvJsonUtils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const lang = args[0];

if (!lang) {
  // Multi-language mode: read all locale files → scripts/locales.csv
  const localesDir = path.resolve(__dirname, "../src/locales");
  const files = fs.readdirSync(localesDir).filter((f) => f.endsWith(".json"));
  if (!files.length) {
    console.error("No locale files found in src/locales/");
    process.exit(1);
  }
  const locales = {};
  for (const file of files) {
    const l = path.basename(file, ".json");
    locales[l] = JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8"));
  }
  const csv = multiLangJsonToCsv(locales);
  fs.writeFileSync(path.resolve(__dirname, "locales.csv"), csv);
  console.log(`Saved scripts/locales.csv (languages: ${Object.keys(locales).join(", ")})`);
} else {
  // Single-language mode
  const filePath = path.resolve(__dirname, `../src/locales/${lang}.json`);
  const textObject = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const csv = jsonToCsv(textObject);
  fs.writeFileSync(path.resolve(__dirname, `${lang}.csv`), csv);
  console.log(`Saved scripts/${lang}.csv`);
}
