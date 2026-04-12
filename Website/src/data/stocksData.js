// src/data/stocksData.js
// This file provides a curated list of stocks with NSE tokens for AngelOne API
// BSE tokens from tokenSymbolMap.js are available but AngelOne primarily uses NSE

import { TOKEN_SYMBOL_MAP } from './tokenSymbolMap.js';

// NSE Token mapping for AngelOne API (these work with the live API)
const NSE_TOKEN_MAP = {
  // Indices
  "26000": { symbol: "NIFTY", display: "Nifty 50", exchange: "NSE" },
  "99926000": { symbol: "NIFTY", display: "Nifty 50", exchange: "NSE" },
  "99926009": { symbol: "BANKNIFTY", display: "Bank Nifty", exchange: "NSE" },
  
  // Top NSE Stocks with correct tokens
  "2885": { symbol: "RELIANCE", display: "Reliance Industries Ltd.", exchange: "NSE" },
  "11536": { symbol: "TCS", display: "Tata Consultancy Services Ltd.", exchange: "NSE" },
  "1333": { symbol: "HDFCBANK", display: "HDFC Bank Ltd.", exchange: "NSE" },
  "1594": { symbol: "INFY", display: "Infosys Ltd.", exchange: "NSE" },
  "4963": { symbol: "ICICIBANK", display: "ICICI Bank Ltd.", exchange: "NSE" },
  "1922": { symbol: "KOTAKBANK", display: "Kotak Mahindra Bank Ltd.", exchange: "NSE" },
  "11483": { symbol: "LT", display: "Larsen & Toubro Ltd.", exchange: "NSE" },
  "1394": { symbol: "HINDUNILVR", display: "Hindustan Unilever Ltd.", exchange: "NSE" },
  "236": { symbol: "ASIANPAINT", display: "Asian Paints Ltd.", exchange: "NSE" },
  "7229": { symbol: "HCLTECH", display: "HCL Technologies Ltd.", exchange: "NSE" },
  "10604": { symbol: "BHARTIARTL", display: "Bharti Airtel Ltd.", exchange: "NSE" },
  "10999": { symbol: "MARUTI", display: "Maruti Suzuki India Ltd.", exchange: "NSE" },
  "3351": { symbol: "SUNPHARMA", display: "Sun Pharmaceutical Industries Ltd.", exchange: "NSE" },
  "3506": { symbol: "TITAN", display: "Titan Company Ltd.", exchange: "NSE" },
  "5900": { symbol: "AXISBANK", display: "Axis Bank Ltd.", exchange: "NSE" },
  "17963": { symbol: "NESTLEIND", display: "Nestle India Ltd.", exchange: "NSE" },
  "8840": { symbol: "TATAMOTORS", display: "Tata Motors Ltd.", exchange: "NSE" },
  "3787": { symbol: "WIPRO", display: "Wipro Ltd.", exchange: "NSE" },
  "14977": { symbol: "POWERGRID", display: "Power Grid Corporation of India Ltd.", exchange: "NSE" },
  "3045": { symbol: "SBIN", display: "State Bank of India", exchange: "NSE" },
  "317": { symbol: "BAJFINANCE", display: "Bajaj Finance Ltd.", exchange: "NSE" },
  "16675": { symbol: "BAJAJFINSV", display: "Bajaj Finserv Ltd.", exchange: "NSE" },
  "11532": { symbol: "ULTRACEMCO", display: "UltraTech Cement Ltd.", exchange: "NSE" },
  "11723": { symbol: "JSWSTEEL", display: "JSW Steel Ltd.", exchange: "NSE" },
  "25": { symbol: "ADANIENT", display: "Adani Enterprises Ltd.", exchange: "NSE" },
  "15083": { symbol: "ADANIPORTS", display: "Adani Ports and Special Economic Zone Ltd.", exchange: "NSE" },
  "2475": { symbol: "ONGC", display: "Oil and Natural Gas Corporation Ltd.", exchange: "NSE" },
  "20374": { symbol: "COALINDIA", display: "Coal India Ltd.", exchange: "NSE" },
  "11630": { symbol: "NTPC", display: "NTPC Ltd.", exchange: "NSE" },
  "1660": { symbol: "ITC", display: "ITC Ltd.", exchange: "NSE" },
  "10940": { symbol: "DIVISLAB", display: "Divi's Laboratories Ltd.", exchange: "NSE" },
  "694": { symbol: "CIPLA", display: "Cipla Ltd.", exchange: "NSE" },
  "10440": { symbol: "LUPIN", display: "Lupin Ltd.", exchange: "NSE" },
  "1348": { symbol: "HEROMOTOCO", display: "Hero MotoCorp Ltd.", exchange: "NSE" },
  "910": { symbol: "EICHERMOT", display: "Eicher Motors Ltd.", exchange: "NSE" },
  "2031": { symbol: "M&M", display: "Mahindra & Mahindra Ltd.", exchange: "NSE" },
  "16669": { symbol: "BAJAJ-AUTO", display: "Bajaj Auto Ltd.", exchange: "NSE" },
  "8479": { symbol: "TVSMOTOR", display: "TVS Motor Company Ltd.", exchange: "NSE" },
  "212": { symbol: "ASHOKLEY", display: "Ashok Leyland Ltd.", exchange: "NSE" },
  "3063": { symbol: "VEDL", display: "Vedanta Ltd.", exchange: "NSE" },
  "1363": { symbol: "HINDALCO", display: "Hindalco Industries Ltd.", exchange: "NSE" },
  "3499": { symbol: "TATASTEEL", display: "Tata Steel Ltd.", exchange: "NSE" },
  "1232": { symbol: "GRASIM", display: "Grasim Industries Ltd.", exchange: "NSE" },
  "1270": { symbol: "AMBUJACEM", display: "Ambuja Cements Ltd.", exchange: "NSE" },
  "3103": { symbol: "SHREECEM", display: "Shree Cement Ltd.", exchange: "NSE" },
  "772": { symbol: "DABUR", display: "Dabur India Ltd.", exchange: "NSE" },
  "547": { symbol: "BRITANNIA", display: "Britannia Industries Ltd.", exchange: "NSE" },
  "10099": { symbol: "GODREJCP", display: "Godrej Consumer Products Ltd.", exchange: "NSE" },
  "15141": { symbol: "COLPAL", display: "Colgate Palmolive (India) Ltd.", exchange: "NSE" },
  "2664": { symbol: "PIDILITIND", display: "Pidilite Industries Ltd.", exchange: "NSE" },
  "404": { symbol: "BERGEPAINT", display: "Berger Paints India Ltd.", exchange: "NSE" },
  
  // BSE Stocks
  "500463": { symbol: "BBOX", display: "Black Box Limited", exchange: "BSE" },
  
  // Tokens are periodically validated against Angel OpenAPI ScripMaster
};

