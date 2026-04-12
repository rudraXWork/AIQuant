import React from 'react';

// Reusable component to display lists of top stocks (gainers or losers)
const TopStocksList = ({ title, stocks, onStockClick }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-2xl shadow-gray-950/50 transition-colors duration-300 h-full">
            <h2 className="text-xl font-semibold text-white mb-4 border-b border-gray-700 pb-2">{title}</h2>
            <ul className="divide-y divide-gray-700">
                {stocks.map((stock, index) => {
                    const changeColor = stock.isGainer ? 'text-green-500' : 'text-red-500';
                    const indicator = stock.isGainer ? '▲' : '▼';

                    return (
                        <li 
                            key={index} 
                            className="flex justify-between items-center py-3 hover:bg-gray-700/50 rounded-lg px-2 transition-colors duration-200 cursor-pointer"
                            onClick={() => onStockClick && onStockClick(stock)}
                        >
                            <span className="text-gray-300 font-medium">{stock.symbol}</span>
                            <div className="flex flex-col items-end">
                                <span className="text-sm text-white font-bold">₹{stock.price.toFixed(2)}</span>
                                <span className={`text-xs font-semibold ${changeColor}`}>
                                    {indicator} {Math.abs(stock.change).toFixed(2)}%
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default TopStocksList;
