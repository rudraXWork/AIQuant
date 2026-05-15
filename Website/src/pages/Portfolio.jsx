import React, { useMemo, useState, useEffect } from 'react';
import TradingModal from '../components/dashboard/TradingModal';
import useMarketSocket from '../hooks/useMarketSocket';
import { normalizeSymbol } from '../data/stocksData';
import { portfolioAPI, walletAPI } from '../api/client';

// Symbol to name mapping (for display purposes)
const SYMBOL_NAMES = {
    'RELIANCE': 'Reliance Industries Ltd.',
    'TCS': 'Tata Consultancy Services Ltd.',
    'ICICIBANK': 'ICICI Bank Ltd.',
    'INFOSYS': 'Infosys Ltd.',
    'INFY': 'Infosys Ltd.',
    'HDFCBANK': 'HDFC Bank Ltd.',
    'KOTAKBANK': 'Kotak Mahindra Bank Ltd.',
    'LT': 'Larsen & Toubro Ltd.',
    'HINDUNILVR': 'Hindustan Unilever Ltd.',
    'ASIANPAINT': 'Asian Paints Ltd.',
    'HCLTECH': 'HCL Technologies Ltd.',
    'BHARTIARTL': 'Bharti Airtel Ltd.',
    'MARUTI': 'Maruti Suzuki India Ltd.',
    'SUNPHARMA': 'Sun Pharmaceutical Industries Ltd.',
    'TITAN': 'Titan Company Ltd.',
    'AXISBANK': 'Axis Bank Ltd.',
    'SBIN': 'State Bank of India',
    'BAJFINANCE': 'Bajaj Finance Ltd.',
};

// Helper component for summary cards
const SummaryCard = ({ title, value, isPercent, isPositive }) => {
    const valueColor = isPositive === undefined ? 'text-white' : (isPositive ? 'text-emerald-400' : 'text-rose-400');
    const indicator = isPositive ? '▲' : (isPositive === false ? '▼' : '');
    const formattedValue = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: isPercent ? 2 : 2 }).format(value);

    return (
        <div className="bg-slate-900/70 p-6 rounded-xl shadow-xl border border-slate-800">
            <h3 className="text-sm font-medium text-slate-400 uppercase mb-2">{title}</h3>
            <div className={`text-3xl font-bold ${valueColor} flex items-center`}>
                {isPercent ? 
                    <span className="text-2xl">{indicator} {value.toFixed(2)}%</span> : 
                    <span>{formattedValue.replace('INR', '₹')}</span>
                }
            </div>
            {isPercent !== undefined && 
                <span className={`text-xs font-semibold ${valueColor}`}>{isPositive ? 'Profit' : 'Loss'}</span>
            }
        </div>
    );
};

