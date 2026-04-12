// src/components/core/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { walletAPI } from '../../api/client';

const NAV_LINKS = [
    { to: '/', label: 'Overview' },
    { to: '/markets', label: 'Markets' },
    { to: '/portfolio', label: 'Portfolio' },
    { to: '/orders', label: 'Orders' },
    { to: '/leaderboard', label: 'Leaderboard' },
    { to: '/insights', label: 'Insights' },
    { to: '/settings', label: 'Settings' },
];

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [wallet, setWallet] = useState({ balance: 0, available: 0 });

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        let mounted = true;
        const fetchWallet = async () => {
            if (!isAuthenticated) {
                if (mounted) setWallet({ balance: 0, available: 0 });
                return;
            }
            try {
                const data = await walletAPI.getWallet();
                if (mounted) {
                    setWallet({
                        balance: Number(data.wallet?.balance || 0),
                        available: Number(data.wallet?.available || 0),
                    });
                }
            } catch {
                if (mounted) setWallet({ balance: 0, available: 0 });
            }
        };
        fetchWallet();
        const timer = setInterval(fetchWallet, 10000);
        return () => {
            mounted = false;
            clearInterval(timer);
        };
    }, [isAuthenticated]);

    const handleLogout = () => {
        logout();
        setShowUserMenu(false);
        navigate('/login');
    };

    return (
        <nav className="sticky top-0 z-50 bg-gray-900 shadow-xl p-4 sm:px-8 border-b border-gray-800">
            <div className="flex justify-between items-center flex-wrap gap-4">
                {/* Logo and Nav Links */}
                <div className="flex items-center space-x-6">
                    <h1 className="text-2xl font-bold text-white">📈AIQuant</h1>
                    <div className="hidden md:flex space-x-1">
                        {NAV_LINKS.map(link => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`
                                    px-3 py-2 rounded-lg text-md font-medium transition-colors duration-200
                                    ${location.pathname === link.to 
                                        ? 'bg-indigo-600 text-white shadow-md' 
                                        : 'text-gray-300 hover:bg-gray-700'
                                    }
                                `}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
              
                {/* Right side - Time and Auth */}
                <div className="flex items-center space-x-4">
                    <span className="text-lg font-mono text-blue-400 hidden sm:inline">
                        🕒 {currentTime}
                    </span>
                   
                    {/* Auth UI */}
                    {isAuthenticated ? (
                        <div className="flex items-center space-x-3">
                            <div
                                className="px-3 py-2 rounded-lg bg-gray-800 border border-emerald-500/30 cursor-pointer hover:bg-gray-700 transition-colors"
                                onClick={() => navigate('/settings?tab=wallet')}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        navigate('/settings?tab=wallet');
                                    }
                                }}
                            >
                                <p className="text-[10px] uppercase tracking-wide text-gray-400">Wallet</p>
                                <p className="text-sm font-bold text-emerald-400">₹{wallet.available.toFixed(2)}</p>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <span className="text-white hidden sm:inline">{user?.name}</span>
                                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                {showUserMenu && (
                                    <div className="absolute right-0 mt-2 w-56 bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2">
                                        <div className="px-4 py-2 border-b border-gray-700">
                                            <p className="text-sm text-gray-400">Signed in as</p>
                                            <p className="text-white font-semibold truncate">{user?.email}</p>
                                            <p className="text-xs text-gray-400 mt-1">Total Wallet: ₹{wallet.balance.toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700 transition-colors"
                                        >
                                            Logout
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Link
                            to="/login"
                            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
                        >
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
