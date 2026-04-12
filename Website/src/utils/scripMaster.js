// Utility to load and process AngelOne Scrip Master data

const SCRIP_MASTER_URL = 'https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json';

// Cache for scrip master data
let scripMasterCache = null;
let isLoading = false;
let loadPromise = null;

/**
 * Fetch scrip master data from API
 * @returns {Promise<Array>} Array of scrip master records
 */
export async function fetchScripMasterData() {
  if (scripMasterCache) {
    return scripMasterCache;
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  isLoading = true;
  loadPromise = fetch(SCRIP_MASTER_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch scrip master: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      // Handle both array and object formats
      const records = Array.isArray(data) ? data : Object.values(data);
      scripMasterCache = records;
      isLoading = false;
      console.log(`✅ Loaded ${records.length} scrip master records`);
      return records;
    })
    .catch((error) => {
      isLoading = false;
      console.error('❌ Error fetching scrip master:', error);
      throw error;
    });

  return loadPromise;
}

/**
 * Filter scrip master data for NSE equity stocks
 * @param {Array} data - Scrip master data
 * @returns {Array} Filtered NSE equity stocks
 */
export function filterNSEEquity(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter(
    (item) => {
      // Check if it's NSE equity
      const isNSE = item.exchange === 'NSE' || item.exchangetoken?.startsWith('NSE');
      const isEquity = item.instrumenttype === 'EQ' || item.instrumenttype === 'EQUITY';
      const hasToken = item.symboltoken || item.token;
      const hasSymbol = item.tradingsymbol || item.symbol;
      
      return isNSE && isEquity && hasToken && hasSymbol;
    }
  );
}

/**
 * Transform scrip master record to stock format
 * @param {Object} record - Scrip master record
 * @returns {Object} Stock object
 */
export function transformToStock(record) {
  return {
    symbol: (record.tradingsymbol || record.symbol || '').trim(),
    name: (record.name || record.description || record.tradingsymbol || '').trim(),
    token: String(record.symboltoken || record.token || '').trim(),
    exchange: record.exchange || 'NSE',
    instrumenttype: record.instrumenttype || 'EQ',
    // Initial price will be updated by live data
    price: 0,
    change: 0,
  };
}

/**
 * Get all NSE equity stocks from scrip master
 * @returns {Promise<Array>} Array of stock objects
 */
export async function getAllNSEStocks() {
  try {
    const data = await fetchScripMasterData();
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.warn('⚠️ No data received from scrip master API');
      return [];
    }
    
    const nseStocks = filterNSEEquity(data);
    
    if (nseStocks.length === 0) {
      console.warn('⚠️ No NSE equity stocks found after filtering');
      console.log('Sample data:', data.slice(0, 3));
    }
    
    const transformed = nseStocks.map(transformToStock).filter(s => s.symbol && s.token);
    
    console.log(`📊 Filtered ${transformed.length} NSE equity stocks from ${data.length} total records`);
    
    return transformed;
  } catch (error) {
    console.error('❌ Error loading NSE stocks:', error);
    console.error('Error details:', error.message);
    return [];
  }
}

/**
 * Search stocks by symbol or name
 * @param {Array} stocks - Array of stock objects
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum number of results
 * @returns {Array} Filtered stocks
 */
export function searchStocks(stocks, searchTerm, limit = 50) {
  if (!searchTerm || !stocks || stocks.length === 0) {
    return [];
  }

  const lowerSearch = searchTerm.toLowerCase().trim();

  return stocks
    .filter((stock) => {
      const symbolMatch = stock.symbol?.toLowerCase().includes(lowerSearch);
      const nameMatch = stock.name?.toLowerCase().includes(lowerSearch);
      return symbolMatch || nameMatch;
    })
    .slice(0, limit);
}

/**
 * Get stock by symbol
 * @param {Array} stocks - Array of stock objects
 * @param {string} symbol - Stock symbol
 * @returns {Object|null} Stock object or null
 */
export function getStockBySymbol(stocks, symbol) {
  if (!stocks || !symbol) return null;
  return stocks.find((s) => s.symbol === symbol || s.symbol === symbol.toUpperCase());
}

/**
 * Get stock by token
 * @param {Array} stocks - Array of stock objects
 * @param {string} token - Stock token
 * @returns {Object|null} Stock object or null
 */
export function getStockByToken(stocks, token) {
  if (!stocks || !token) return null;
  return stocks.find((s) => String(s.token) === String(token));
}

