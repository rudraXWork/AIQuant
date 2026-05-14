import React, { useEffect, useState } from 'react';
import { ordersAPI, walletAPI } from '../../api/client';

const TradingModal = ({ stock, onClose }) => {
    const [action, setAction] = useState('Buy');
    const [productType, setProductType] = useState('DELIVERY');
    const [orderType, setOrderType] = useState('MARKET');
    const [limitPrice, setLimitPrice] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [wallet, setWallet] = useState({ balance: 0, reserved: 0, available: 0, intradayLeverage: 5 });
    const [walletLoading, setWalletLoading] = useState(true);

    if (!stock) return null;
    const currentPrice = parseFloat(stock.price.toFixed(2));
    const lowerBand = parseFloat((currentPrice * 0.9).toFixed(2));
    const upperBand = parseFloat((currentPrice * 1.1).toFixed(2));
    const intradayLeverage = Number(wallet.intradayLeverage || 5);
    const availableBalance = Number(wallet.available || 0);
    const buyingPower = availableBalance * intradayLeverage;

    useEffect(() => {
        let mounted = true;
        const fetchWallet = async () => {
            try {
                setWalletLoading(true);
                const data = await walletAPI.getWallet();
                if (mounted) {
                    setWallet(data.wallet || { balance: 0, reserved: 0, available: 0, intradayLeverage: 5 });
                }
            } catch (err) {
                if (mounted) {
                    setError(err.message || 'Failed to fetch wallet');
                }
            } finally {
                if (mounted) {
                    setWalletLoading(false);
                }
            }
        };
        fetchWallet();
        return () => {
            mounted = false;
        };
    }, []);

    const handleTrade = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            const chosenPrice = (orderType === 'LIMIT' || orderType === 'STOP_LOSS') ? parseFloat(limitPrice) : currentPrice;
            if (!Number.isFinite(chosenPrice) || chosenPrice <= 0) {
                throw new Error('Enter a valid order price');
            }
            if ((orderType === 'LIMIT' || orderType === 'STOP_LOSS') && (chosenPrice < lowerBand || chosenPrice > upperBand)) {
                throw new Error(`Trigger price must be between ₹${lowerBand.toFixed(2)} and ₹${upperBand.toFixed(2)}`);
            }
            if (productType === 'INTRADAY' && ((quantity || 1) * chosenPrice) > buyingPower) {
                throw new Error(`Insufficient intraday margin. Max buying power is ₹${buyingPower.toFixed(2)}`);
            }

            // Place paper order via API
            await ordersAPI.placeOrder(
                stock.symbol,
                action.toUpperCase(), // BUY or SELL
                quantity || 1,
                currentPrice,
                productType,
                orderType,
                chosenPrice
            );

            setSuccess(true);
            const walletData = await walletAPI.getWallet();
            setWallet(walletData.wallet || wallet);
            // Close modal after a brief success message
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            console.error('Order placement error:', err);
            setError(err.message || 'Failed to place order');
        } finally {
            setLoading(false);
        }
    };

    const isBuy = action === 'Buy';
    const displayPrice = orderType === 'LIMIT' && Number.isFinite(parseFloat(limitPrice))
        ? parseFloat(limitPrice)
        : currentPrice;
    const totalValue = ((quantity || 1) * displayPrice).toFixed(2);
    const maxIntradayQty = Math.max(0, Math.floor(buyingPower / (displayPrice || currentPrice || 1)));
    const exceedsIntradayBuyingPower = productType === 'INTRADAY' && ((quantity || 1) * displayPrice) > buyingPower;
    const buttonColor = isBuy ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-center items-center p-4">
            <div className="bg-slate-900/90 rounded-xl shadow-2xl w-full max-w-lg border border-slate-800">
                
                {/* Modal Header */}
                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Execute Trade: {stock.symbol}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                </div>

                {/* Trade Form */}
                <form onSubmit={handleTrade} className="p-5 space-y-4">
                    
                    {/* Stock Info */}
                    <div className="flex justify-between text-slate-300 border-b border-slate-800 pb-3">
                        <span className="font-semibold">{stock.name}</span>
                        <span className="text-lg font-extrabold text-white">₹{currentPrice.toFixed(2)}</span>
                    </div>

                    {/* Buy/Sell Tabs */}
                    <div className="flex rounded-lg overflow-hidden bg-slate-800/80 p-1">
                        <button 
                            type="button"
                            onClick={() => setAction('Buy')}
                            className={`flex-1 py-2 text-center font-bold rounded-lg transition-colors ${isBuy ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            BUY
                        </button>
                        <button 
                            type="button"
                            onClick={() => setAction('Sell')}
                            className={`flex-1 py-2 text-center font-bold rounded-lg transition-colors ${!isBuy ? 'bg-rose-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            SELL
                        </button>
                    </div>

                    {/* Product Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Product Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setProductType('DELIVERY')}
                                className={`py-2 rounded-lg font-semibold transition-colors ${
                                    productType === 'DELIVERY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                DELIVERY
                            </button>
                            <button
                                type="button"
                                onClick={() => setProductType('INTRADAY')}
                                className={`py-2 rounded-lg font-semibold transition-colors ${
                                    productType === 'INTRADAY' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                INTRADAY
                            </button>
                        </div>
                    </div>

                    {/* Order Type */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Order Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                type="button"
                                onClick={() => setOrderType('MARKET')}
                                className={`py-2 rounded-lg font-semibold transition-colors ${
                                    orderType === 'MARKET' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                MARKET
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setOrderType('LIMIT');
                                    setLimitPrice(currentPrice.toFixed(2));
                                }}
                                className={`py-2 rounded-lg font-semibold transition-colors ${
                                    orderType === 'LIMIT' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                LIMIT
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setOrderType('STOP_LOSS');
                                    setLimitPrice(currentPrice.toFixed(2));
                                }}
                                className={`py-2 rounded-lg font-semibold transition-colors ${
                                    orderType === 'STOP_LOSS' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                            >
                                STOP LOSS
                            </button>
                        </div>
                    </div>

                    {(orderType === 'LIMIT' || orderType === 'STOP_LOSS') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                {orderType === 'STOP_LOSS' ? 'Stop Trigger Price' : 'Limit Price'}
                            </label>
                            <input
                                type="number"
                                value={limitPrice}
                                onChange={(e) => setLimitPrice(e.target.value)}
                                step="0.01"
                                min={lowerBand}
                                max={upperBand}
                                required
                                className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500"
                            />
                            <p className="text-xs text-gray-400 mt-1">
                                Allowed range: ₹{lowerBand.toFixed(2)} to ₹{upperBand.toFixed(2)} (±10%)
                            </p>
                            {orderType === 'STOP_LOSS' && (
                                <p className="text-xs text-yellow-300 mt-1">
                                    BUY SL triggers when live price goes above trigger. SELL SL triggers when live price goes below trigger.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Quantity Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Quantity</label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || (parseInt(value) > 0)) {
                                    setQuantity(value === '' ? '' : parseInt(value));
                                }
                            }}
                            onBlur={(e) => {
                                if (e.target.value === '' || parseInt(e.target.value) < 1) {
                                    setQuantity(1);
                                }
                            }}
                            min="1"
                            required
                            className="w-full p-3 rounded-lg bg-gray-700 text-white border border-gray-600 focus:border-indigo-500"
                        />
                    </div>

                    {true && (
                        <div className="bg-gray-700/70 border border-indigo-500/40 rounded-lg p-3">
                            <h4 className="text-sm font-semibold text-indigo-300 mb-2">
                                {productType === 'INTRADAY' ? 'Margin Calculator' : 'Wallet Summary'}
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                                <div>Wallet Balance</div>
                                <div className="text-right font-semibold text-white">₹{Number(wallet.balance || 0).toFixed(2)}</div>
                                <div>Reserved</div>
                                <div className="text-right font-semibold text-yellow-300">₹{Number(wallet.reserved || 0).toFixed(2)}</div>
                                <div>Available Balance</div>
                                <div className="text-right font-semibold text-white">₹{availableBalance.toFixed(2)}</div>
                                {productType === 'INTRADAY' && (
                                    <>
                                        <div>Leverage</div>
                                        <div className="text-right font-semibold text-white">{intradayLeverage}x</div>
                                        <div>Buying Power</div>
                                        <div className="text-right font-semibold text-green-400">₹{buyingPower.toFixed(2)}</div>
                                        <div>Max Qty @ ₹{displayPrice.toFixed(2)}</div>
                                        <div className="text-right font-semibold text-white">{maxIntradayQty}</div>
                                    </>
                                )}
                            </div>
                            {walletLoading && <p className="mt-2 text-xs text-gray-400">Loading wallet...</p>}
                            {exceedsIntradayBuyingPower && (
                                <p className="mt-2 text-xs text-red-400">
                                    Order value exceeds intraday buying power.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Summary */}
                    <div className="pt-3 border-t border-gray-700">
                        <div className="flex justify-between text-lg text-white font-bold">
                            <span>Total Value:</span>
                            <span>₹{totalValue}</span>
                        </div>
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-300 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Success message */}
                    {success && (
                        <div className="bg-green-900/50 border border-green-500 text-green-300 px-4 py-3 rounded-lg text-sm">
                            Order placed successfully! ✓
                        </div>
                    )}

                    {/* Action Button */}
                    <button 
                        type="submit" 
                        disabled={loading || success || exceedsIntradayBuyingPower}
                        className={`w-full py-3 rounded-lg text-white font-bold text-lg transition-colors ${
                            loading || success || exceedsIntradayBuyingPower ? 'bg-gray-600 cursor-not-allowed' : buttonColor
                        }`}
                    >
                        {loading ? 'Placing Order...' : success ? 'Order Placed ✓' : `${action} ${stock.symbol} (${productType} ${orderType})`}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default TradingModal;
