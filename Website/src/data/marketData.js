// src/data/marketData.js

// Symbol alias mapping (maps display symbols to API symbols)
export const SYMBOL_ALIAS_MAP = {
  "INFOSYS": "INFY",
  "HDFC BANK": "HDFCBANK",
  "L&T": "LT",
  "M&M": "M&M",
  "BAJAJ-AUTO": "BAJAJ-AUTO",
};

// Helper function to normalize symbol for API matching
export const normalizeSymbol = (symbol) => {
  return SYMBOL_ALIAS_MAP[symbol] || symbol;
};

const INITIAL_STOCKS_DATA = [
    // Original 20 stocks
    { symbol: 'RELIANCE', name: 'Reliance Industries', price: 2800.50, change: 2.34, token: '2885' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', price: 3850.25, change: 1.56, token: '11536' },
    { symbol: 'HDFC BANK', name: 'HDFC Bank Ltd.', price: 1680.10, change: -0.78, token: '1333', apiSymbol: 'HDFCBANK' },
    { symbol: 'INFOSYS', name: 'Infosys Ltd.', price: 1550.90, change: 0.45, token: '1594', apiSymbol: 'INFY' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd.', price: 1050.70, change: 1.15, token: '4963' },
    { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', price: 1800.30, change: -1.22, token: '1922' },
    { symbol: 'L&T', name: 'Larsen & Toubro Ltd.', price: 3400.00, change: 3.10, token: '11483', apiSymbol: 'LT' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd.', price: 2450.60, change: -2.50, token: '1394' },
    { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd.', price: 3000.90, change: 0.95, token: '236' },
    { symbol: 'HCLTECH', name: 'HCL Technologies Ltd.', price: 1400.15, change: 0.05, token: '7229' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd.', price: 1200.00, change: 1.80, token: '10604' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki India', price: 11500.20, change: 0.90, token: '10999' },
    { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Ind.', price: 1550.00, change: -0.50, token: '3351' },
    { symbol: 'TITAN', name: 'Titan Company Ltd.', price: 3300.00, change: 2.05, token: '3506' },
    { symbol: 'AXISBANK', name: 'Axis Bank Ltd.', price: 1100.40, change: -1.05, token: '5900' },
    { symbol: 'NESTLEIND', name: 'Nestle India Ltd.', price: 25000.00, change: 0.15, token: '17963' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd.', price: 950.80, change: 3.50, token: '8840' },
    { symbol: 'WIPRO', name: 'Wipro Ltd.', price: 480.20, change: -1.95, token: '3787' },
    { symbol: 'POWERGRID', name: 'Power Grid Corp. of India', price: 300.75, change: 0.70, token: '14977' },
    { symbol: 'SBIN', name: 'State Bank of India', price: 850.55, change: 1.25, token: '3045' },
    
    // Additional companies (30 more)
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd.', price: 7500.00, change: 1.20, token: '317' },
    { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd.', price: 1800.00, change: 0.85, token: '16675' },
    { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd.', price: 9800.00, change: 2.10, token: '11532' },
    { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd.', price: 850.00, change: -0.50, token: '11723' },
    { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd.', price: 3200.00, change: 1.50, token: '25' },
    { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ', price: 1400.00, change: 0.75, token: '15083' },
    { symbol: 'ONGC', name: 'Oil & Natural Gas Corp.', price: 280.00, change: 1.25, token: '2475' },
    { symbol: 'COALINDIA', name: 'Coal India Ltd.', price: 450.00, change: 0.90, token: '20374' },
    { symbol: 'NTPC', name: 'NTPC Ltd.', price: 350.00, change: 0.60, token: '11630' },
    { symbol: 'ITC', name: 'ITC Ltd.', price: 450.00, change: -0.30, token: '1660' },
    { symbol: 'DIVISLAB', name: 'Divi\'s Laboratories', price: 5800.00, change: 1.40, token: '10940' },
    { symbol: 'CIPLA', name: 'Cipla Ltd.', price: 1400.00, change: 0.80, token: '694' },
    { symbol: 'LUPIN', name: 'Lupin Ltd.', price: 1200.00, change: -0.40, token: '10440' },
    { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd.', price: 3500.00, change: 1.10, token: '1348' },
    { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd.', price: 4200.00, change: 0.95, token: '910' },
    { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd.', price: 1800.00, change: 1.30, token: '2031' },
    { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd.', price: 6800.00, change: 0.70, token: '16669' },
    { symbol: 'TVSMOTOR', name: 'TVS Motor Company Ltd.', price: 1800.00, change: 1.00, token: '8479' },
    { symbol: 'ASHOKLEY', name: 'Ashok Leyland Ltd.', price: 180.00, change: 0.55, token: '212' },
    { symbol: 'VEDL', name: 'Vedanta Ltd.', price: 450.00, change: -0.80, token: '3063' },
    { symbol: 'HINDALCO', name: 'Hindalco Industries Ltd.', price: 650.00, change: 0.40, token: '1363' },
    { symbol: 'TATASTEEL', name: 'Tata Steel Ltd.', price: 180.00, change: -1.20, token: '3499' },
    { symbol: 'GRASIM', name: 'Grasim Industries Ltd.', price: 2600.00, change: 0.65, token: '1232' },
    { symbol: 'AMBUJACEM', name: 'Ambuja Cements Ltd.', price: 550.00, change: 0.50, token: '1270' },
    { symbol: 'SHREECEM', name: 'Shree Cement Ltd.', price: 28000.00, change: 1.15, token: '3103' },
    { symbol: 'DABUR', name: 'Dabur India Ltd.', price: 580.00, change: 0.35, token: '772' },
    { symbol: 'BRITANNIA', name: 'Britannia Industries Ltd.', price: 5200.00, change: 0.45, token: '547' },
    { symbol: 'GODREJCP', name: 'Godrej Consumer Products', price: 1200.00, change: 0.30, token: '10099' },
    { symbol: 'COLPAL', name: 'Colgate Palmolive India', price: 2800.00, change: 0.25, token: '15141' },
    { symbol: 'PIDILITIND', name: 'Pidilite Industries Ltd.', price: 2800.00, change: 0.90, token: '2664' },
    { symbol: 'BERGEPAINT', name: 'Berger Paints India Ltd.', price: 700.00, change: 0.60, token: '404' },
];

export { INITIAL_STOCKS_DATA };