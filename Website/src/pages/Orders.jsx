import React, { useState, useEffect } from 'react';
import { ordersAPI } from '../api/client';

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch orders from API
    useEffect(() => {
        const fetchOrders = async () => {
            try {
                setLoading(true);
                const data = await ordersAPI.getOrders();
                setOrders(data.orders || []);
                setError(null);
            } catch (err) {
                console.error('Failed to fetch orders:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const getStatusColor = (status) => {
        const upperStatus = status?.toUpperCase();
        switch (upperStatus) {
            case 'FILLED': return 'text-green-500 bg-green-500/20';
            case 'PENDING': return 'text-yellow-500 bg-yellow-500/20';
            case 'CANCELLED': return 'text-red-500 bg-red-500/20';
            default: return 'text-gray-500 bg-gray-500/20';
        }
    };

    const getTypeColor = (type) => {
        const upperType = type?.toUpperCase();
        return upperType === 'BUY' ? 'text-green-500' : 'text-red-500';
    };

    const getProductTypeColor = (productType) => {
        const upperProductType = productType?.toUpperCase();
        return upperProductType === 'INTRADAY' ? 'text-indigo-300 bg-indigo-500/20' : 'text-blue-300 bg-blue-500/20';
    };

    const formatDate = (dateString) => {
        const normalized = typeof dateString === 'string' && !dateString.endsWith('Z')
            ? `${dateString.replace(' ', 'T')}Z`
            : dateString;

        return new Date(normalized).toLocaleString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Kolkata',
        });
    };

    const formatCurrency = (value) => new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: 'INR', 
        minimumFractionDigits: 2 
    }).format(value).replace('INR', '₹');

    // Loading state
    if (loading) {
        return (
            <div className="container mx-auto p-4 sm:p-8 min-h-screen">
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                        <p className="text-gray-400">Loading orders...</p>
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
                    <p className="font-semibold">Error loading orders</p>
                    <p className="text-sm mt-1">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-8 min-h-screen">
            <h1 className="text-3xl font-bold text-white mb-8">Trading Orders</h1>

            {/* Orders Table */}
            <div className="bg-gray-800 p-6 rounded-xl shadow-2xl shadow-gray-950/50">
                <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-3">
                    <div>
                        <h2 className="text-2xl font-semibold text-white">
                            Order History ({orders.length})
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            All your paper trading orders
                        </p>
                    </div>
                </div>

                {orders.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-gray-400 text-6xl mb-4">📊</div>
                        <p className="text-gray-400 text-xl mb-2">No orders yet</p>
                        <p className="text-gray-500 text-sm">Start trading in Markets or Portfolio to see your orders here</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead>
                                <tr className="text-left text-sm font-medium text-gray-400 uppercase tracking-wider">
                                    <th className="py-3 px-4">Stock</th>
                                    <th className="py-3 px-4">Product</th>
                                    <th className="py-3 px-4">Order Type</th>
                                    <th className="py-3 px-4">Type</th>
                                    <th className="py-3 px-4 text-right">Quantity</th>
                                    <th className="py-3 px-4 text-right">Price (₹)</th>
                                    <th className="py-3 px-4 text-right">Total Value (₹)</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 text-sm text-gray-300">
                                {orders.map((order) => (
                                    <tr key={order.id} className="hover:bg-gray-700 transition-colors duration-150">
                                        <td className="py-3 px-4">
                                            <div className="font-bold text-white">{order.symbol}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getProductTypeColor(order.productType)}`}>
                                                {(order.productType || 'DELIVERY').toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-xs text-gray-300 font-semibold">
                                            {(order.orderType || 'MARKET').toUpperCase()}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`font-bold ${getTypeColor(order.side)}`}>
                                                {order.side}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right font-semibold">
                                            {order.qty}
                                        </td>
                                        <td className="py-3 px-4 text-right text-white font-semibold">
                                            {formatCurrency(order.price)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-white font-bold">
                                            {formatCurrency(order.qty * order.price)}
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-gray-400 text-xs">
                                            {formatDate(order.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-8">
                <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">Total Orders</h3>
                    <div className="text-3xl font-bold text-white">{orders.length}</div>
                </div>
                
                <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">Buy Orders</h3>
                    <div className="text-3xl font-bold text-green-500">
                        {orders.filter(o => o.side?.toUpperCase() === 'BUY').length}
                    </div>
                </div>
                
                <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">Sell Orders</h3>
                    <div className="text-3xl font-bold text-red-500">
                        {orders.filter(o => o.side?.toUpperCase() === 'SELL').length}
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
                    <h3 className="text-sm font-medium text-gray-400 uppercase mb-2">Intraday Orders</h3>
                    <div className="text-3xl font-bold text-indigo-400">
                        {orders.filter(o => (o.productType || 'DELIVERY').toUpperCase() === 'INTRADAY').length}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Orders;
