// markets.jsx

// src/components/dashboard/MarketChart.jsx  (or wherever your Markets component lives)
import React, { useState, useMemo, useEffect, useRef } from 'react';
import TopStocksList from '../components/dashboard/TopStocksList';
import TradingModal from '../components/dashboard/TradingModal';
// Import data from the new tokenSymbolMap-based file
import { INITIAL_STOCKS_DATA, SYMBOL_ALIAS_MAP, normalizeSymbol } from '../data/stocksData'; 
import { io } from "socket.io-client";

/* ---------- helper funcs (same as you had) ---------- */
const processStockData = (stock) => ({
    ...stock,
    isGainer: stock.change >= 0,
});

/* ---------- original simulation kept as fallback ---------- */
const simulateLiveFetch = (currentStocks) => {
    return currentStocks.map(stock => {
        const volatility = (Math.random() - 0.5) * 10; // Random movement
        const newPrice = stock.price + volatility;

        const initialPrice = INITIAL_STOCKS_DATA.find(s => s.symbol === stock.symbol)?.price || stock.price;
        const newChange = ((newPrice - initialPrice) / initialPrice) * 100;

        return processStockData({
            ...stock,
            price: newPrice,
            change: newChange,
        });
    });
};

/* ---------- MARKETS COMPONENT (live via socket.io) ---------- */
const Markets = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStock, setSelectedStock] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // start with initial static dataset (processed)
    const [liveStocks, setLiveStocks] = useState(
        INITIAL_STOCKS_DATA.map(processStockData)
    );

    // keep a map for quick lookup by symbol
    const stocksMapRef = useRef({});
    useEffect(() => {
      // initialize map from initial data
      const m = {};
      INITIAL_STOCKS_DATA.forEach(s => {
        m[s.symbol] = processStockData({
          ...s,
          price: s.price || 0,
          change: s.change || 0,
        });
      });
      stocksMapRef.current = m;
      console.log(`📊 Initialized stocks map with ${Object.keys(m).length} stocks`);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // run once on mount

    // ---------- SOCKET SETUP ----------
    const socketRef = useRef(null);
    useEffect(() => {
        // change URL if your backend runs elsewhere
        const SOCKET_URL = "http://localhost:3000";
        socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

        socketRef.current.on("connect", () => {
            console.log("✅ Connected to backend socket:", socketRef.current.id);
        });

        // IMPORTANT: inspect payload shape once and adapt mapping below if needed
        socketRef.current.on("market-tick", (payload) => {
            // Example payload shapes handled:
            // 1) { NSE: [ { symbol: 'RELIANCE', lastTradedPrice: '2340.5', ... }, ... ] }
            // 2) { NSE: [ { symbolToken: '3045', lastTradedPrice: '2340.5', tradingsymbol: 'SBIN' } ] }
            // 3) your server may forward raw Angel messages — inspect console to be sure.
            try {
                // Debug: log payload to see what we're receiving
                console.log("📥 Markets received market-tick:", payload);

                // handle exchange arrays (NSE, BSE, etc)
                const updates = [];
                if (payload && typeof payload === "object") {
                    Object.keys(payload).forEach(exchangeKey => {
                        const arr = payload[exchangeKey];
                        if (Array.isArray(arr)) {
                            arr.forEach(item => {
                                // attempt to derive a symbol code we have in INITIAL_STOCKS_DATA
                                // priority: item.symbol -> item.tradingsymbol -> map by token if you keep mapping
                                const symbol = item.symbol || item.tradingsymbol || item.tradingSymbol || null;
                                const token = String(item.symbolToken || item.token || "");
                                const priceField = item.lastTradedPrice ?? item.ltp ?? item.lastPrice ?? item.price;
                                const price = priceField ? Number(priceField) : null;

                                if (symbol && price !== null && price > 0) {
                                    updates.push({ symbol, token, price, raw: item });
                                    console.log(`  ✓ Found update: ${symbol} = ₹${price}`);
                                } else if (token && price !== null && price > 0) {
                                    // optional: if you have a token->symbol map, translate token -> symbol here
                                    updates.push({ token, price, raw: item });
                                    console.log(`  ✓ Found update by token: ${token} = ₹${price}`);
                                }
                            });
                        }
                    });
                }

                if (updates.length > 0) {
                    // update stocksMapRef and liveStocks state
                    const map = { ...stocksMapRef.current };

                    updates.forEach(u => {
                        // Try to match by symbol (with alias handling)
                        let matchedStock = null;
                        let matchedSymbol = null;
                        
                        if (u.symbol) {
                            // First try direct match
                            matchedStock = INITIAL_STOCKS_DATA.find(s => s.symbol === u.symbol);
                            if (matchedStock) {
                                matchedSymbol = matchedStock.symbol;
                            } else {
                                // Try matching by API symbol (e.g., INFY -> INFOSYS)
                                matchedStock = INITIAL_STOCKS_DATA.find(s => s.apiSymbol === u.symbol || normalizeSymbol(s.symbol) === u.symbol);
                                if (matchedStock) {
                                    matchedSymbol = matchedStock.symbol;
                                } else {
                                    // Try reverse alias lookup (e.g., INFY -> INFOSYS)
                                    const reverseAlias = Object.entries(SYMBOL_ALIAS_MAP).find(([_, apiSym]) => apiSym === u.symbol);
                                    if (reverseAlias) {
                                        matchedStock = INITIAL_STOCKS_DATA.find(s => s.symbol === reverseAlias[0]);
                                        if (matchedStock) {
                                            matchedSymbol = matchedStock.symbol;
                                        }
                                    }
                                }
                            }
                        }
                        
                        // If symbol match failed, try token match
                        if (!matchedStock && u.token) {
                            matchedStock = INITIAL_STOCKS_DATA.find(s => s.token === u.token || s.symbolToken === u.token);
                            if (matchedStock) {
                                matchedSymbol = matchedStock.symbol;
                            }
                        }
                        
                        // Update the stock if we found a match
                        if (matchedStock && matchedSymbol && map[matchedSymbol]) {
                            const initialPrice = matchedStock.price || map[matchedSymbol].price || u.price;
                            const change = initialPrice > 0 ? ((u.price - initialPrice) / initialPrice) * 100 : 0;
                            map[matchedSymbol] = processStockData({
                                ...map[matchedSymbol],
                                price: u.price,
                                change,
                            });
                            console.log(`  ✅ Updated ${matchedSymbol}: ₹${u.price.toFixed(2)} (${change.toFixed(2)}%)`);
                        } else if (u.symbol) {
                            console.log(`  ⚠️ No match found for symbol: ${u.symbol}`);
                        }
                    });

                    // Convert map to array - preserve all stocks, update only those with live data
                    // Use INITIAL_STOCKS_DATA order to maintain consistency
                    const newLiveStocks = INITIAL_STOCKS_DATA.map(initialStock => {
                        const symbol = initialStock.symbol;
                        // If we have updated data in map, use it; otherwise use initial stock
                        if (map[symbol]) {
                            return map[symbol];
                        }
                        // Return initial stock with processed data
                        return processStockData({
                            ...initialStock,
                            price: initialStock.price || 0,
                            change: initialStock.change || 0,
                        });
                    });
                    
                    stocksMapRef.current = map;
                    setLiveStocks(newLiveStocks);
                    console.log(`📊 Updated liveStocks: ${newLiveStocks.length} stocks`);
                }
            } catch (e) {
                console.error("Error handling market-tick:", e);
            }
        });

        socketRef.current.on("disconnect", () => {
            console.warn("🔴 Socket disconnected");
        });

        // cleanup on unmount
        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []); // run once on mount

    // ---------- FALLBACK POLLING if socket not connected (keeps UI live during dev) ----------
    useEffect(() => {
        let interval = null;
        const startFallback = () => {
            interval = setInterval(() => {
                // do lightweight simulated update so things don't look static
                setLiveStocks(prev => simulateLiveFetch(prev));
            }, 10000); // every 10s, same as original
        };

        // start fallback only if socket not connected after 1s
        const t = setTimeout(() => {
            if (!socketRef.current || !socketRef.current.connected) {
                startFallback();
            }
        }, 1000);

        return () => {
            clearTimeout(t);
            if (interval) clearInterval(interval);
        };
    }, []);

    // ---------- rest of your original logic (search, sorting, modal) ----------

    // Filter stocks based on search term (uses liveStocks data)
    const filteredStocks = useMemo(() => {
        if (!searchTerm) return [];
        const lowerCaseSearch = searchTerm.toLowerCase();
        return liveStocks.filter(stock => 
            stock.symbol.toLowerCase().includes(lowerCaseSearch) ||
            stock.name.toLowerCase().includes(lowerCaseSearch)
        ).slice(0, 10); 
    }, [searchTerm, liveStocks]);

    const sortedStocks = useMemo(() => 
        [...liveStocks].sort((a, b) => b.change - a.change), 
        [liveStocks]
    );

    const TOP_GAINERS = sortedStocks.slice(0, 5);
    const TOP_LOSERS = sortedStocks.slice(-5).reverse(); 

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleStockClick = (stock) => {
        setSelectedStock(stock);
    };

    const handleCloseModal = () => {
        setSelectedStock(null);
    };

    return (
        <div className="container mx-auto p-4 sm:p-8 min-h-screen">
            <h1 className="text-3xl font-bold text-white mb-6">Market Explorer </h1>

            {/* Loading indicator: show if socket not connected but fallback running */}
            {isLoading && (
                <p className="text-indigo-400 mb-4">Fetching live market data... (Updating automatically)</p>
            )}

            {/* --- 1. Search Bar --- */}
            <div className="mb-8 p-6 bg-gray-800 rounded-xl shadow-2xl shadow-gray-950/50">
                <label htmlFor="stock-search" className="block text-gray-300 text-lg font-medium mb-2">
                    Search Stocks by Symbol or Name
                </label>
                <div className="relative">
                    <input
                        type="text"
                        id="stock-search"
                        value={searchTerm}
                        onChange={handleSearchChange}
                        placeholder="e.g., RELIANCE, TCS, or Bank"
                        className="w-full p-3 pl-10 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 transition duration-200"
                    />
                    <svg className="absolute top-1/2 left-3 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                </div>
            </div>

            {/* --- 2. Search Results Display --- */}
            {searchTerm && filteredStocks.length > 0 && (
                <div className="mb-8 p-6 bg-gray-800 rounded-xl shadow-2xl shadow-gray-950/50">
                    <h2 className="text-xl font-semibold text-white mb-4 border-b border-gray-700 pb-2">
                        Search Results ({filteredStocks.length})
                    </h2>
                    <ul className="divide-y divide-gray-700 max-h-96 overflow-y-auto">
                        {filteredStocks.map((stock) => (
                            <li 
                                key={stock.symbol} 
                                className="flex justify-between items-center py-3 hover:bg-gray-700/50 rounded-lg px-2 transition-colors duration-200 cursor-pointer"
                                onClick={() => handleStockClick(stock)}
                            >
                                <div>
                                    <span className="text-white font-medium block">{stock.symbol}</span>
                                    <span className="text-gray-400 text-sm">{stock.name}</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-white font-bold block">₹{stock.price.toFixed(2)}</span>
                                    <span className={`text-xs font-semibold ${stock.isGainer ? 'text-green-500' : 'text-red-500'}`}>
                                        {stock.isGainer ? '▲' : '▼'} {Math.abs(stock.change).toFixed(2)}%
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* --- 3. Top Gainers & Top Losers --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TopStocksList title="🔥 Top Gainers (Live)" stocks={TOP_GAINERS} onStockClick={handleStockClick} />
                <TopStocksList title="🥶 Top Losers (Live)" stocks={TOP_LOSERS} onStockClick={handleStockClick} />
            </div>

            {/* Trading Modal */}
            {selectedStock && (
                <TradingModal 
                    stock={selectedStock} 
                    onClose={handleCloseModal} 
                />
            )}
        </div>
    );
};

export default Markets;

