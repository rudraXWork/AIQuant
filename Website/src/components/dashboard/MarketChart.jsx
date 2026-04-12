// src/components/dashboard/MarketChart.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import useMarketSocket from '../../hooks/useMarketSocket';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const MarketChart = () => {
    // Get live market data
    const liveData = useMarketSocket("http://localhost:3000");
    
    // Store historical data for the chart (last 30 data points)
    const [historicalData, setHistoricalData] = useState({
        NIFTY: [],
        BANKNIFTY: [],
        RELIANCE: [],
        timestamps: []
    });
    
    const maxDataPoints = 30; // Keep last 30 updates
    
    // Update historical data when new live data arrives
    useEffect(() => {
        if (Object.keys(liveData).length > 0) {
            const now = new Date();
            const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            setHistoricalData(prev => {
                const newData = { ...prev };
                
                // Add new data points
                if (liveData.NIFTY) {
                    newData.NIFTY = [...prev.NIFTY, liveData.NIFTY].slice(-maxDataPoints);
                }
                if (liveData.BANKNIFTY) {
                    newData.BANKNIFTY = [...prev.BANKNIFTY, liveData.BANKNIFTY].slice(-maxDataPoints);
                }
                if (liveData.RELIANCE) {
                    newData.RELIANCE = [...prev.RELIANCE, liveData.RELIANCE].slice(-maxDataPoints);
                }
                newData.timestamps = [...prev.timestamps, timeLabel].slice(-maxDataPoints);
                
                return newData;
            });
        }
    }, [liveData]);
    
    // Hardcoded colors for a permanent dark theme
    const textColor = '#e5e7eb'; // gray-200 
    const gridColor = 'rgba(75, 85, 99, 0.5)'; // gray-600 with transparency

    const data = {
        labels: historicalData.timestamps.length > 0 ? historicalData.timestamps : ['Waiting...'],
        datasets: [
            {
                label: "NIFTY 50",
                data: historicalData.NIFTY,
                borderColor: '#4f46e5', // indigo-600
                backgroundColor: 'rgba(79, 70, 229, 0.15)',
                tension: 0.4,
                fill: true,
                pointRadius: 2,
                pointHoverRadius: 5,
                borderWidth: 2,
                yAxisID: 'y',
            },
            {
                label: "BANK NIFTY",
                data: historicalData.BANKNIFTY,
                borderColor: '#f59e0b', // amber-500
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                tension: 0.4,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 5,
                borderWidth: 2,
                yAxisID: 'y',
            },
            {
                label: "RELIANCE",
                data: historicalData.RELIANCE,
                borderColor: '#10b981', // emerald-500
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                tension: 0.4,
                fill: false,
                pointRadius: 2,
                pointHoverRadius: 5,
                borderWidth: 2,
                yAxisID: 'y1',
            },
        ].filter(dataset => dataset.data.length > 0), // Only show datasets with data
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { 
                display: true,
                position: 'top',
                labels: {
                    color: textColor,
                    usePointStyle: true,
                    padding: 15,
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                }
            },
            tooltip: {
                backgroundColor: '#1f2937',
                titleColor: textColor,
                bodyColor: textColor,
                borderColor: gridColor,
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += '₹' + context.parsed.y.toFixed(2);
                        }
                        return label;
                    }
                }
            },
        },
        scales: {
            x: {
                grid: { 
                    color: gridColor,
                    drawBorder: false,
                },
                ticks: { 
                    color: textColor, 
                    maxRotation: 45, 
                    minRotation: 45,
                    font: { size: 10 },
                    maxTicksLimit: 10,
                },
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                grid: { 
                    color: gridColor,
                    drawBorder: false,
                },
                ticks: { 
                    color: textColor,
                    callback: function(value) {
                        return '₹' + value.toFixed(0);
                    }
                },
                title: {
                    display: true,
                    text: 'Index Value',
                    color: '#4f46e5',
                    font: { size: 11, weight: 'bold' }
                }
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                grid: {
                    drawOnChartArea: false,
                    drawBorder: false,
                },
                ticks: { 
                    color: textColor,
                    callback: function(value) {
                        return '₹' + value.toFixed(0);
                    }
                },
                title: {
                    display: true,
                    text: 'Stock Price',
                    color: '#10b981',
                    font: { size: 11, weight: 'bold' }
                }
            },
        },
        animation: {
            duration: 750,
            easing: 'easeInOutQuart'
        },
    };

    return (
        <div className="h-full w-full flex flex-col">
            {historicalData.timestamps.length === 0 && (
                <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                        <div className="animate-pulse text-gray-400 mb-2">
                            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                            </svg>
                        </div>
                        <p className="text-gray-400 text-sm">Waiting for live market data...</p>
                        <p className="text-gray-500 text-xs mt-1">Chart will update automatically</p>
                    </div>
                </div>
            )}
            {historicalData.timestamps.length > 0 && (
                <>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>Live Updates</span>
                        </div>
                        <div className="text-xs text-gray-500">
                            {historicalData.timestamps.length} data points
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <Line data={data} options={options} />
                    </div>
                </>
            )}
        </div>
    );
};

export default MarketChart;