// Helper function to find stock by symbol in BSE TOKEN_SYMBOL_MAP
export const findStockBySymbol = (symbol) => {
  const entry = Object.entries(TOKEN_SYMBOL_MAP).find(
    ([_, data]) => data.symbol === symbol
  );
  return entry ? { token: entry[0], ...entry[1] } : null;
};

// Helper function to find stock by token
export const findStockByToken = (token) => {
  const data = TOKEN_SYMBOL_MAP[token];
  return data ? { token, ...data } : null;
};

// Generate initial stocks data from NSE_TOKEN_MAP for live API
export const INITIAL_STOCKS_DATA = Object.entries(NSE_TOKEN_MAP)
  .filter(([_, data]) => data.symbol !== "NIFTY" && data.symbol !== "BANKNIFTY") // Exclude indices
  .map(([token, data]) => ({
    symbol: data.symbol,
    name: data.display,
    token: token,
    exchange: data.exchange,
    price: 0, // Will be updated with live data
    change: 0, // Will be updated with live data
  }));

console.log(`📊 Loaded ${INITIAL_STOCKS_DATA.length} NSE stocks for live API`);

// Symbol alias mapping (for compatibility with existing code)
export const SYMBOL_ALIAS_MAP = {
  "INFOSYS": "INFY",
  "HDFC BANK": "HDFCBANK",
  "L&T": "LT",
  "M&M": "M&M",
  "BAJAJ-AUTO": "BAJAJ-AUTO",
  "ICICI BANK": "ICICIBC",
};

// Helper function to normalize symbol for API matching
export const normalizeSymbol = (symbol) => {
  return SYMBOL_ALIAS_MAP[symbol] || symbol;
};

// Export all BSE stocks from TOKEN_SYMBOL_MAP as an array (for future use)
export const ALL_BSE_STOCKS = Object.entries(TOKEN_SYMBOL_MAP).map(([token, data]) => ({
  token,
  symbol: data.symbol,
  name: data.display,
  exchange: data.exchange,
  price: 0,
  change: 0,
}));

// Export all NSE stocks
export const ALL_NSE_STOCKS = Object.entries(NSE_TOKEN_MAP).map(([token, data]) => ({
  token,
  symbol: data.symbol,
  name: data.display,
  exchange: data.exchange,
  price: 0,
  change: 0,
}));

// Export the raw BSE TOKEN_SYMBOL_MAP for direct access (4886 BSE stocks)
export { TOKEN_SYMBOL_MAP as BSE_TOKEN_MAP };

// Export the NSE token map
export { NSE_TOKEN_MAP };
