# Quick Start Guide - Paper Trading System

## 🚀 Getting Started in 3 Steps

### Step 1: Start the Backend Server
```bash
npm run server
```
Wait for:
- ✅ Database initialized successfully
- 🚀 Server running on port 3000
- 📊 Paper Trading API ready
- ✅ Logged in (AngelOne for market data)

### Step 2: Start the Frontend
```bash
npm run dev
```
Opens at http://localhost:5173

### Step 3: Create Your Account
1. Click "Login" in navbar
2. Click "Don't have an account? Sign up"
3. Fill in:
   - Name: Your Name
   - Email: your@email.com
   - Password: minimum 6 characters
4. Click "Create Account"

## 📊 Your First Trade

1. **Go to Markets page** - See live stock prices
2. **Click on any stock** - Opens trading modal
3. **Select product type** - Choose `DELIVERY` or `INTRADAY`
4. **Select BUY** and enter quantity (e.g., 10 shares)
5. **Click BUY button** - Order placed instantly!
6. **Go to Portfolio** - See delivery holdings and intraday positions with live P&L/MTM
7. **Go to Orders** - See your trade history with product type

## 🎯 What You Can Do

### Portfolio Page
- ✅ View all your holdings
- ✅ Real-time P&L with live prices
- ✅ Search/filter stocks
- ✅ Click to trade more

### Orders Page
- ✅ Complete trade history
- ✅ All BUY and SELL orders
- ✅ Delivery + Intraday order visibility
- ✅ Order details with timestamps

### Markets Page
- ✅ Live stock prices
- ✅ Click any stock to trade
- ✅ Real-time updates via WebSocket

## 🔒 Security Features
- Password hashing with bcrypt
- JWT token authentication (7-day expiry)
- Protected routes (Portfolio & Orders)
- Per-user isolated data

## 💡 Tips

### Selling Stocks
- You can only SELL what you own
- System prevents over-selling
- Get instant error feedback
- For intraday trades, SELL checks your open intraday quantity

### Live Prices
- Green "● LIVE" indicator shows real-time data
- Falls back to average price if market closed
- P&L updates automatically

### Multiple Users
- Each user has separate portfolio
- No data sharing between users
- Create multiple accounts to test

## ⚠️ Important Notes

1. **Paper Trading Only** - No real money, no real trades
2. **Market Data** - Uses Angel One API for quotes only
3. **Local Storage** - SQLite database in `db/trading.db`
4. **Development Mode** - Not production-ready

## 🛠️ Troubleshooting

**Can't login?**
- Check both servers are running
- Clear browser localStorage
- Try different email

**No live prices?**
- Ensure `npm run server` is running
- Check Angel One credentials in `.env`
- Market may be closed

**Database issues?**
- Delete `db/trading.db`
- Restart server

## 📱 Test Scenarios

### Scenario 1: Build a Portfolio
```
1. Buy 50 RELIANCE shares
2. Buy 25 TCS shares
3. Buy 100 ICICIBANK shares
4. Check Portfolio - see 3 holdings
```

### Scenario 2: Take Profit
```
1. Buy 100 INFY shares @ ₹1500
2. Wait for price to go up
3. Sell 50 INFY shares @ higher price
4. Check Portfolio - see profit!
```

### Scenario 3: Multiple Trades
```
1. Buy 10 HDFC shares
2. Buy 20 more HDFC shares
3. Check Portfolio - average price calculated
4. Sell 15 HDFC shares
5. Check Portfolio - 15 shares remaining
```

## 🎓 Learning Objectives

This system demonstrates:
- ✅ JWT authentication
- ✅ REST API design
- ✅ Database transactions
- ✅ React context/hooks
- ✅ Protected routes
- ✅ Real-time WebSocket data
- ✅ State management
- ✅ Error handling

## 🚀 Ready to Trade?

1. Make sure both servers are running
2. Open http://localhost:5173
3. Register and start trading!

Happy Paper Trading! 📈💰
