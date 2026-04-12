// src/api/client.js - API client with authentication
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Token management
export const getToken = () => {
  const primaryToken = localStorage.getItem('auth_token');
  if (primaryToken) {
    return primaryToken;
  }

  // Backward compatibility: older builds stored JWT under "token".
  const legacyToken = localStorage.getItem('token');
  if (legacyToken) {
    localStorage.setItem('auth_token', legacyToken);
    return legacyToken;
  }

  return null;
};

export const setToken = (token) => {
  localStorage.setItem('auth_token', token);
};

export const removeToken = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token');
};

// Generic API fetch wrapper
export const apiFetch = async (path, options = {}) => {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_URL}${path}`, config);
    
    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return { success: true };
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Auth API
export const authAPI = {
  register: async (name, email, password) => {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  login: async (email, password) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setToken(data.token);
    }
    return data;
  },

  logout: () => {
    removeToken();
  },

  me: async () => {
    return await apiFetch('/api/auth/me');
  },

  requestPasswordOtp: async (email) => {
    return await apiFetch('/api/auth/request-password-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPasswordWithOtp: async (email, otp, newPassword) => {
    return await apiFetch('/api/auth/reset-password-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  },
};

// Portfolio API
export const portfolioAPI = {
  getHoldings: async () => {
    return await apiFetch('/api/portfolio');
  },
};

// Orders API
export const ordersAPI = {
  getOrders: async () => {
    return await apiFetch('/api/orders');
  },

  placeOrder: async (symbol, side, qty, price, productType = 'DELIVERY', orderType = 'MARKET', triggerPrice = null) => {
    return await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ symbol, side, qty, price, productType, orderType, triggerPrice }),
    });
  },
};

// Leaderboard API
export const leaderboardAPI = {
  getLeaderboard: async (period = '1M') => {
    return await apiFetch(`/api/leaderboard?period=${encodeURIComponent(period)}`);
  },
};

export const marketDataAPI = {
  getIntradayCandles: async (symbol, interval = 'FIVE_MINUTE', points = 60) => {
    const params = new URLSearchParams({
      symbol: String(symbol || ''),
      interval: String(interval || 'FIVE_MINUTE'),
      points: String(points || 60),
    });
    return await apiFetch(`/api/market/intraday-candles?${params.toString()}`);
  },
};

export const walletAPI = {
  getWallet: async () => {
    return await apiFetch('/api/wallet');
  },
  addFunds: async (amount) => {
    return await apiFetch('/api/wallet/add-funds', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },
};
