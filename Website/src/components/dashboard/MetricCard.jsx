// src/components/dashboard/MetricCard.jsx
import React from 'react';

const MetricCard = ({ title, value, change, isUp }) => {
    const changeColor = isUp ? 'text-emerald-400' : 'text-rose-400';
    const indicator = isUp ? '▲' : '▼';

    return (
        // PERMANENT DARK THEME CLASSES
        <div className="bg-slate-900/70 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 border border-slate-800">
            <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-1">{title}</h2>
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className={`text-sm font-semibold ${changeColor}`}>
                {indicator} {change}
            </div>
        </div>
    );
};

export default MetricCard;