import fs from 'fs';

const verifyPath = new URL('../verify-all-stocks.js', import.meta.url);
const src = fs.readFileSync(verifyPath, 'utf8');
const match = src.match(/const ALL_STOCKS = \[(.*?)\];/s);
if (!match) {
  throw new Error('ALL_STOCKS block not found in verify-all-stocks.js');
}

const arrayLiteral = `[${match[1]}]`;
const allStocks = Function(`return ${arrayLiteral}`)();

const response = await fetch('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json');
const raw = await response.json();
const rows = Array.isArray(raw) ? raw : Object.values(raw);

const nseEqByBase = new Map();
for (const row of rows) {
  const tradingSymbol = String(row.tradingsymbol || row.symbol || '').trim();
  const token = String(row.symboltoken || row.token || '').trim();
  if (!tradingSymbol || !token) continue;
  if (!tradingSymbol.endsWith('-EQ')) continue;

  const baseSymbol = tradingSymbol.replace(/-EQ$/, '');
  if (!nseEqByBase.has(baseSymbol)) {
    nseEqByBase.set(baseSymbol, token);
  }
}

const mismatches = [];
const notFound = [];
let matched = 0;

for (const stock of allStocks) {
  const expected = nseEqByBase.get(stock.apiSymbol);
  if (!expected) {
    notFound.push({ symbol: stock.apiSymbol, current: String(stock.token) });
    continue;
  }

  if (String(stock.token) === String(expected)) {
    matched += 1;
  } else {
    mismatches.push({
      symbol: stock.apiSymbol,
      current: String(stock.token),
      expected: String(expected),
    });
  }
}

console.log(`TOTAL\t${allStocks.length}`);
console.log(`MATCHED\t${matched}`);
console.log(`MISMATCH\t${mismatches.length}`);
console.log(`NOT_FOUND_IN_NSE_EQ\t${notFound.length}`);

console.log('\nMISMATCH_LIST');
console.log('SYMBOL\tCURRENT\tEXPECTED');
for (const item of mismatches) {
  console.log(`${item.symbol}\t${item.current}\t${item.expected}`);
}

console.log('\nNOT_FOUND_LIST');
console.log('SYMBOL\tCURRENT');
for (const item of notFound) {
  console.log(`${item.symbol}\t${item.current}`);
}
