import React, { useEffect, useMemo, useState } from 'react';
import { leaderboardAPI } from '../api/client';

const Leaderboard = () => {
    const [activeFilter, setActiveFilter] = useState('1M');
    const [leaderboardData, setLeaderboardData] = useState([]);
    const [summary, setSummary] = useState({ totalRankedTraders: 0, averageWinRate: 0 });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const formatCurrency = (value) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0 }).format(value);

    useEffect(() => {
        let isMounted = true;

        const loadLeaderboard = async () => {
            setIsLoading(true);
            setError('');
            try {
                const data = await leaderboardAPI.getLeaderboard(activeFilter);
                if (!isMounted) return;
                setLeaderboardData(Array.isArray(data.leaderboard) ? data.leaderboard : []);
                setSummary(data.summary || { totalRankedTraders: 0, averageWinRate: 0 });
            } catch (err) {
                if (!isMounted) return;
                setLeaderboardData([]);
                setSummary({ totalRankedTraders: 0, averageWinRate: 0 });
                setError(err.message || 'Failed to load leaderboard');
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        loadLeaderboard();
        return () => {
            isMounted = false;
        };
    }, [activeFilter]);

    const currentLeaderboardData = useMemo(() => leaderboardData, [leaderboardData]);
    
    // NEW: Get the top trader data
    const topPerformer = currentLeaderboardData[0] || {};

    // Dynamic styles for the rank indicator
    const getRankStyle = (rank) => {
        if (rank === 1) return 'bg-yellow-500 text-gray-900 font-extrabold shadow-lg';
        if (rank === 2) return 'bg-gray-400 text-gray-900 font-bold';
        if (rank === 3) return 'bg-amber-700 text-white font-bold';
        return 'bg-gray-700 text-gray-400';
    };

    return (
        <div className="container mx-auto p-4 sm:p-8 min-h-screen">
            
            {/* --- Header and Filters --- */}
            <div className="flex justify-between items-start flex-wrap gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white">Global Leaderboard</h1>
                    <p className="text-gray-400">Top ranked traders by selected metric and time period.</p>
                </div>
                <div className="flex gap-2 p-1 bg-gray-800 rounded-lg border border-gray-700">
                    {['1D', '1W', '1M', '3M', '1Y', 'All'].map(filter => (
                        <button 
                            key={filter}
                            // This onClick handler is already correctly wired up to change the state
                            onClick={() => setActiveFilter(filter)} 
                            className={`time-filter px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200 
                                ${activeFilter === filter 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'bg-transparent text-gray-400 hover:bg-gray-700'
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- Summary Stats --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700 flex flex-col justify-between">
                    {/* UPDATED: Top Performer Card */}
                    <div className="flex items-center gap-4">
                        <div className="text-3xl">🥇</div>
                        <div>
                            <h3 className="text-sm font-medium text-gray-400 uppercase mb-1">Top Trader ({activeFilter})</h3>
                            <h2 className="text-3xl font-bold text-white">{topPerformer.user || 'N/A'}</h2>
                        </div>
                    </div>
                    {/* NEW: Display Return explicitly below the name */}
                    <div className="mt-3">
                         <span className="text-xl font-bold text-green-500">
                            {Number.isFinite(topPerformer.return) ? topPerformer.return.toFixed(2) : '0.00'}% Return
                        </span>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700 flex items-center gap-4">
                    <div className="text-3xl">🎯</div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-400 uppercase mb-1">Average Win Rate</h3>
                        <h2 className="text-3xl font-bold text-white">{summary.averageWinRate.toFixed(1)}%</h2>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700 flex items-center gap-4">
                    <div className="text-3xl">👥</div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-400 uppercase mb-1">Total Ranked Traders</h3>
                        <h2 className="text-3xl font-bold text-white">{summary.totalRankedTraders}</h2>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 rounded-lg border border-red-500/40 bg-red-900/20 text-red-300">
                    {error}
                </div>
            )}

            {/* --- Rankings Table --- */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl shadow-gray-950/50">
                <h2 className="text-2xl font-semibold text-white mb-6 border-b border-gray-700 pb-3">Top Traders by Return ({activeFilter})</h2>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-700">
                        <thead>
                            <tr className="text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                                <th className="py-3 px-4">Rank</th>
                                <th className="py-3 px-4">Trader</th>
                                <th className="py-3 px-4 text-right">Total Return</th>
                                <th className="py-3 px-4 text-right">Win Rate</th>
                                <th className="py-3 px-4 text-right">Trades</th>
                                <th className="py-3 px-4 text-right">Total P&L (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800 text-sm text-gray-300">
                            {isLoading && (
                                <tr>
                                    <td colSpan="6" className="py-6 px-4 text-center text-gray-400">Loading leaderboard...</td>
                                </tr>
                            )}

                            {!isLoading && currentLeaderboardData.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-6 px-4 text-center text-gray-400">
                                        No users with trading activity found for this period.
                                    </td>
                                </tr>
                            )}

                            {!isLoading && currentLeaderboardData.map((trader) => (
                                <tr key={trader.user} className="hover:bg-gray-700 transition-colors duration-150">
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${getRankStyle(trader.rank)}`}>
                                            {trader.rank}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 font-bold text-white">{trader.user}</td>
                                    <td className={`py-3 px-4 text-right font-bold ${trader.return >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {trader.return.toFixed(2)}%
                                    </td>
                                    <td className="py-3 px-4 text-right">{trader.winRate}%</td>
                                    <td className="py-3 px-4 text-right text-gray-400">{trader.trades}</td>
                                    <td className={`py-3 px-4 text-right ${trader.pnl >= 0 ? 'text-white' : 'text-red-300'}`}>
                                        ₹{formatCurrency(Math.round(trader.pnl))}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
