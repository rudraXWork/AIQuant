// src/components/core/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { walletAPI } from '../../api/client';
import aiquantLogo from '../../assets/image.png';

const NAV_LINKS = [
    { to: '/overview', label: 'Overview' },
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

    useEffect(() => {
        setIsMobileMenuOpen(false);
        setShowUserMenu(false);
    }, [location.pathname]);

    const handleLogout = () => {
        logout();
        setShowUserMenu(false);
        navigate('/login');
    };

    return (
        <nav className="sticky top-0 z-50 bg-slate-950/95 shadow-xl p-4 sm:px-8 border-b border-slate-800">
            <div className="flex justify-between items-center flex-wrap gap-4">
                {/* Logo and Nav Links */}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center gap-3">
                        <div className="logo-frame">
                            <img src={aiquantLogo} alt="AIQuant logo" className="logo-glow" />
                        </div>
                        <h1 className="text-2xl font-bold text-white">AIQuant</h1>
                    </div>
                    <div className="hidden md:flex space-x-1">
                        {NAV_LINKS.map(link => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`
                                    px-3 py-2 rounded-lg text-md font-medium transition-colors duration-200
                                    ${location.pathname === link.to 
                                        ? 'bg-emerald-500/20 text-emerald-200 shadow-md' 
                                        : 'text-slate-300 hover:bg-slate-800/80'
                                    }
                                `}
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
              
                {/* Right side - Time and Auth */}
                <div className="flex items-center space-x-3">
                    <button
                        type="button"
                        className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 transition-colors"
                        aria-label="Toggle navigation menu"
                        aria-expanded={isMobileMenuOpen}
                        onClick={() => setIsMobileMenuOpen(open => !open)}
                    >
                        {isMobileMenuOpen ? (
                            <svg className="w-5 h-5 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        )}
                    </button>
                    <span className="text-lg font-mono text-emerald-300 hidden sm:inline">
                        🕒 {currentTime}
                    </span>
                   
                    {/* Auth UI */}
                    {isAuthenticated ? (
                        <div className="flex items-center space-x-3">
                            <div
                                className="px-3 py-2 rounded-lg bg-slate-900/80 border border-emerald-500/30 cursor-pointer hover:bg-slate-800/80 transition-colors"
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
                                <p className="text-[10px] uppercase tracking-wide text-slate-400">Wallet</p>
                                <p className="text-sm font-bold text-emerald-400">₹{wallet.available.toFixed(2)}</p>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setShowUserMenu(!showUserMenu)}
                                    className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-900/80 hover:bg-slate-800/80 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
                                        {user?.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <span className="text-white hidden sm:inline">{user?.name}</span>
                                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                {showUserMenu && (
                                    <div className="absolute right-0 mt-2 w-56 bg-slate-900 rounded-lg shadow-xl border border-slate-800 py-2">
                                        <div className="px-4 py-2 border-b border-slate-800">
                                            <p className="text-sm text-slate-400">Signed in as</p>
                                            <p className="text-white font-semibold truncate">{user?.email}</p>
                                            <p className="text-xs text-slate-400 mt-1">Total Wallet: ₹{wallet.balance.toFixed(2)}</p>
                                        </div>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-2 text-red-400 hover:bg-slate-800 transition-colors"
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
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-semibold transition-colors"
                        >
                            Login
                        </Link>
                    )}
                </div>
            </div>

            {isMobileMenuOpen && (
                <div className="md:hidden w-full pt-3">
                    <div className="flex flex-col space-y-1 rounded-xl border border-slate-800 bg-slate-950/90 p-2">
                        {NAV_LINKS.map(link => (
                            <Link
                                key={link.to}
                                to={link.to}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={
                                    `px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ` +
                                    `${location.pathname === link.to
                                        ? 'bg-emerald-500/20 text-emerald-200 shadow-md'
                                        : 'text-slate-300 hover:bg-slate-800/70'
                                    }`
                                }
                            >
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
