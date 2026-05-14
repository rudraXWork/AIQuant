import React, { useMemo } from 'react';
import MetricCard from '../components/dashboard/MetricCard';
import MarketChart from '../components/dashboard/MarketChart';
import useMarketSocket from '../hooks/useMarketSocket';

const Overview = () => {
  const live = useMarketSocket("http://localhost:3000");

  // Mapping of dashboard symbols to AngelOne tradingsymbols
  const METRICS_MAP = {
    "NIFTY 50": "NIFTY",
    "BANK NIFTY": "BANKNIFTY",
    "RELIANCE": "RELIANCE",
    "HDFC BANK": "HDFCBANK"
  };

  const METRICS_DATA = useMemo(() => {
    // Debug: log what we're receiving
    const hasLiveData = Object.keys(live).length > 0;
    if (hasLiveData) {
      console.log("📊 Overview received live data:", live);
    }
    
    return Object.entries(METRICS_MAP).map(([title, symbol]) => {
      const price = live[symbol];
      return {
        title,
        value: price ? price.toFixed(2) : '--',
        change: price ? 'LIVE' : '',
        isUp: true,
      };
    });
  }, [live]);

  // Calculate top movers from live data
  const MOVERS_DATA = useMemo(() => {
    const stocksWithPrices = [
      { symbol: 'RELIANCE', price: live['RELIANCE'] },
      { symbol: 'TCS', price: live['TCS'] },
      { symbol: 'HDFCBANK', price: live['HDFCBANK'] },
      { symbol: 'INFY', price: live['INFY'] },
      { symbol: 'ICICIBANK', price: live['ICICIBANK'] },
      { symbol: 'KOTAKBANK', price: live['KOTAKBANK'] },
    ].filter(s => s.price); // Only include stocks with live prices

    // If we have live data, show it; otherwise show placeholder
    if (stocksWithPrices.length > 0) {
      return stocksWithPrices.slice(0, 4).map(s => ({
        symbol: s.symbol,
        price: s.price,
        change: 'LIVE',
        isUp: true,
      }));
    }
    
    // Fallback placeholder
    return [
      { symbol: 'RELIANCE', change: 'Loading...', isUp: true },
      { symbol: 'TCS', change: 'Loading...', isUp: true },
      { symbol: 'HDFCBANK', change: 'Loading...', isUp: true },
      { symbol: 'INFY', change: 'Loading...', isUp: true },
    ];
  }, [live]);

  return (
    <div className="container mx-auto p-4 sm:p-8 min-h-screen">
      {/* Metrics Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {METRICS_DATA.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Chart + Movers Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2 bg-slate-900/70 p-6 rounded-xl shadow-2xl min-h-[420px] flex flex-col border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4">Market Overview</h2>
          <MarketChart />
        </div>

        <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4">Top Stocks</h2>
          <ul className="divide-y divide-slate-800">
            {MOVERS_DATA.map((m, i) => (
              <li key={i} className="flex justify-between items-center py-3">
                <span className="text-slate-300 font-medium">{m.symbol}</span>
                <div className="text-right">
                  {m.price && (
                    <div className="text-white font-semibold">₹{m.price.toFixed(2)}</div>
                  )}
                  <span className={`text-xs font-semibold ${m.isUp ? 'text-green-500' : 'text-gray-500'}`}>
                    {m.change}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sector Heatmap Section */}
      <div className="grid grid-cols-1 gap-6 mb-8">
        <div className="bg-slate-900/70 p-6 rounded-xl shadow-2xl border border-slate-800">
          <h2 className="text-xl font-semibold text-white mb-4">Sector Heatmap</h2>
          <div className="grid grid-cols-3 gap-2">
            {useMemo(() => {
              // Sector to stocks mapping
              const sectorStocks = {
                IT: ['TCS', 'INFY', 'WIPRO'],
                Banking: ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK'],
                FMCG: ['HUL', 'ITC', 'NESTLEIND'],
                Pharma: ['SUNPHARMA', 'CIPLA', 'DRREDDY'],
                Metal: ['TATA STEEL', 'HINDALCO', 'JSW STEEL'],
                Auto: ['MARUTI', 'TATAMOTORS', 'BAJAJ-AUTO'],
                Energy: ['RELIANCE', 'NTPC', 'POWERGRID'],
                Realty: ['DLF', 'PRESTIGE', 'OBEROI'],
                Media: ['ZEEL', 'INDIAMARTINT', 'NETWORK18'],
              };

              // Calculate sector performance from live data
              return Object.entries(sectorStocks).map(([sector, stocks]) => {
                const availablePrices = stocks
                  .map(stock => live[stock])
                  .filter(price => price !== undefined);

                // Mock change calculation based on available data
                let change = 0;
                if (availablePrices.length > 0) {
                  // Use a pseudo-random but deterministic calculation based on prices
                  const avgPrice = availablePrices.reduce((a, b) => a + b, 0) / availablePrices.length;
                  change = parseFloat(((Math.sin(avgPrice) * 3)).toFixed(1));
                } else {
                  // Fallback to mock data if no live prices
                  const mockChanges = {
                    IT: 2.1,
                    Banking: 1.3,
                    FMCG: 0.4,
                    Pharma: -0.7,
                    Metal: -1.4,
                    Auto: 0.0,
                    Energy: 0.9,
                    Realty: 0.2,
                    Media: -0.5,
                  };
                  change = mockChanges[sector] || 0;
                }

                let bgColor = 'bg-slate-700';
                if (change > 0) {
                  bgColor = change > 1.5 ? 'bg-green-900' : change > 0.5 ? 'bg-green-800' : 'bg-green-700';
                } else if (change < 0) {
                  bgColor = change < -1 ? 'bg-red-900' : change < -0.3 ? 'bg-red-800' : 'bg-red-700';
                }

                return (
                  <div key={sector} className={`${bgColor} p-3 rounded-lg text-center`}>
                    <p className="text-xs font-semibold text-white">{sector}</p>
                    <p className={`text-sm font-bold ${change > 0 ? 'text-green-300' : change < 0 ? 'text-red-300' : 'text-slate-300'}`}>
                      {change > 0 ? '+' : ''}{change}%
                    </p>
                  </div>
                );
              });
            }, [live])}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;
