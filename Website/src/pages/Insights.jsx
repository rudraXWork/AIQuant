import React, { useEffect, useMemo, useState } from "react";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { apiFetch, marketDataAPI, ordersAPI, walletAPI } from "../api/client";
import useMarketSocket from "../hooks/useMarketSocket";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const INDICES = ["NIFTY", "BANKNIFTY"];

const fmtInr = (value) => `₹${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const toNum = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const positiveClass = (v) => (toNum(v) >= 0 ? "text-emerald-400" : "text-red-400");

function SummaryCard({ label, value, hint, valueClass = "text-white" }) {
  return (
    <div className="rounded-xl border border-gray-700/70 bg-gray-900/70 p-4 shadow-lg">
      <p className="text-xs uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${valueClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function SectionCard({ title, action, children }) {
  return (
    <div className="rounded-2xl border border-gray-700/70 bg-gray-900/70 p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="h-24 animate-pulse rounded-xl bg-gray-800/70" />
      ))}
    </div>
  );
}

export default function Insights() {
  const live = useMarketSocket("http://localhost:3000");
  const [mlData, setMlData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [wallet, setWallet] = useState({ balance: 0, reserved: 0, available: 0 });
  const [error, setError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [intradayCandles, setIntradayCandles] = useState([]);
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [intradayError, setIntradayError] = useState("");
  const [quickTrade, setQuickTrade] = useState({
    symbol: "",
    qty: 1,
    side: "BUY",
    orderType: "MARKET",
    triggerPrice: "",
  });
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMessage, setTradeMessage] = useState("");
  const [tradeError, setTradeError] = useState("");

  const fetchInsights = async () => {
    try {
      const [insightsRes, analysisRes, walletRes] = await Promise.all([
        apiFetch("/api/ml/insights"),
        apiFetch("/api/ml/analysis"),
        walletAPI.getWallet(),
      ]);
      setMlData(insightsRes);
      setAnalysis(analysisRes?.analysis ? analysisRes.analysis : analysisRes);
      setWallet(walletRes.wallet || { balance: 0, reserved: 0, available: 0 });
      setError(null);
    } catch (err) {
      setError(err?.message || "Failed to load insights");
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  useEffect(() => {
    const first = mlData?.holdings?.[0]?.symbol || "";
    if (!selectedSymbol && first) {
      setSelectedSymbol(first);
      setQuickTrade((prev) => ({ ...prev, symbol: first }));
    }
  }, [mlData, selectedSymbol]);

  useEffect(() => {
    if (!selectedSymbol) {
      setIntradayCandles([]);
      setIntradayError("");
      return;
    }
    const fetchIntradayCandles = async () => {
      setIntradayLoading(true);
      setIntradayError("");
      try {
        const data = await marketDataAPI.getIntradayCandles(selectedSymbol, "FIVE_MINUTE", 300);
        setIntradayCandles(data?.candles || []);
      } catch (err) {
        setIntradayCandles([]);
        setIntradayError(err?.message || "Unable to load SmartAPI candle data.");
      } finally {
        setIntradayLoading(false);
      }
    };
    fetchIntradayCandles();
  }, [selectedSymbol]);

  const holdings = mlData?.holdings || [];

  const summary = useMemo(() => {
    const totalPortfolioValue = toNum(mlData?.summary?.totalHoldingValue, 0);
    const totalPnl = toNum(mlData?.summary?.totalUnrealizedPnl, 0);
    const todayPnl = holdings.reduce((sum, h) => {
      const ltp = toNum(live[h.symbol], toNum(h.ltp));
      return sum + (ltp - toNum(h.ltp, ltp)) * toNum(h.qty);
    }, 0);
    const winRate = toNum(analysis?.win_rate, 0);
    return { totalPortfolioValue, totalPnl, todayPnl, winRate };
  }, [mlData, holdings, analysis, live]);

  const marketOverview = useMemo(() => {
    const indexData = INDICES.map((sym) => ({ symbol: sym, value: toNum(live[sym], 0) })).filter((i) => i.value > 0);
    const movers = holdings
      .map((h) => {
        const ltp = toNum(live[h.symbol], toNum(h.ltp));
        const dayChangePct = toNum(h.ltp, 0) > 0 ? ((ltp - toNum(h.ltp)) / toNum(h.ltp)) * 100 : 0;
        return { symbol: h.symbol, dayChangePct, ltp };
      })
      .sort((a, b) => b.dayChangePct - a.dayChangePct);
    const gainers = movers.filter((m) => m.dayChangePct > 0).slice(0, 2);
    const losers = [...movers].filter((m) => m.dayChangePct < 0).sort((a, b) => a.dayChangePct - b.dayChangePct).slice(0, 2);
    return {
      indices: indexData,
      gainers,
      losers,
    };
  }, [holdings, live]);

  const actionableInsights = useMemo(() => {
    const items = mlData?.model_actionable_insights || mlData?.trading_insights?.recommendations || [];
    return items.map((r) => ({
      title: r.title,
      text: r.description || r.text || "",
    }));
  }, [mlData]);

  const expectedMoveAndRisk = useMemo(() => mlData?.expected_move_and_risk || [], [mlData]);
  const smartAlerts = useMemo(() => {
    const alerts = mlData?.model_alerts || [];
    if (alerts.length) {
      return alerts.map((a) => ({
        symbol: a.symbol,
        message: a.message,
        tone: String(a.message || "").toLowerCase().includes("high") ? "red" : "amber",
      }));
    }
    return [{ symbol: "Model", message: "No critical model alerts right now", tone: "gray" }];
  }, [mlData]);

  const sectorHeatmapData = useMemo(() => {
    const sectors = mlData?.trading_insights?.sector_performance?.data || [];
    return {
      labels: sectors.map((s) => s.sector),
      datasets: [
        {
          label: "Sector Avg P&L",
          data: sectors.map((s) => toNum(s.avg_pnl)),
          backgroundColor: sectors.map((s) => (toNum(s.avg_pnl) >= 0 ? "rgba(34,197,94,0.6)" : "rgba(239,68,68,0.6)")),
          borderRadius: 6,
        },
      ],
    };
  }, [mlData]);

  const sectorPieData = useMemo(() => {
    const bySector = {};
    holdings.forEach((h) => {
      const sector = h.sector || "Others";
      const livePrice = toNum(live[h.symbol], toNum(h.ltp, toNum(h.avg_price)));
      const holdingValue = livePrice * toNum(h.qty);
      bySector[sector] = (bySector[sector] || 0) + holdingValue;
    });
    const labels = Object.keys(bySector);
    const values = labels.map((k) => bySector[k]);
    const palette = [
      "#22c55e",
      "#38bdf8",
      "#a78bfa",
      "#f59e0b",
      "#ef4444",
      "#14b8a6",
      "#f472b6",
      "#84cc16",
      "#60a5fa",
      "#f97316",
    ];
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, idx) => palette[idx % palette.length]),
          borderColor: "#111827",
          borderWidth: 1,
        },
      ],
    };
  }, [holdings, live]);

  const intradaySignals = useMemo(() => {
    if (!intradayCandles.length) {
      return null;
    }

    const closes = intradayCandles.map((c) => toNum(c.close)).filter((v) => v > 0);
    const highs = intradayCandles.map((c) => toNum(c.high)).filter((v) => v > 0);
    const lows = intradayCandles.map((c) => toNum(c.low)).filter((v) => v > 0);
    const vols = intradayCandles.map((c) => toNum(c.volume)).filter((v) => v >= 0);

    const candleCount = intradayCandles.length;
    if (candleCount < 6) {
      return { insufficient: true, candleCount };
    }

    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const lookback = Math.min(20, candleCount);
    const recentCloses = closes.slice(-lookback);
    const recentHighs = highs.slice(-lookback);
    const recentLows = lows.slice(-lookback);
    const prevHighWindow = highs.slice(-(lookback + 1), -1);
    const prevLowWindow = lows.slice(-(lookback + 1), -1);
    const prevRecentHigh = prevHighWindow.length ? Math.max(...prevHighWindow) : Math.max(...recentHighs);
    const prevRecentLow = prevLowWindow.length ? Math.min(...prevLowWindow) : Math.min(...recentLows);

    const avgClose = recentCloses.reduce((s, v) => s + v, 0) / recentCloses.length;
    const range = Math.max(...recentHighs) - Math.min(...recentLows);
    const volatilityPct = avgClose > 0 ? (range / avgClose) * 100 : 0;

    const shortPeriod = Math.min(9, candleCount);
    const longPeriod = Math.min(21, candleCount);
    const shortSma = closes.slice(-shortPeriod).reduce((s, v) => s + v, 0) / shortPeriod;
    const longSma = closes.slice(-longPeriod).reduce((s, v) => s + v, 0) / longPeriod;
    const trend = shortSma > longSma ? "Uptrend" : shortSma < longSma ? "Downtrend" : "Sideways";

    const recentVolWindow = vols.slice(-(Math.min(21, candleCount)), -1);
    const recentVolAvg = recentVolWindow.length
      ? recentVolWindow.reduce((s, v) => s + v, 0) / recentVolWindow.length
      : 0;
    const lastVol = vols[vols.length - 1];
    const volumeSpike = recentVolAvg > 0 ? lastVol > recentVolAvg * 1.8 : false;

    const breakoutUp = last > prevRecentHigh;
    const breakoutDown = last < prevRecentLow;
    const breakoutState = breakoutUp ? "Breakout Up" : breakoutDown ? "Breakdown" : "No breakout";

    const momentumLookback = Math.min(12, candleCount - 1);
    const momentumBase = closes[closes.length - 1 - momentumLookback];
    const momentum1hPct = momentumLookback > 0 && momentumBase > 0
      ? ((last - momentumBase) / momentumBase) * 100
      : 0;
    const signalQuality = candleCount >= 80 ? "High" : candleCount >= 30 ? "Medium" : "Low";

    return {
      trend,
      volatilityPct: toNum(volatilityPct),
      breakoutState,
      volumeSpike,
      support: Math.min(...recentLows),
      resistance: Math.max(...recentHighs),
      momentum1hPct,
      lastPrice: last,
      deltaPct: prev > 0 ? ((last - prev) / prev) * 100 : 0,
      candleCount,
      signalQuality,
    };
  }, [intradayCandles]);

  const placeQuickTrade = async () => {
    setTradeError("");
    setTradeMessage("");
    const qty = Number(quickTrade.qty);
    const symbol = String(quickTrade.symbol || "").trim().toUpperCase();
    const triggerPrice = Number(quickTrade.triggerPrice);
    const livePrice = toNum(live[symbol], toNum(holdings.find((h) => h.symbol === symbol)?.ltp, 0));

    if (!symbol || !Number.isInteger(qty) || qty <= 0) {
      setTradeError("Select symbol and valid quantity.");
      return;
    }
    if (quickTrade.orderType === "LIMIT" && (!Number.isFinite(triggerPrice) || triggerPrice <= 0)) {
      setTradeError("Enter a valid limit price.");
      return;
    }

    try {
      setTradeLoading(true);
      const result = await ordersAPI.placeOrder(
        symbol,
        quickTrade.side,
        qty,
        livePrice > 0 ? livePrice : 1,
        "DELIVERY",
        quickTrade.orderType,
        quickTrade.orderType === "LIMIT" ? triggerPrice : null
      );
      setTradeMessage(result?.message || "Order placed.");
      await fetchInsights();
    } catch (err) {
      setTradeError(err?.message || "Failed to place order");
    } finally {
      setTradeLoading(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto min-h-screen p-6">
        <div className="rounded-xl border border-red-700 bg-red-950/30 p-6 text-center">
          <p className="text-red-300">Failed to load insights: {error}</p>
          <button className="mt-4 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700" onClick={fetchInsights}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!mlData) {
    return (
      <div className="container mx-auto min-h-screen p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="container mx-auto min-h-screen p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Portfolio Insights</h1>
          <p className="text-sm text-gray-400">Decision-first dashboard powered by your existing model + live market data.</p>
        </div>
        <button
          onClick={fetchInsights}
          className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Portfolio Value" value={fmtInr(summary.totalPortfolioValue)} />
        <SummaryCard label="Today P&L" value={fmtInr(summary.todayPnl)} valueClass={positiveClass(summary.todayPnl)} />
        <SummaryCard label="Total Profit / Loss" value={fmtInr(summary.totalPnl)} valueClass={positiveClass(summary.totalPnl)} />
        <SummaryCard label="Available Cash" value={fmtInr(wallet.available)} hint={`Reserved ${fmtInr(wallet.reserved)}`} />
        <SummaryCard label="Win Rate" value={`${toNum(summary.winRate).toFixed(1)}%`} valueClass="text-cyan-300" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard
            title="Expected Move Range & Risk Score"
            action={
              <select
                value={selectedSymbol}
                onChange={(e) => {
                  setSelectedSymbol(e.target.value);
                  setQuickTrade((prev) => ({ ...prev, symbol: e.target.value }));
                }}
                className="rounded-md border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-200"
              >
                {holdings.map((h) => (
                  <option key={h.symbol} value={h.symbol}>
                    {h.symbol}
                  </option>
                ))}
              </select>
            }
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {expectedMoveAndRisk.map((row) => (
                <div key={row.symbol} className="rounded-lg border border-gray-700 bg-gray-800/70 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{row.symbol}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.risk_level === "High"
                          ? "bg-red-500/20 text-red-300"
                          : row.risk_level === "Medium"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {row.risk_level} Risk ({toNum(row.risk_score).toFixed(0)})
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">Expected move range</p>
                  <p className="text-sm font-semibold text-cyan-300">
                    {fmtInr(row.expected_lower)} to {fmtInr(row.expected_upper)}
                  </p>
                  <p className="mt-2 text-xs text-gray-400">{row.reason}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Quick Trade">
          <div className="space-y-3">
            <select
              value={quickTrade.symbol}
              onChange={(e) => setQuickTrade((p) => ({ ...p, symbol: e.target.value }))}
              className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-sm text-gray-200"
            >
              {holdings.map((h) => (
                <option key={h.symbol} value={h.symbol}>
                  {h.symbol}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="1"
                value={quickTrade.qty}
                onChange={(e) => setQuickTrade((p) => ({ ...p, qty: e.target.value }))}
                className="rounded-md border border-gray-700 bg-gray-800 p-2 text-sm text-gray-200"
                placeholder="Qty"
              />
              <select
                value={quickTrade.orderType}
                onChange={(e) => setQuickTrade((p) => ({ ...p, orderType: e.target.value }))}
                className="rounded-md border border-gray-700 bg-gray-800 p-2 text-sm text-gray-200"
              >
                <option value="MARKET">Market</option>
                <option value="LIMIT">Limit</option>
              </select>
            </div>
            {quickTrade.orderType === "LIMIT" ? (
              <input
                type="number"
                min="0"
                value={quickTrade.triggerPrice}
                onChange={(e) => setQuickTrade((p) => ({ ...p, triggerPrice: e.target.value }))}
                className="w-full rounded-md border border-gray-700 bg-gray-800 p-2 text-sm text-gray-200"
                placeholder="Limit price"
              />
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuickTrade((p) => ({ ...p, side: "BUY" }))}
                className={`rounded-md py-2 text-sm ${quickTrade.side === "BUY" ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-300"}`}
              >
                Buy
              </button>
              <button
                onClick={() => setQuickTrade((p) => ({ ...p, side: "SELL" }))}
                className={`rounded-md py-2 text-sm ${quickTrade.side === "SELL" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300"}`}
              >
                Sell
              </button>
            </div>
            <button
              onClick={placeQuickTrade}
              disabled={tradeLoading}
              className="w-full rounded-md bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-600"
            >
              {tradeLoading ? "Placing..." : `${quickTrade.side} ${quickTrade.symbol || "Stock"}`}
            </button>
            {tradeMessage ? <p className="text-xs text-emerald-400">{tradeMessage}</p> : null}
            {tradeError ? <p className="text-xs text-red-400">{tradeError}</p> : null}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <SectionCard title="Actionable Insights">
          <div className="space-y-3">
            {actionableInsights.map((ins, idx) => (
              <div key={`${ins.title}-${idx}`} className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-sm font-semibold text-white">{ins.title}</p>
                <p className="mt-1 text-xs text-gray-400">{ins.text}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Smart Alerts">
          <ul className="space-y-2">
            {smartAlerts.map((a, idx) => (
              <li key={`${a.symbol}-${idx}`} className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-sm text-white">{a.symbol}</p>
                <p
                  className={`text-xs ${
                    a.tone === "green" ? "text-emerald-400" : a.tone === "red" ? "text-red-400" : a.tone === "amber" ? "text-amber-400" : "text-gray-400"
                  }`}
                >
                  {a.message}
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Market Overview">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {marketOverview.indices.map((idx) => (
                <div key={idx.symbol} className="rounded-md border border-gray-700 bg-gray-800 p-2">
                  <p className="text-xs text-gray-400">{idx.symbol}</p>
                  <p className="text-sm font-semibold text-cyan-300">{idx.value.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Top Gainers</p>
              <div className="space-y-1">
                {marketOverview.gainers.length ? (
                  marketOverview.gainers.map((g) => (
                    <div key={g.symbol} className="flex justify-between text-xs">
                      <span className="text-gray-300">{g.symbol}</span>
                      <span className="text-emerald-400">{g.dayChangePct.toFixed(2)}%</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No gainers right now</p>
                )}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-gray-400">Top Losers</p>
              <div className="space-y-1">
                {marketOverview.losers.length ? (
                  marketOverview.losers.map((l) => (
                    <div key={l.symbol} className="flex justify-between text-xs">
                      <span className="text-gray-300">{l.symbol}</span>
                      <span className="text-red-400">{l.dayChangePct.toFixed(2)}%</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">No losers right now</p>
                )}
              </div>
            </div>
            <div className="h-40">
              {sectorHeatmapData.labels.length ? (
                <Bar
                  data={sectorHeatmapData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { ticks: { color: "#94a3b8" }, grid: { display: false } },
                      y: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } },
                    },
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-gray-500">No sector heatmap data yet.</div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Intraday Candle Signals (SmartAPI)">
          {intradayLoading ? (
            <p className="text-sm text-gray-400">Loading intraday candle signals...</p>
          ) : intradayError ? (
            <p className="text-sm text-red-400">{intradayError}</p>
          ) : !selectedSymbol ? (
            <p className="text-sm text-gray-400">Select a symbol to view intraday signals.</p>
          ) : !intradaySignals ? (
            <p className="text-sm text-gray-400">Market closed</p>
          ) : intradaySignals.insufficient ? (
            <p className="text-sm text-gray-400">
              Need at least 6 intraday candles. Currently received: {intradaySignals.candleCount || 0}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-xs text-gray-400">Trend</p>
                <p className="text-sm font-semibold text-white">{intradaySignals.trend}</p>
                <p className={`text-xs ${positiveClass(intradaySignals.momentum1hPct)}`}>
                  1h momentum: {toNum(intradaySignals.momentum1hPct).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-xs text-gray-400">Volatility</p>
                <p className="text-sm font-semibold text-white">{toNum(intradaySignals.volatilityPct).toFixed(2)}%</p>
                <p className="text-xs text-gray-400">
                  Last candle move: {toNum(intradaySignals.deltaPct).toFixed(2)}%
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-xs text-gray-400">Breakout Signal</p>
                <p className={`text-sm font-semibold ${
                  intradaySignals.breakoutState === "Breakout Up"
                    ? "text-emerald-400"
                    : intradaySignals.breakoutState === "Breakdown"
                      ? "text-red-400"
                      : "text-gray-200"
                }`}
                >
                  {intradaySignals.breakoutState}
                </p>
                <p className="text-xs text-gray-400">
                  {intradaySignals.volumeSpike ? "Volume spike detected" : "No major volume spike"}
                </p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-xs text-gray-400">Support</p>
                <p className="text-sm font-semibold text-cyan-300">{fmtInr(intradaySignals.support)}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-xs text-gray-400">Resistance</p>
                <p className="text-sm font-semibold text-cyan-300">{fmtInr(intradaySignals.resistance)}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/70 p-3">
                <p className="text-xs text-gray-400">Last Traded Price</p>
                <p className="text-sm font-semibold text-white">{fmtInr(intradaySignals.lastPrice)}</p>
                <p className="text-xs text-gray-400">
                  Candles used: {intradaySignals.candleCount} ({intradaySignals.signalQuality} confidence)
                </p>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Sector Live Portfolio Holdings">
          {sectorPieData.labels.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 h-72">
                <Pie
                  data={sectorPieData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: "right",
                        labels: {
                          color: "#cbd5e1",
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const val = toNum(ctx.raw);
                            return `${ctx.label}: ${fmtInr(val)}`;
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
              <div className="space-y-2">
                {sectorPieData.labels.map((sector, idx) => {
                  const value = toNum(sectorPieData.datasets[0].data[idx]);
                  const total = sectorPieData.datasets[0].data.reduce((s, v) => s + toNum(v), 0);
                  const pct = total > 0 ? (value / total) * 100 : 0;
                  return (
                    <div key={sector} className="rounded-md border border-gray-700 bg-gray-800/70 p-3">
                      <p className="text-sm font-semibold text-white">{sector}</p>
                      <p className="text-xs text-gray-300">{fmtInr(value)}</p>
                      <p className="text-xs text-cyan-300">{pct.toFixed(1)}% allocation</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No holdings yet to show sector allocation.</p>
          )}
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title="Holdings">
          {holdings.length === 0 ? (
            <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-400">
              No holdings yet. Place a buy order to populate your portfolio insights.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700 text-sm">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-gray-400">
                    <th className="px-3 py-2">Symbol</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Avg Price</th>
                    <th className="px-3 py-2 text-right">Current Price</th>
                    <th className="px-3 py-2 text-right">P&L</th>
                    <th className="px-3 py-2 text-right">Day Change %</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {holdings.map((h) => {
                    const ltp = toNum(live[h.symbol], toNum(h.ltp));
                    const pnl = (ltp - toNum(h.avg_price)) * toNum(h.qty);
                    const dayChangePct = toNum(h.ltp) > 0 ? ((ltp - toNum(h.ltp)) / toNum(h.ltp)) * 100 : 0;
                    return (
                      <tr key={h.symbol} className="hover:bg-gray-800/50">
                        <td className="px-3 py-2 font-medium text-white">{h.symbol}</td>
                        <td className="px-3 py-2 text-right text-gray-200">{toNum(h.qty)}</td>
                        <td className="px-3 py-2 text-right text-gray-200">{fmtInr(h.avg_price)}</td>
                        <td className="px-3 py-2 text-right text-gray-200">{fmtInr(ltp)}</td>
                        <td className={`px-3 py-2 text-right font-semibold ${positiveClass(pnl)}`}>{fmtInr(pnl)}</td>
                        <td className={`px-3 py-2 text-right ${positiveClass(dayChangePct)}`}>{dayChangePct.toFixed(2)}%</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setQuickTrade({ symbol: h.symbol, qty: 1, side: "BUY", orderType: "MARKET", triggerPrice: "" })}
                              className="rounded-md bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-700"
                            >
                              Buy
                            </button>
                            <button
                              onClick={() => setQuickTrade({ symbol: h.symbol, qty: 1, side: "SELL", orderType: "MARKET", triggerPrice: "" })}
                              className="rounded-md bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Sell
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
