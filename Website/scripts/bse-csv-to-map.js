// scripts/bse-csv-to-map.js
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { fileURLToPath } from "url";

// needed for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvPath = path.join(__dirname, "../src/data/bse.csv");

const outPath = path.join(__dirname, "../src/data/tokenSymbolMap.js");

const csv = fs.readFileSync(csvPath, "utf8");
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

const map = {};
parsed.data.forEach((r) => {
  const token = String(r["Security Code"]).trim();
  if (!token) return;
  map[token] = {
    symbol: r["Security Id"]?.trim() || token,
    display: r["Issuer Name"]?.trim() || "",
    exchange: "BSE",
  };
});

const out = `// Auto-generated from BSE CSV\nexport const TOKEN_SYMBOL_MAP = ${JSON.stringify(map, null, 2)};\n`;
fs.writeFileSync(outPath, out);
console.log("✅ Created tokenSymbolMap.js with", Object.keys(map).length, "entries");
