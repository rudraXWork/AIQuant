# Paper Trading System - Setup Guide

## Overview
This project now includes a complete **multi-user paper trading system** with authentication. All trading is simulated - no real money or Angel One trading APIs are involved. Live market prices are still fetched from Angel One Market Feed API for display purposes only.

## New Features Added

### 1. **User Authentication**
- Email + password registration and login
- JWT-based session management (7-day expiry)
- Secure password hashing with bcrypt
- Protected routes for Portfolio and Orders pages

### 2. **Paper Trading**
- Each user has their own simulated portfolio
- Place BUY and SELL orders via the TradingModal
- Orders are instantly filled at current market price
- Portfolio automatically updates with:
  - Quantity tracking
  - Average price calculation
  - Real-time P&L with live prices

### 3. **Database**
- SQLite database (`db/trading.db`)
- Tables: `users`, `paper_holdings`, `paper_orders`
- Automatic initialization on server start

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

New packages added:
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT authentication
- `better-sqlite3` - Database
- `cors` - API security

### 2. Environment Variables
No new environment variables required. The system uses:
- `JWT_SECRET` (defaults to a development key - change in production!)
- Existing Angel One credentials for market data only

### 3. Run the Application

**Terminal 1 - Start Backend Server:**
```bash
npm run server
```
This starts:
- Paper trading API on http://localhost:3000
- Live market data socket.io server
- SQLite database initialization

**Terminal 2 - Start Frontend:**
```bash
npm run dev
```
This starts the Vite development server (usually http://localhost:5173)

## Usage Flow

### First-Time User
1. Navigate to the app (http://localhost:5173)
2. Click "Login" in the navbar
3. Click "Don't have an account? Sign up"
4. Register with name, email, and password (min 6 characters)
5. You'll be automatically logged in

### Trading
1. Go to **Markets** or **Portfolio** page
2. Click on any stock row to open the TradingModal
3. Choose BUY or SELL
4. Enter quantity
5. Click the action button to place order
6. Your **Portfolio** and **Orders** pages will update automatically

### Portfolio Page
- Shows your current holdings
- Live P&L calculation with real-time prices
- Click any holding to trade more
- Search/filter holdings

### Orders Page
- Complete history of all your paper trades
- Shows: symbol, side (BUY/SELL), quantity, price, status, timestamp
- Summary cards: Total Orders, Buy Orders, Sell Orders

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info (requires JWT)

### Paper Trading
- `GET /api/portfolio` - Get user's holdings (requires JWT)
- `GET /api/orders` - Get user's order history (requires JWT)
- `POST /api/orders` - Place a paper order (requires JWT). Supports `productType` = `DELIVERY` or `INTRADAY`

## Important Notes

### Security
- **This is for demo/learning purposes only**
- Change `JWT_SECRET` in production
- Passwords are hashed with bcrypt (salt rounds: 10)
- All trading APIs require authentication

### Data Persistence
- User data, holdings, and orders are stored in SQLite
- Database file: `db/trading.db`
- To reset: delete the database file and restart server

### Market Data
- Live prices come from Angel One Market Feed (existing setup)
- **NO trading API calls are made to Angel One**
- Only market quotes are fetched for display

### Selling Stocks
- You can only SELL stocks you own
- System checks quantity before allowing SELL orders
- Error message if insufficient quantity
- For intraday mode, SELL is validated against intraday net quantity

### Live Price Integration
- Portfolio shows "● LIVE" indicator when live price is available
- Falls back to average price if no live data
- P&L calculated using live prices when available

## Troubleshooting

### "Failed to fetch portfolio/orders"
- Ensure server is running (`npm run server`)
- Check if you're logged in
- Verify JWT token hasn't expired (check browser console)

### Database Errors
- Delete `db/trading.db` and restart server
- Check file permissions

### Can't Place Orders
- Ensure you're logged in
- Check that live prices are loading (see connection status)
- For SELL orders: verify you own the stock

### Port Conflicts
- Backend uses port 3000 by default
- Frontend uses Vite's default (usually 5173)
- Change in server.js or vite.config.js if needed

## Development Notes

### File Structure
```
db/
  init.js           # Database setup
  trading.db        # SQLite database (auto-created)
middleware/
  auth.js           # JWT authentication middleware
src/
  api/
    client.js       # API client with token management
  context/
    AuthContext.jsx # React auth context
  components/
    common/
      ProtectedRoute.jsx  # Route guard
  pages/
    Login.jsx       # Login/register page
    Portfolio.jsx   # Updated for dynamic data
    Orders.jsx      # Updated for API orders
```

### Extending the System
Want to add features? Here are some ideas:
- Order cancellation
- Partial fills
- Limit orders (not just market orders)
- Transaction history export (CSV/PDF)
- Email notifications
- Watchlist/alerts
- Portfolio performance charts
- Leaderboard integration

## Testing

### Manual Test Flow
1. Register a new user
2. Place a BUY order for RELIANCE (50 shares)
3. Check Portfolio - should show holding with live P&L
4. Check Orders - should show filled BUY order
5. Place a SELL order for RELIANCE (25 shares)
6. Check Portfolio - quantity should reduce to 25
7. Try to SELL 100 shares - should get error "Insufficient quantity"

### Sample Test User
For quick testing, you can create:
- Name: Test User
- Email: test@example.com
- Password: test123

## Support
For issues or questions about the paper trading system, check:
- Browser console for errors
- Server logs in terminal
- Database contents with SQLite browser

Enjoy paper trading! 📈
