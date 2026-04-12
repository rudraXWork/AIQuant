import React, { useMemo, useState } from 'react';
import MetricCard from '../components/dashboard/MetricCard';
import MarketChart from '../components/dashboard/MarketChart';
import useMarketSocket from '../hooks/useMarketSocket';

const Overview = () => {
  const live = useMarketSocket("http://localhost:3000");
  const [hasData, setHasData] = useState(false);

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
      setHasData(true);
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
        <div className="lg:col-span-2 bg-gray-800 p-6 rounded-xl shadow-2xl min-h-[420px] flex flex-col">
          <h2 className="text-xl font-semibold text-white mb-4">Market Overview</h2>
          <MarketChart />
        </div>

        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-4">Top Stocks</h2>
          <ul className="divide-y divide-gray-700">
            {MOVERS_DATA.map((m, i) => (
              <li key={i} className="flex justify-between items-center py-3">
                <span className="text-gray-300 font-medium">{m.symbol}</span>
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
    </div>
  );
};

export default Overview;