const Portfolio = () => {
    // State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStock, setSelectedStock] = useState(null);
    const [showTradingModal, setShowTradingModal] = useState(false);
    const [holdings, setHoldings] = useState([]);
    const [intradayPositions, setIntradayPositions] = useState([]);
    const [wallet, setWallet] = useState({ intradayLeverage: 5 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Get live market data
    const livePrices = useMarketSocket();
    const [hasLiveData, setHasLiveData] = useState(false);
    
    // Fetch holdings from API
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [portfolioData, walletData] = await Promise.all([
                    portfolioAPI.getHoldings(),
                    walletAPI.getWallet()
                ]);

                setHoldings(portfolioData.holdings || []);
                setIntradayPositions(portfolioData.intradayPositions || []);
                setWallet(walletData || { intradayLeverage: 5 });
                setError(null);
            } catch (err) {
                console.error('Failed to fetch portfolio or wallet data:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // Refresh holdings after a trade
    const refreshData = async () => {
        try {
            const [portfolioData, walletData] = await Promise.all([
                portfolioAPI.getHoldings(),
                walletAPI.getWallet()
            ]);
            setHoldings(portfolioData.holdings || []);
            setIntradayPositions(portfolioData.intradayPositions || []);
            setWallet(walletData || { intradayLeverage: 5 });
        } catch (err) {
            console.error('Failed to refresh portfolio or wallet data:', err);
        }
    };
    
    // Track if we have live data
    useEffect(() => {
        const hasData = Object.keys(livePrices).length > 0;
        setHasLiveData(hasData);
        if (hasData) {
            console.log("📊 Portfolio received live prices:", livePrices);
        }
    }, [livePrices]);
    
    // Helper function to get live price for a symbol (handles aliases)
    // useMarketSocket already handles reverse aliases, so we just need to check both direct and normalized
    const getLivePrice = (symbol) => {
        // Try direct match first (e.g., INFOSYS or INFY)
        if (livePrices[symbol]) {
            return livePrices[symbol];
        }
        
        // Try normalized symbol (e.g., INFOSYS -> INFY)
        const normalized = normalizeSymbol(symbol);
        if (normalized !== symbol && livePrices[normalized]) {
            return livePrices[normalized];
        }
        
        return null;
    };
    
    // Calculate P&L for each holding with live prices
    const allHoldingsWithPL = useMemo(() => {
        return holdings.map(holding => {
            // Get display name for the symbol
            const name = SYMBOL_NAMES[holding.symbol] || holding.symbol;
            
            // Get live price, fallback to avgPrice if not available
            const livePrice = getLivePrice(holding.symbol);
            const currPrice = livePrice || holding.avgPrice;
            
            const invested = holding.qty * holding.avgPrice;
            const marketValue = holding.qty * currPrice;
            const pl = marketValue - invested;
            const plPercent = (pl / invested) * 100;

            return {
                ...holding,
                name,
                currPrice,
                invested,
                marketValue,
                pl,
                plPercent,
                isPositive: pl >= 0,
                hasLiveData: livePrice !== null
            };
        });
    }, [holdings, livePrices]);
    
    // Calculate portfolio summary from live data
    const portfolioSummary = useMemo(() => {
        const totalInvested = allHoldingsWithPL.reduce((sum, h) => sum + h.invested, 0);
        const totalMarketValue = allHoldingsWithPL.reduce((sum, h) => sum + h.marketValue, 0);
        const overallPL = totalMarketValue - totalInvested;
        const overallPLPercent = totalInvested > 0 ? (overallPL / totalInvested) * 100 : 0;
        
        return {
            totalValue: totalMarketValue,
            investedValue: totalInvested,
            overallProfitLoss: overallPL,
            overallPLPercent: overallPLPercent,
        };
    }, [allHoldingsWithPL]);

    // NEW: Filtered holdings based on search term
    const filteredHoldings = useMemo(() => {
        if (!searchTerm) return allHoldingsWithPL;

        const lowerCaseSearch = searchTerm.toLowerCase();
        return allHoldingsWithPL.filter(holding => 
            holding.symbol.toLowerCase().includes(lowerCaseSearch) ||
            holding.name.toLowerCase().includes(lowerCaseSearch)
        );
    }, [searchTerm, allHoldingsWithPL]);


    const formatCurrency = (value) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2 }).format(value);
    const intradayRows = useMemo(() => {
        const leverage = wallet.intradayLeverage || 5;
        return intradayPositions.map((position) => {
            const livePrice = getLivePrice(position.symbol);
            const currentPrice = livePrice || position.avgPrice;
            const positionValue = currentPrice * position.netQty;
            const marginUsed = positionValue / leverage;
            const mtm = (currentPrice - position.avgPrice) * position.netQty;
            
            return {
                ...position,
                currentPrice,
                positionValue,
                marginUsed,
                leverage,
                mtm,
                hasLiveData: livePrice !== null,
            };
        });
    }, [intradayPositions, livePrices, wallet.intradayLeverage]);

    const handleStockClick = (holding) => {
        // Convert holding to stock format for the modal
        const stock = {
            symbol: holding.symbol,
            name: holding.name,
            price: holding.currPrice,
            change: 0, // Not needed for portfolio
            isGainer: true // Not needed for portfolio
        };
        setSelectedStock(stock);
        setShowTradingModal(true);
    };

    const handleCloseModal = () => {
        setShowTradingModal(false);
        setSelectedStock(null);
        // Refresh holdings after modal closes
        refreshData();
    };

    // Loading state
    if (loading) {
        return (
            <div className="container mx-auto p-4 sm:p-8 min-h-screen">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
                        <p className="text-slate-400">Loading portfolio...</p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="container mx-auto p-4 sm:p-8 min-h-screen">
                <div className="bg-red-900/50 border border-red-500 text-red-300 px-6 py-4 rounded-lg">
                    <p className="font-semibold">Error loading portfolio</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-8 min-h-screen">
            <h1 className="text-3xl font-bold text-white mb-8">My Trading Portfolio</h1>
            
            {/* Connection Status */}
            <div className="mb-4 flex items-center gap-4">
                <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${hasLiveData ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                    <span className={`w-2 h-2 rounded-full ${hasLiveData ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></span>
                    <span className="text-sm font-medium">
                        {hasLiveData ? '🟢 Live Data Active' : '🟡 Waiting for data...'}
                    </span>
                </div>
                {!hasLiveData && (
                    <span className="text-xs text-gray-400">
                        Make sure server is running: npm run server
                    </span>
                )}
            </div>

            {/* --- 1. Summary Cards --- */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <SummaryCard 
                    title="Total Market Value" 
                    value={portfolioSummary.totalValue} 
                    isPositive={undefined}
                />
                <SummaryCard 
                    title="Total Invested" 
                    value={portfolioSummary.investedValue} 
                    isPositive={undefined}
                />
                <SummaryCard 
                    title="Overall P&L" 
                    value={portfolioSummary.overallProfitLoss} 
                    isPositive={portfolioSummary.overallProfitLoss >= 0}
                />
                <SummaryCard 
                    title="Overall P&L (%)" 
                    value={portfolioSummary.overallPLPercent} 
                    isPercent={true}
                    isPositive={portfolioSummary.overallPLPercent >= 0}
                />
            </div>

            {/* --- 2. Holdings Table --- */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl shadow-gray-950/50">
                <h2 className="text-2xl font-semibold text-white mb-4 border-b border-gray-700 pb-3">Holdings Detail</h2>
                
                {/* NEW: Search Input */}
                <div className="mb-6 relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Filter by Stock Symbol or Name..."
                        className="w-full p-3 pl-10 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 transition duration-200"
                    />
                    <svg className="absolute top-1/2 left-3 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                </div>


                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                            <tr className="text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Stock</th>
                                <th className="py-3 px-4 text-right">Qty</th>
                                <th className="py-3 px-4 text-right">Avg. Price (₹)</th>
                                <th className="py-3 px-4 text-right">LTP (₹)</th>
                                <th className="py-3 px-4 text-right">Invested (₹)</th>
                                <th className="py-3 px-4 text-right">Market Value (₹)</th>
                                <th className="py-3 px-4 text-right">P&L (₹)</th>
                                <th className="py-3 px-4 text-right">P&L (%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 text-sm text-gray-300">
                            {/* Updated to use filteredHoldings */}
                            {filteredHoldings.map((holding) => (
                                <tr key={holding.symbol} className="hover:bg-gray-700 transition-colors duration-150 cursor-pointer" onClick={() => handleStockClick(holding)}>
                                    <td className="py-3 px-4 font-bold text-white">
                                        {holding.symbol}
                                        <div className="text-xs font-normal text-gray-500">{holding.name}</div>
                                    </td>
                                    <td className="py-3 px-4 text-right">{holding.qty}</td>
                                    <td className="py-3 px-4 text-right">{formatCurrency(holding.avgPrice)}</td>
                                    <td className="py-3 px-4 text-right text-white font-semibold">
                                        {formatCurrency(holding.currPrice)}
                                        {holding.hasLiveData && (
                                            <span className="ml-2 text-xs text-green-400">● LIVE</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right text-gray-400">{formatCurrency(holding.invested)}</td>
                                    <td className="py-3 px-4 text-right text-white font-semibold">{formatCurrency(holding.marketValue)}</td>
                                    <td className={`py-3 px-4 text-right font-bold ${holding.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatCurrency(holding.pl)}
                                    </td>
                                    <td className={`py-3 px-4 text-right font-semibold ${holding.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                        {holding.plPercent.toFixed(2)}%
                                    </td>
                                </tr>
                            ))}
                            {filteredHoldings.length === 0 && holdings.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="py-6 text-center text-gray-500">
                                        No holdings yet. Start trading to build your portfolio!
                                    </td>
                                </tr>
                            )}
                            {filteredHoldings.length === 0 && holdings.length > 0 && (
                                <tr>
                                    <td colSpan="8" className="py-6 text-center text-gray-500">
                                        No holdings found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl shadow-gray-950/50 mt-8">
                <h2 className="text-2xl font-semibold text-white mb-4 border-b border-gray-700 pb-3">Intraday Positions</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                            <tr className="text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Stock</th>
                                <th className="py-3 px-4 text-right">Qty</th>
                                <th className="py-3 px-4 text-right">Avg Price (₹)</th>
                                <th className="py-3 px-4 text-right">LTP (₹)</th>
                                <th className="py-3 px-4 text-right">Position Value (₹)</th>
                                <th className="py-3 px-4 text-right">Margin Used (₹)</th>
                                <th className="py-3 px-4 text-right">Leverage</th>
                                <th className="py-3 px-4 text-right">MTM (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 text-sm text-gray-300">
                            {intradayRows.map((position) => (
                                <tr key={`${position.symbol}-intraday`} className="hover:bg-gray-700 transition-colors duration-150">
                                    <td className="py-3 px-4 font-bold text-white">{position.symbol}</td>
                                    <td className="py-3 px-4 text-right font-semibold text-indigo-300">{position.netQty}</td>
                                    <td className="py-3 px-4 text-right">{formatCurrency(position.avgPrice)}</td>
                                    <td className="py-3 px-4 text-right text-white font-semibold">
                                        {formatCurrency(position.currentPrice)}
                                        {position.hasLiveData && (
                                            <span className="ml-2 text-xs text-green-400">● LIVE</span>
                                        )}
                                    </td>
                                    <td className="py-3 px-4 text-right">{formatCurrency(position.positionValue)}</td>
                                    <td className="py-3 px-4 text-right">{formatCurrency(position.marginUsed)}</td>
                                    <td className="py-3 px-4 text-right">{position.leverage}x</td>
                                    <td className={`py-3 px-4 text-right font-bold ${position.mtm >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {formatCurrency(position.mtm)}
                                    </td>
                                </tr>
                            ))}
                            {intradayRows.length === 0 && (
                                <tr>
                                    <td colSpan="8" className="py-6 text-center text-gray-500">
                                        No open intraday positions.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Trading Modal */}
            {showTradingModal && (
                <TradingModal 
                    stock={selectedStock} 
                    onClose={handleCloseModal} 
                />
            )}
        </div>
    );
};

export default Portfolio;
