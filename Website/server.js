// server.js (polling fallback, ESM)
import express from "express";
import http from "http";
import { Server as IOServer } from "socket.io";
import axios from "axios";
import { SmartAPI } from "smartapi-javascript";
import { authenticator } from "otplib";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import { MongoClient } from "mongodb";
import { authMiddleware, getJwtSecret } from "./middleware/auth.js";

// Load environment variables
dotenv.config();

const API_KEY = process.env.API_KEY;
const CLIENT_CODE = process.env.CLIENT_CODE;
const PASSWORD = process.env.PASSWORD;
const TOTP_SECRET = process.env.TOTP_SECRET; 
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_API_URL = process.env.EMAILJS_API_URL || 'https://api.emailjs.com/api/v1.0/email/send';
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'aiquant';

const smart_api = new SmartAPI({ api_key: API_KEY });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new IOServer(server, { cors: { origin: "*" } });

let mongoClient = null;
let mongoDbPromise = null;

let jwtToken = null;       // long token you already get
let pollInterval = 5000;   // 5 seconds to avoid rate limiting (increased from 3s)
let pollTimer = null;
const latestPricesBySymbol = new Map();
let loginInFlight = null;
let lastMarketAuthLogAt = 0;
const MARKET_TIMEZONE = process.env.MARKET_TIMEZONE || "Asia/Kolkata";
const MARKET_CLOSE_HOUR = Number(process.env.MARKET_CLOSE_HOUR || 16);
const MARKET_CLOSE_MINUTE = Number(process.env.MARKET_CLOSE_MINUTE || 0);
let marketCloseStopLogged = false;
let intradaySquareOffInFlight = false;

function getMissingMarketAuthEnvKeys() {
  const missing = [];
  if (!API_KEY) missing.push("API_KEY");
  if (!CLIENT_CODE) missing.push("CLIENT_CODE");
  if (!PASSWORD) missing.push("PASSWORD");
  if (!TOTP_SECRET) missing.push("TOTP_SECRET");
  return missing;
}

function extractJwtFromSession(session) {
  return (
    session?.data?.jwtToken ||
    session?.data?.jwt ||
    session?.data?.token ||
    session?.data?.data?.jwtToken ||
    session?.jwtToken ||
    null
  );
}

function getLeaderboardWindowStart(period) {
  const now = Date.now();
  switch ((period || '1M').toUpperCase()) {
    case '1D':
      return new Date(now - (24 * 60 * 60 * 1000));
    case '1W':
      return new Date(now - (7 * 24 * 60 * 60 * 1000));
    case '1M':
      return new Date(now - (30 * 24 * 60 * 60 * 1000));
    case '3M':
      return new Date(now - (90 * 24 * 60 * 60 * 1000));
    case '1Y':
      return new Date(now - (365 * 24 * 60 * 60 * 1000));
    case 'ALL':
      return null;
    default:
      return new Date(now - (30 * 24 * 60 * 60 * 1000));
  }
}

async function getMongoDb() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required for MongoDB auth.');
  }

  if (mongoDbPromise) {
    return mongoDbPromise;
  }

  mongoClient = new MongoClient(MONGODB_URI);
  mongoDbPromise = mongoClient.connect().then(() => mongoClient.db(MONGODB_DB));
  return mongoDbPromise;
}

async function getUsersCollection() {
  const mongoDb = await getMongoDb();
  return mongoDb.collection('users');
}

async function getCollection(name) {
  const mongoDb = await getMongoDb();
  return mongoDb.collection(name);
}

async function sendPasswordResetOtpEmail(email, otp) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY || !EMAILJS_PRIVATE_KEY) {
    throw new Error('OTP email service is not configured. Please set EMAILJS environment variables.');
  }

  try {
    const payload = {
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      accessToken: EMAILJS_PRIVATE_KEY,
      template_params: {
        subject: 'Trade Insights Password Reset OTP',
        from_name: 'Trade Insights',
        from_email: 'rudranjena1@gmail.com',
        to_email: email,
        otp,
        app_name: 'Trade Insights',
        message: `Your password reset OTP is ${otp}. It is valid for 10 minutes.`,
      },
    };
    console.log('📧 Sending OTP email to:', email, 'via EmailJS...');
    const response = await axios.post(EMAILJS_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ EmailJS response:', response.status, response.data);
  } catch (error) {
    const status = error?.response?.status;
    const responseData = error?.response?.data;
    const responseText = typeof responseData === 'string' ? responseData : JSON.stringify(responseData || {});

    console.error('EmailJS send error:', {
      status,
      url: EMAILJS_API_URL,
      response: responseText,
    });

    if (status === 404) {
      throw new Error('EmailJS service/template/public key was not found. Verify EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, and EMAILJS_PUBLIC_KEY.');
    }
    if (status === 403 && responseText.toLowerCase().includes('non-browser environments')) {
      throw new Error('EmailJS blocked server-side requests. In EmailJS Dashboard -> Account -> Security, enable API access from non-browser environments.');
    }
    if (status === 401 || status === 403) {
      throw new Error('EmailJS authentication failed. Verify EMAILJS_PUBLIC_KEY and EMAILJS_PRIVATE_KEY.');
    }
    if (status === 429) {
      throw new Error('Too many OTP requests. Please wait and try again.');
    }

    throw new Error('OTP email could not be sent right now.');
  }
}

// login and get session (jwt)
async function login() {
  if (jwtToken) {
    return jwtToken;
  }

  if (loginInFlight) {
    return loginInFlight;
  }

  loginInFlight = (async () => {
    const missingKeys = getMissingMarketAuthEnvKeys();
    if (missingKeys.length > 0) {
      throw new Error(`Missing market auth env keys: ${missingKeys.join(", ")}`);
    }

    const totp = authenticator.generate(TOTP_SECRET);
    const session = await smart_api.generateSession(CLIENT_CODE, PASSWORD, totp);
    const sessionStatus = session?.status;
    const loginSucceeded = sessionStatus === true;

    if (!loginSucceeded) {
      const sessionReason =
        session?.message ||
        session?.errorcode ||
        session?.data?.message ||
        `status ${String(sessionStatus)}`;
      throw new Error(`AngelOne authentication failed (${sessionReason})`);
    }

    const token = extractJwtFromSession(session);

    if (!token) {
      const topLevelKeys = session && typeof session === "object" ? Object.keys(session).join(",") : "none";
      const dataKeys = session?.data && typeof session.data === "object" ? Object.keys(session.data).join(",") : "none";
      throw new Error(`AngelOne login missing JWT token (sessionKeys=${topLevelKeys}; dataKeys=${dataKeys})`);
    }

    jwtToken = token;
    console.log("✅ Logged in to AngelOne market feed");
    return jwtToken;
  })();

  try {
    return await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

async function ensureMarketSession() {
  if (jwtToken) {
    return true;
  }

  try {
    await login();
    return Boolean(jwtToken);
  } catch (error) {
    const now = Date.now();
    if (now - lastMarketAuthLogAt > 15000) {
      console.warn("Market auth unavailable, polling paused:", error.message || error);
      lastMarketAuthLogAt = now;
    }
    return false;
  }
}

// NSE Token to symbol mapping for AngelOne API
const TOKEN_SYMBOL_MAP = {
  // Indices
  "26000": { symbol: "NIFTY", display: "Nifty 50", exchange: "NSE" },
  "99926000": { symbol: "NIFTY", display: "Nifty 50", exchange: "NSE" },
  "99926009": { symbol: "BANKNIFTY", display: "Bank Nifty", exchange: "NSE" },
  
  // Top NSE Stocks
  "2885": { symbol: "RELIANCE", display: "Reliance Industries Ltd.", exchange: "NSE" },
  "11536": { symbol: "TCS", display: "Tata Consultancy Services Ltd.", exchange: "NSE" },
  "1333": { symbol: "HDFCBANK", display: "HDFC Bank Ltd.", exchange: "NSE" },
  "1594": { symbol: "INFY", display: "Infosys Ltd.", exchange: "NSE" },
  "4963": { symbol: "ICICIBANK", display: "ICICI Bank Ltd.", exchange: "NSE" },
  "1922": { symbol: "KOTAKBANK", display: "Kotak Mahindra Bank Ltd.", exchange: "NSE" },
  "11483": { symbol: "LT", display: "Larsen & Toubro Ltd.", exchange: "NSE" },
  "1394": { symbol: "HINDUNILVR", display: "Hindustan Unilever Ltd.", exchange: "NSE" },
  "236": { symbol: "ASIANPAINT", display: "Asian Paints Ltd.", exchange: "NSE" },
  "7229": { symbol: "HCLTECH", display: "HCL Technologies Ltd.", exchange: "NSE" },
  "10604": { symbol: "BHARTIARTL", display: "Bharti Airtel Ltd.", exchange: "NSE" },
  "10999": { symbol: "MARUTI", display: "Maruti Suzuki India Ltd.", exchange: "NSE" },
  "3351": { symbol: "SUNPHARMA", display: "Sun Pharmaceutical Industries Ltd.", exchange: "NSE" },
  "3506": { symbol: "TITAN", display: "Titan Company Ltd.", exchange: "NSE" },
  "5900": { symbol: "AXISBANK", display: "Axis Bank Ltd.", exchange: "NSE" },
  "17963": { symbol: "NESTLEIND", display: "Nestle India Ltd.", exchange: "NSE" },
  "8840": { symbol: "TATAMOTORS", display: "Tata Motors Ltd.", exchange: "NSE" },
  "3787": { symbol: "WIPRO", display: "Wipro Ltd.", exchange: "NSE" },
  "14977": { symbol: "POWERGRID", display: "Power Grid Corporation of India Ltd.", exchange: "NSE" },
  "3045": { symbol: "SBIN", display: "State Bank of India", exchange: "NSE" },
  "317": { symbol: "BAJFINANCE", display: "Bajaj Finance Ltd.", exchange: "NSE" },
  "16675": { symbol: "BAJAJFINSV", display: "Bajaj Finserv Ltd.", exchange: "NSE" },
  "11532": { symbol: "ULTRACEMCO", display: "UltraTech Cement Ltd.", exchange: "NSE" },
  "11723": { symbol: "JSWSTEEL", display: "JSW Steel Ltd.", exchange: "NSE" },
  "25": { symbol: "ADANIENT", display: "Adani Enterprises Ltd.", exchange: "NSE" },
  "15083": { symbol: "ADANIPORTS", display: "Adani Ports and Special Economic Zone Ltd.", exchange: "NSE" },
  "2475": { symbol: "ONGC", display: "Oil and Natural Gas Corporation Ltd.", exchange: "NSE" },
  "20374": { symbol: "COALINDIA", display: "Coal India Ltd.", exchange: "NSE" },
  "11630": { symbol: "NTPC", display: "NTPC Ltd.", exchange: "NSE" },
  "1660": { symbol: "ITC", display: "ITC Ltd.", exchange: "NSE" },
  "10940": { symbol: "DIVISLAB", display: "Divi's Laboratories Ltd.", exchange: "NSE" },
  "694": { symbol: "CIPLA", display: "Cipla Ltd.", exchange: "NSE" },
  "10440": { symbol: "LUPIN", display: "Lupin Ltd.", exchange: "NSE" },
  "1348": { symbol: "HEROMOTOCO", display: "Hero MotoCorp Ltd.", exchange: "NSE" },
  "910": { symbol: "EICHERMOT", display: "Eicher Motors Ltd.", exchange: "NSE" },
  "2031": { symbol: "M&M", display: "Mahindra & Mahindra Ltd.", exchange: "NSE" },
  "16669": { symbol: "BAJAJ-AUTO", display: "Bajaj Auto Ltd.", exchange: "NSE" },
  "8479": { symbol: "TVSMOTOR", display: "TVS Motor Company Ltd.", exchange: "NSE" },
  "212": { symbol: "ASHOKLEY", display: "Ashok Leyland Ltd.", exchange: "NSE" },
  "3063": { symbol: "VEDL", display: "Vedanta Ltd.", exchange: "NSE" },
  "1363": { symbol: "HINDALCO", display: "Hindalco Industries Ltd.", exchange: "NSE" },
  "3499": { symbol: "TATASTEEL", display: "Tata Steel Ltd.", exchange: "NSE" },
  "1232": { symbol: "GRASIM", display: "Grasim Industries Ltd.", exchange: "NSE" },
  "1270": { symbol: "AMBUJACEM", display: "Ambuja Cements Ltd.", exchange: "NSE" },
  "3103": { symbol: "SHREECEM", display: "Shree Cement Ltd.", exchange: "NSE" },
  "772": { symbol: "DABUR", display: "Dabur India Ltd.", exchange: "NSE" },
  "547": { symbol: "BRITANNIA", display: "Britannia Industries Ltd.", exchange: "NSE" },
  "10099": { symbol: "GODREJCP", display: "Godrej Consumer Products Ltd.", exchange: "NSE" },
  "15141": { symbol: "COLPAL", display: "Colgate Palmolive (India) Ltd.", exchange: "NSE" },
  "2664": { symbol: "PIDILITIND", display: "Pidilite Industries Ltd.", exchange: "NSE" },
  "404": { symbol: "BERGEPAINT", display: "Berger Paints India Ltd.", exchange: "NSE" },
  
  // BSE Stocks
  "500463": { symbol: "BBOX", display: "Black Box Limited", exchange: "BSE" },
};

const SYMBOL_EXCHANGE_MAP = Object.values(TOKEN_SYMBOL_MAP).reduce((acc, item) => {
  if (item?.symbol && !acc[item.symbol]) {
    acc[item.symbol] = item.exchange || "NSE";
  }
  return acc;
}, {});

// Symbol alias mapping (for different symbol formats)
const SYMBOL_ALIAS_MAP = {
  "INFOSYS": "INFY",
  "HDFC BANK": "HDFCBANK",
  "L&T": "LT",
  "M&M": "M&M",
  "BAJAJ-AUTO": "BAJAJ-AUTO",
};

const ALLOWED_INTRADAY_INTERVALS = new Set([
  "ONE_MINUTE",
  "THREE_MINUTE",
  "FIVE_MINUTE",
  "TEN_MINUTE",
  "FIFTEEN_MINUTE",
  "THIRTY_MINUTE",
  "ONE_HOUR",
]);

const INTRADAY_INTERVAL_MINUTES = {
  ONE_MINUTE: 1,
  THREE_MINUTE: 3,
  FIVE_MINUTE: 5,
  TEN_MINUTE: 10,
  FIFTEEN_MINUTE: 15,
  THIRTY_MINUTE: 30,
  ONE_HOUR: 60,
};

function normalizeTradingSymbol(rawSymbol) {
  const symbol = String(rawSymbol || "").trim().toUpperCase();
  if (!symbol) return "";
  return SYMBOL_ALIAS_MAP[symbol] || symbol;
}

function getTokenForSymbol(symbol) {
  const targetSymbol = normalizeTradingSymbol(symbol);
  const match = Object.entries(TOKEN_SYMBOL_MAP).find(([, data]) => {
    return normalizeTradingSymbol(data?.symbol) === targetSymbol;
  });
  return match ? match[0] : null;
}

function formatSmartApiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MARKET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}`;
}

function buildCachedMarketTickPayload() {
  const payload = { NSE: [], BSE: [] };

  latestPricesBySymbol.forEach((rawPrice, symbol) => {
    const ltp = Number(rawPrice);
    if (!symbol || !Number.isFinite(ltp) || ltp <= 0) {
      return;
    }

    const exchange = SYMBOL_EXCHANGE_MAP[symbol] || "NSE";
    if (!payload[exchange]) {
      payload[exchange] = [];
    }

    payload[exchange].push({
      tradingsymbol: symbol,
      symbol,
      exchange,
      lastTradedPrice: ltp,
      ltp,
      price: ltp,
    });
  });

  return payload;
}

function getMarketTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  return {
    weekday: map.weekday,
    hour: Number(map.hour || 0),
    minute: Number(map.minute || 0),
  };
}

function getMarketDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = {};
  parts.forEach((part) => {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  });

  return `${map.year}-${map.month}-${map.day}`;
}

function isMarketClosedNow() {
  const { weekday, hour, minute } = getMarketTimeParts();
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const afterClose = hour > MARKET_CLOSE_HOUR || (hour === MARKET_CLOSE_HOUR && minute >= MARKET_CLOSE_MINUTE);
  return isWeekend || afterClose;
}

function hasSnapshotForAllTrackedSymbols() {
  const requiredSymbols = new Set(Object.values(TOKEN_SYMBOL_MAP).map((entry) => entry.symbol));
  for (const symbol of requiredSymbols) {
    const ltp = Number(latestPricesBySymbol.get(symbol));
    if (!Number.isFinite(ltp) || ltp <= 0) {
      return false;
    }
  }
  return true;
}

function isMarketOpenNow() {
  const { weekday, hour, minute } = getMarketTimeParts();
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return false;
  const beforeOpen = hour < 9 || (hour === 9 && minute < 15);
  const afterClose = hour > MARKET_CLOSE_HOUR || (hour === MARKET_CLOSE_HOUR && minute >= MARKET_CLOSE_MINUTE);
  return !beforeOpen && !afterClose;
}

function getLivePriceForSymbol(symbol) {
  const normalized = normalizeTradingSymbol(symbol);
  const direct = Number(latestPricesBySymbol.get(normalized));
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }
  const alias = Object.entries(SYMBOL_ALIAS_MAP).find(([display, api]) => {
    return normalizeTradingSymbol(display) === normalized || normalizeTradingSymbol(api) === normalized;
  });
  if (alias) {
    const [display, api] = alias;
    const aliasPrice = Number(latestPricesBySymbol.get(api) || latestPricesBySymbol.get(display));
    if (Number.isFinite(aliasPrice) && aliasPrice > 0) {
      return aliasPrice;
    }
  }
  return null;
}

function isPriceWithinBand(currentPrice, requestedPrice, band = 0.1) {
  const min = currentPrice * (1 - band);
  const max = currentPrice * (1 + band);
  return requestedPrice >= min && requestedPrice <= max;
}

async function ensureWallet(userId) {
  const wallets = await getCollection('paper_wallets');
  let wallet = await wallets.findOne({ user_id: userId });
  if (wallet) return wallet;

  const now = new Date();
  await wallets.updateOne(
    { user_id: userId },
    {
      $setOnInsert: {
        _id: userId,
        user_id: userId,
        balance: 0,
        reserved: 0,
        intraday_leverage: 5,
        updated_at: now,
      },
    },
    { upsert: true }
  );

  wallet = await wallets.findOne({ user_id: userId });
  return wallet;
}

function getWalletAvailableFunds(wallet) {
  return Number(wallet.balance) - Number(wallet.reserved);
}

async function applyOrderFill({ orderId, userId, symbol, side, qty, fillPrice, productType, status = 'FILLED' }) {
  const orders = await getCollection('paper_orders');
  const holdings = await getCollection('paper_holdings');
  const positions = await getCollection('paper_intraday_positions');

  if (productType === 'INTRADAY') {
    const existingPosition = await positions.findOne({ user_id: userId, symbol });

    const currentQty = Number(existingPosition?.net_qty || 0);
    if (side === 'SELL' && currentQty < qty) {
      throw new Error(`Insufficient intraday quantity. You have ${currentQty} shares of ${symbol}`);
    }

    await orders.insertOne({
      _id: orderId,
      id: orderId,
      user_id: userId,
      symbol,
      product_type: productType,
      order_type: 'MARKET',
      side,
      qty,
      price: fillPrice,
      trigger_price: fillPrice,
      reserved_amount: 0,
      status,
      created_at: new Date(),
    });

    const newQty = side === 'BUY' ? currentQty + qty : currentQty - qty;
    if (!existingPosition && newQty > 0) {
      const positionId = randomUUID();
      await positions.insertOne({
        _id: positionId,
        id: positionId,
        user_id: userId,
        symbol,
        net_qty: newQty,
        avg_price: fillPrice,
        updated_at: new Date(),
      });
    } else if (existingPosition && newQty === 0) {
      await positions.deleteOne({ user_id: userId, symbol });
    } else if (existingPosition && newQty > 0) {
      let newAvgPrice = Number(existingPosition.avg_price || 0);
      if (side === 'BUY') {
        newAvgPrice = ((newAvgPrice * currentQty) + (fillPrice * qty)) / newQty;
      }
      await positions.updateOne(
        { user_id: userId, symbol },
        { $set: { net_qty: newQty, avg_price: newAvgPrice, updated_at: new Date() } }
      );
    }
    return;
  }

  if (side === 'SELL') {
    const holding = await holdings.findOne({ user_id: userId, symbol }, { projection: { qty: 1 } });
    if (!holding || Number(holding.qty) < qty) {
      throw new Error(`Insufficient quantity. You have ${holding?.qty || 0} shares of ${symbol}`);
    }
  }

  await orders.insertOne({
    _id: orderId,
    id: orderId,
    user_id: userId,
    symbol,
    product_type: productType,
    order_type: 'MARKET',
    side,
    qty,
    price: fillPrice,
    trigger_price: fillPrice,
    reserved_amount: 0,
    status,
    created_at: new Date(),
  });

  const existingHolding = await holdings.findOne({ user_id: userId, symbol });
  if (side === 'BUY') {
    if (existingHolding) {
      const totalCost = (Number(existingHolding.avg_price) * Number(existingHolding.qty)) + (fillPrice * qty);
      const totalQty = Number(existingHolding.qty) + qty;
      await holdings.updateOne(
        { user_id: userId, symbol },
        { $set: { qty: totalQty, avg_price: totalCost / totalQty, updated_at: new Date() } }
      );
    } else {
      const holdingId = randomUUID();
      await holdings.insertOne({
        _id: holdingId,
        id: holdingId,
        user_id: userId,
        symbol,
        qty,
        avg_price: fillPrice,
        updated_at: new Date(),
      });
    }
  } else {
    const newQty = Number(existingHolding.qty) - qty;
    if (newQty === 0) {
      await holdings.deleteOne({ user_id: userId, symbol });
    } else {
      await holdings.updateOne(
        { user_id: userId, symbol },
        { $set: { qty: newQty, updated_at: new Date() } }
      );
    }
  }
}

function shouldFillConditionalOrder(orderType, side, livePrice, triggerPrice) {
  const t = String(orderType || 'MARKET').toUpperCase();
  const s = String(side || '').toUpperCase();
  if (t === 'MARKET') return true;
  if (t === 'LIMIT') {
    return s === 'BUY' ? livePrice <= triggerPrice : livePrice >= triggerPrice;
  }
  if (t === 'STOP_LOSS') {
    return s === 'BUY' ? livePrice >= triggerPrice : livePrice <= triggerPrice;
  }
  return false;
}

async function executePendingOrdersForOpenMarket() {
  if (!isMarketOpenNow()) return;

  const orders = await getCollection('paper_orders');
  const holdings = await getCollection('paper_holdings');
  const positions = await getCollection('paper_intraday_positions');
  const wallets = await getCollection('paper_wallets');

  const pendingOrders = await orders
    .find({ status: 'PENDING' })
    .sort({ created_at: 1 })
    .toArray();

  if (!pendingOrders.length) return;

  let filledCount = 0;
  for (const order of pendingOrders) {
    const livePrice = getLivePriceForSymbol(order.symbol);
    if (!Number.isFinite(livePrice) || livePrice <= 0) {
      continue;
    }

    const triggerPrice = Number(order.trigger_price || order.price || 0);
    const shouldFill = shouldFillConditionalOrder(order.order_type, order.side, livePrice, triggerPrice);
    if (!shouldFill) continue;

    const side = String(order.side || '').toUpperCase();
    const productType = String(order.product_type || 'DELIVERY').toUpperCase();
    const qty = Number(order.qty);
    const reservedAmount = Number(order.reserved_amount || 0);
    if (!Number.isInteger(qty) || qty <= 0) continue;

    const wallet = await ensureWallet(order.user_id);

    if (productType === 'DELIVERY' && side === 'SELL') {
      const holding = await holdings.findOne(
        { user_id: order.user_id, symbol: order.symbol },
        { projection: { qty: 1 } }
      );
      if (!holding || Number(holding.qty) < qty) {
        await orders.updateOne({ _id: order._id }, { $set: { status: 'CANCELLED' } });
        continue;
      }
    }
    if (productType === 'INTRADAY' && side === 'SELL') {
      const pos = await positions.findOne(
        { user_id: order.user_id, symbol: order.symbol },
        { projection: { net_qty: 1 } }
      );
      if (!pos || Number(pos.net_qty) < qty) {
        await orders.updateOne({ _id: order._id }, { $set: { status: 'CANCELLED' } });
        continue;
      }
    }

    if (side === 'BUY') {
      const finalCost = livePrice * qty;
      const requiredExtra = Math.max(0, finalCost - reservedAmount);
      const walletAvailable = getWalletAvailableFunds(wallet);
      if (walletAvailable < requiredExtra) {
        await orders.updateOne({ _id: order._id }, { $set: { status: 'CANCELLED' } });
        if (reservedAmount > 0) {
          await wallets.updateOne(
            { user_id: order.user_id },
            { $inc: { reserved: -reservedAmount }, $set: { updated_at: new Date() } }
          );
        }
        continue;
      }
    }

    await orders.updateOne(
      { _id: order._id },
      { $set: { status: 'FILLED', price: livePrice } }
    );

    if (side === 'BUY') {
      const finalCost = livePrice * qty;
      await wallets.updateOne(
        { user_id: order.user_id },
        { $inc: { reserved: -reservedAmount, balance: -finalCost }, $set: { updated_at: new Date() } }
      );
    } else if (side === 'SELL') {
      await wallets.updateOne(
        { user_id: order.user_id },
        { $inc: { balance: livePrice * qty }, $set: { updated_at: new Date() } }
      );
    }

    if (productType === 'INTRADAY') {
      const existingPosition = await positions.findOne({ user_id: order.user_id, symbol: order.symbol });
      const currentQty = Number(existingPosition?.net_qty || 0);
      const newQty = side === 'BUY' ? currentQty + qty : currentQty - qty;
      if (!existingPosition && newQty > 0) {
        const positionId = randomUUID();
        await positions.insertOne({
          _id: positionId,
          id: positionId,
          user_id: order.user_id,
          symbol: order.symbol,
          net_qty: newQty,
          avg_price: livePrice,
          updated_at: new Date(),
        });
      } else if (existingPosition && newQty === 0) {
        await positions.deleteOne({ user_id: order.user_id, symbol: order.symbol });
      } else if (existingPosition && newQty > 0) {
        let newAvgPrice = Number(existingPosition.avg_price || 0);
        if (side === 'BUY') {
          newAvgPrice = ((newAvgPrice * currentQty) + (livePrice * qty)) / newQty;
        }
        await positions.updateOne(
          { user_id: order.user_id, symbol: order.symbol },
          { $set: { net_qty: newQty, avg_price: newAvgPrice, updated_at: new Date() } }
        );
      }
    } else {
      const existingHolding = await holdings.findOne({ user_id: order.user_id, symbol: order.symbol });
      if (side === 'BUY') {
        if (existingHolding) {
          const totalCost = (Number(existingHolding.avg_price) * Number(existingHolding.qty)) + (livePrice * qty);
          const totalQty = Number(existingHolding.qty) + qty;
          await holdings.updateOne(
            { user_id: order.user_id, symbol: order.symbol },
            { $set: { qty: totalQty, avg_price: totalCost / totalQty, updated_at: new Date() } }
          );
        } else {
          const holdingId = randomUUID();
          await holdings.insertOne({
            _id: holdingId,
            id: holdingId,
            user_id: order.user_id,
            symbol: order.symbol,
            qty,
            avg_price: livePrice,
            updated_at: new Date(),
          });
        }
      } else {
        const newQty = Number(existingHolding.qty) - qty;
        if (newQty === 0) {
          await holdings.deleteOne({ user_id: order.user_id, symbol: order.symbol });
        } else {
          await holdings.updateOne(
            { user_id: order.user_id, symbol: order.symbol },
            { $set: { qty: newQty, updated_at: new Date() } }
          );
        }
      }
    }
    filledCount += 1;
  }

  if (filledCount > 0) {
    console.log(`✅ Executed ${filledCount} pending order(s) after market open.`);
  }
}

async function runAutoIntradaySquareOff() {
  if (intradaySquareOffInFlight) {
    return;
  }

  intradaySquareOffInFlight = true;
  try {
    const marketDate = getMarketDateKey();
    const squareoffRuns = await getCollection('paper_intraday_squareoff_runs');
    const positions = await getCollection('paper_intraday_positions');
    const orders = await getCollection('paper_orders');
    const wallets = await getCollection('paper_wallets');

    const alreadyRun = await squareoffRuns.findOne({ market_date: marketDate });
    if (alreadyRun) {
      return;
    }

    const openPositions = await positions
      .find({ net_qty: { $gt: 0 } })
      .sort({ user_id: 1, symbol: 1 })
      .toArray();

    let closedCount = 0;
    for (const position of openPositions) {
      const qty = Number(position.net_qty);
      const ltp = Number(latestPricesBySymbol.get(position.symbol));
      if (qty <= 0 || !Number.isFinite(ltp) || ltp <= 0) {
        continue;
      }

      const orderId = randomUUID();
      await orders.insertOne({
        _id: orderId,
        id: orderId,
        user_id: position.user_id,
        symbol: position.symbol,
        product_type: 'INTRADAY',
        order_type: 'MARKET',
        side: 'SELL',
        qty,
        price: ltp,
        trigger_price: ltp,
        reserved_amount: 0,
        status: 'FILLED',
        created_at: new Date(),
      });

      await wallets.updateOne(
        { user_id: position.user_id },
        { $inc: { balance: ltp * qty }, $set: { updated_at: new Date() } }
      );

      await positions.deleteOne({ user_id: position.user_id, symbol: position.symbol });
      closedCount += 1;
    }

    await squareoffRuns.insertOne({
      _id: marketDate,
      market_date: marketDate,
      executed_at: new Date(),
    });

    console.log(`⏱️ Auto square-off executed for ${marketDate}: closed ${closedCount} intraday position(s).`);
  } catch (error) {
    console.error('Auto intraday square-off error:', error);
  } finally {
    intradaySquareOffInFlight = false;
  }
}

async function maybeStopPostClosePolling() {
  if (!isMarketClosedNow() || !hasSnapshotForAllTrackedSymbols()) {
    if (!isMarketClosedNow()) {
      marketCloseStopLogged = false;
    }
    return false;
  }

  if (!marketCloseStopLogged) {
    await runAutoIntradaySquareOff();
    console.log("🛑 Post-close polling stopped: all tracked symbols have prices and market is closed.");
    marketCloseStopLogged = true;
  }

  return true;
}

// Poll Angel quote endpoint for tokens you want
async function pollQuotes(exchangeTokensMap = { NSE: ["26000", "50000", "26009"] }) {
  if (await maybeStopPostClosePolling()) {
    return;
  }

  const hasSession = await ensureMarketSession();
  if (!hasSession) {
    return;
  }

  const url = "https://apiconnect.angelbroking.com/rest/secure/angelbroking/market/v1/quote";
  const headers = {
    "X-PrivateKey": API_KEY,
    "Accept": "application/json",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-UserType": "USER",
    "Authorization": `Bearer ${jwtToken}`,
    "Content-Type": "application/json",
  };

  const body = {
    mode: "LTP",
    exchangeTokens: exchangeTokensMap,
  };

  try {
    const resp = await axios.post(url, body, { headers, timeout: 5000 });
    
    // AngelOne API response structure: { success: true, data: { NSE: [...], BSE: [...] } }
    const responseData = resp.data?.data || resp.data;
    
    // Transform the data to include tradingsymbol for easier frontend consumption
    const transformedData = {};
    
    if (responseData && typeof responseData === "object") {
      Object.keys(responseData).forEach((exchange) => {
        const arr = responseData[exchange];
        if (Array.isArray(arr)) {
          transformedData[exchange] = arr.map((item) => {
            // Map token to symbol if we have it in our map
            const token = String(item.symbolToken || item.token || "");
            const tokenData = TOKEN_SYMBOL_MAP[token] || null;
            const mappedSymbol = tokenData ? tokenData.symbol : null;
            
            // Get the symbol from API response or use mapped symbol
            const apiSymbol = item.tradingsymbol || item.symbol || item.name;
            
            // Use mapped symbol if available, otherwise use API symbol
            // Also check alias map for symbol variations
            let finalSymbol = mappedSymbol || apiSymbol;
            if (SYMBOL_ALIAS_MAP[finalSymbol]) {
              finalSymbol = SYMBOL_ALIAS_MAP[finalSymbol];
            }
            
            return {
              ...item,
              symbol: finalSymbol,
              tradingsymbol: finalSymbol,
              symbolToken: token,
              lastTradedPrice: item.lastTradedPrice || item.ltp || item.price,
              displayName: tokenData ? tokenData.display : null,
              exchange: tokenData ? tokenData.exchange : exchange,
            };
          });
        }
      });
    }
    
    // Log summary of updates (reduced logging to avoid spam)
    if (Object.keys(transformedData).length > 0) {
      const totalUpdates = Object.values(transformedData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      if (totalUpdates > 0) {
        console.log(`📊 Emitting ${totalUpdates} market updates`);
      }
    }
    
    // Emit the transformed data
    io.emit("market-tick", transformedData);

    // Cache latest LTP by symbol for leaderboard valuation
    Object.values(transformedData).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item) => {
        const symbol = item.tradingsymbol || item.symbol;
        const ltp = Number(item.lastTradedPrice || item.ltp || item.price);
        if (symbol && Number.isFinite(ltp) && ltp > 0) {
          latestPricesBySymbol.set(symbol, ltp);
        }
      });
    });
  } catch (err) {
    console.error("Polling error:", err.response?.data || err.message);
    // If JWT expired, attempt relogin
    if (err.response?.status === 401) {
      console.log("JWT probably expired, re-authenticating...");
      try {
        jwtToken = null;
        await login();
      } catch (e) {
        console.error("Relogin failed:", e.message || e);
      }
    }
  }
}

// Split tokens into batches to avoid API limit
function splitIntoBatches(array, batchSize = 10) {
  const batches = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

async function pollAllBatches() {
  if (await maybeStopPostClosePolling()) {
    return;
  }

  // Group tokens by exchange
  const tokensByExchange = {};
  Object.entries(TOKEN_SYMBOL_MAP).forEach(([token, data]) => {
    const exchange = data.exchange || 'NSE';
    if (!tokensByExchange[exchange]) {
      tokensByExchange[exchange] = [];
    }
    tokensByExchange[exchange].push(token);
  });
  
  // Poll each exchange in batches
  for (const [exchange, tokens] of Object.entries(tokensByExchange)) {
    const batches = splitIntoBatches(tokens, 10); // API limit is ~10-20 tokens per request
    
    for (const batch of batches) {
      await pollQuotes({ [exchange]: batch });
      // Increased delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 800));
    }
  }

  await executePendingOrdersForOpenMarket();
}

async function startPolling() {
  marketCloseStopLogged = false;

  // initial login
  await ensureMarketSession();
  // Poll for all stocks - get all token IDs from the mapping
  const allTokens = Object.keys(TOKEN_SYMBOL_MAP);
  const exchangeCounts = {};
  Object.values(TOKEN_SYMBOL_MAP).forEach(d => {
    exchangeCounts[d.exchange] = (exchangeCounts[d.exchange] || 0) + 1;
  });
  const stockSymbols = Object.values(TOKEN_SYMBOL_MAP).map(d => d.symbol).join(", ");
  console.log(`📊 Polling for ${allTokens.length} instruments across ${Object.keys(exchangeCounts).join(', ')}`);
  console.log(`📈 Exchange breakdown:`, exchangeCounts);
  console.log(`📈 Stocks: ${stockSymbols}`);

  if (await maybeStopPostClosePolling()) {
    return;
  }

  // start immediate poll and then interval
  await pollAllBatches();

  if (!pollTimer) {
    pollTimer = setInterval(() => pollAllBatches(), pollInterval);
  }
}

// ========================================
// AUTH ENDPOINTS
// ========================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedPhone = phone ? String(phone).replace(/\D/g, '') : null;
    if (normalizedPhone && normalizedPhone.length !== 10) {
      return res.status(400).json({ error: 'Phone must be a valid 10-digit mobile number' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await getUsersCollection();

    // Check if user exists
    const existingUser = await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    if (normalizedPhone) {
      const existingPhone = await users.findOne({ phone: normalizedPhone }, { projection: { _id: 1 } });
      if (existingPhone) {
        return res.status(400).json({ error: 'Phone already registered' });
      }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    // Insert user
    await users.insertOne({
      _id: userId,
      id: userId,
      name,
      email: normalizedEmail,
      phone: normalizedPhone,
      password_hash: passwordHash,
      created_at: new Date(),
    });

    // Generate JWT
    const token = jwt.sign({ id: userId, email: normalizedEmail, name }, getJwtSecret(), { expiresIn: '7d' });

    res.json({
      token,
      user: { id: userId, name, email: normalizedEmail, phone: normalizedPhone }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await getUsersCollection();

    // Find user
    const user = await users.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id || user._id, email: user.email, name: user.name },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id || user._id, name: user.name, email: user.email, phone: user.phone }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const users = await getUsersCollection();
    const user = await users.findOne(
      { $or: [{ _id: req.user.id }, { id: req.user.id }] },
      { projection: { id: 1, name: 1, email: 1, phone: 1, created_at: 1 } }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Request password-reset OTP via mobile number
app.post('/api/auth/request-password-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const users = await getUsersCollection();
    const user = await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } });

    // Avoid user enumeration by returning success even when not found
    if (!user) {
      return res.json({
        success: true,
        message: 'If this email is registered, an OTP has been sent.',
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await sendPasswordResetOtpEmail(normalizedEmail, otp);

    await users.updateOne(
      { _id: user._id },
      { $set: { reset_otp_hash: otpHash, reset_otp_expires_at: expiresAt } }
    );

    return res.json({
      success: true,
      message: `OTP sent to ${normalizedEmail}.`,
    });
  } catch (error) {
    console.error('Request password OTP error:', error);
    return res.status(502).json({ error: error.message || 'Failed to request OTP' });
  }
});

// Reset password with OTP
app.post('/api/auth/reset-password-otp', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and newPassword are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const users = await getUsersCollection();
    const user = await users.findOne(
      { email: normalizedEmail },
      { projection: { _id: 1, reset_otp_hash: 1, reset_otp_expires_at: 1 } }
    );

    if (!user || !user.reset_otp_hash || !user.reset_otp_expires_at) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const expiresAtMs = new Date(user.reset_otp_expires_at).getTime();
    if (!Number.isFinite(expiresAtMs) || Date.now() > expiresAtMs) {
      return res.status(400).json({ error: 'OTP expired. Please request a new one.' });
    }

    const validOtp = await bcrypt.compare(String(otp), user.reset_otp_hash);
    if (!validOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await users.updateOne(
      { _id: user._id },
      { $set: { password_hash: passwordHash }, $unset: { reset_otp_hash: '', reset_otp_expires_at: '' } }
    );

    return res.json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (error) {
    console.error('Reset password OTP error:', error);
    return res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Update user profile
app.post('/api/auth/update-profile', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const users = await getUsersCollection();
    const result = await users.updateOne(
      { $or: [{ _id: req.user.id }, { id: req.user.id }] },
      { $set: { name: name.trim(), updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: { id: req.user.id, name: name.trim(), email: req.user.email }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
app.post('/api/auth/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const users = await getUsersCollection();
    const user = await users.findOne(
      { $or: [{ _id: req.user.id }, { id: req.user.id }] },
      { projection: { _id: 1, password_hash: 1 } }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await users.updateOne(
      { _id: user._id },
      { $set: { password_hash: newPasswordHash, updated_at: new Date() } }
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Delete account
app.post('/api/auth/delete-account', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const users = await getUsersCollection();

    // Delete all user data
    const holdingsCol = await getCollection('paper_holdings');
    const ordersCol = await getCollection('paper_orders');
    const walletsCol = await getCollection('wallets');
    const intradayCol = await getCollection('paper_intraday_positions');

    await Promise.all([
      users.deleteOne({ $or: [{ _id: userId }, { id: userId }] }),
      holdingsCol.deleteMany({ user_id: userId }),
      ordersCol.deleteMany({ user_id: userId }),
      walletsCol.deleteMany({ user_id: userId }),
      intradayCol.deleteMany({ user_id: userId }),
    ]);

    res.json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// ========================================
// PAPER TRADING ENDPOINTS
// ========================================

// Get user's portfolio
app.get('/api/portfolio', authMiddleware, async (req, res) => {
  try {
    const holdingsCol = await getCollection('paper_holdings');
    const positionsCol = await getCollection('paper_intraday_positions');

    const holdings = await holdingsCol
      .find({ user_id: req.user.id, qty: { $gt: 0 } })
      .sort({ symbol: 1 })
      .toArray();
    const intradayPositions = await positionsCol
      .find({ user_id: req.user.id, net_qty: { $ne: 0 } })
      .sort({ symbol: 1 })
      .toArray();

    res.json({
      holdings: holdings.map((row) => ({
        id: row.id || row._id,
        symbol: row.symbol,
        qty: Number(row.qty),
        avgPrice: Number(row.avg_price),
        updated_at: row.updated_at,
      })),
      intradayPositions: intradayPositions.map((row) => ({
        id: row.id || row._id,
        symbol: row.symbol,
        netQty: Number(row.net_qty),
        avgPrice: Number(row.avg_price),
        updated_at: row.updated_at,
      })),
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// Get user's orders
app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    const ordersCol = await getCollection('paper_orders');
    const orders = await ordersCol
      .find({ user_id: req.user.id })
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      orders: orders.map((row) => ({
        id: row.id || row._id,
        symbol: row.symbol,
        productType: row.product_type,
        orderType: row.order_type,
        side: row.side,
        qty: Number(row.qty),
        price: Number(row.price),
        triggerPrice: Number(row.trigger_price),
        reservedAmount: Number(row.reserved_amount || 0),
        status: row.status,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.get('/api/wallet', authMiddleware, async (req, res) => {
  try {
    const wallet = await ensureWallet(req.user.id);
    return res.json({
      wallet: {
        balance: Number(wallet.balance),
        reserved: Number(wallet.reserved),
        available: getWalletAvailableFunds(wallet),
        intradayLeverage: Number(wallet.intraday_leverage || 5),
      },
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    return res.status(500).json({ error: 'Failed to fetch wallet' });
  }
});

app.post('/api/wallet/add-funds', authMiddleware, async (req, res) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be positive' });
    }

    const wallets = await getCollection('paper_wallets');
    await ensureWallet(req.user.id);
    await wallets.updateOne(
      { user_id: req.user.id },
      { $inc: { balance: amount }, $set: { updated_at: new Date() } }
    );

    const wallet = await ensureWallet(req.user.id);
    return res.json({
      success: true,
      wallet: {
        balance: Number(wallet.balance),
        reserved: Number(wallet.reserved),
        available: getWalletAvailableFunds(wallet),
        intradayLeverage: Number(wallet.intraday_leverage || 5),
      },
    });
  } catch (error) {
    console.error('Add funds error:', error);
    return res.status(500).json({ error: 'Failed to add funds' });
  }
});

// Place a paper order
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const { symbol, side, qty, price, productType, orderType = 'MARKET', triggerPrice } = req.body;
    const userId = req.user.id;

    // Validate inputs
    if (!symbol || !side || !qty || !price) {
      return res.status(400).json({ error: 'Symbol, side, qty, and price are required' });
    }

    if (!['BUY', 'SELL'].includes(side.toUpperCase())) {
      return res.status(400).json({ error: 'Side must be BUY or SELL' });
    }

    if (qty <= 0 || price <= 0) {
      return res.status(400).json({ error: 'Quantity and price must be positive' });
    }

    const upperSide = side.toUpperCase();
    const upperSymbol = symbol.toUpperCase();
    const normalizedProductType = String(productType || 'DELIVERY').toUpperCase();
    const normalizedOrderType = String(orderType || 'MARKET').toUpperCase();

    if (!['DELIVERY', 'INTRADAY'].includes(normalizedProductType)) {
      return res.status(400).json({ error: 'productType must be DELIVERY or INTRADAY' });
    }
    if (!['MARKET', 'LIMIT', 'STOP_LOSS'].includes(normalizedOrderType)) {
      return res.status(400).json({ error: 'orderType must be MARKET, LIMIT, or STOP_LOSS' });
    }

    const parsedQty = Number(qty);
    const parsedPrice = Number(price); // market reference price from client
    const parsedTriggerPrice = Number(
      (normalizedOrderType === 'LIMIT' || normalizedOrderType === 'STOP_LOSS') ? triggerPrice : price
    );
    if (!Number.isInteger(parsedQty) || parsedQty <= 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return res.status(400).json({ error: 'Quantity must be a positive integer and price must be positive' });
    }
    if (!Number.isFinite(parsedTriggerPrice) || parsedTriggerPrice <= 0) {
      return res.status(400).json({ error: 'Valid triggerPrice is required' });
    }

    const currentPrice = getLivePriceForSymbol(upperSymbol);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      return res.status(400).json({ error: `Live price unavailable for ${upperSymbol}. Try again in a few seconds.` });
    }
    if ((normalizedOrderType === 'LIMIT' || normalizedOrderType === 'STOP_LOSS') && !isPriceWithinBand(currentPrice, parsedTriggerPrice, 0.1)) {
      const min = (currentPrice * 0.9).toFixed(2);
      const max = (currentPrice * 1.1).toFixed(2);
      return res.status(400).json({ error: `Trigger price must be within ±10% of current price (${min} to ${max})` });
    }

    const marketOpen = isMarketOpenNow();
    const shouldFillNow = marketOpen && (
      shouldFillConditionalOrder(normalizedOrderType, upperSide, currentPrice, parsedTriggerPrice)
    );
    const initialStatus = shouldFillNow ? 'FILLED' : 'PENDING';
    const fillPrice = shouldFillNow ? currentPrice : parsedTriggerPrice;
    const estimatedCost = parsedTriggerPrice * parsedQty;

    const orders = await getCollection('paper_orders');
    const holdings = await getCollection('paper_holdings');
    const positions = await getCollection('paper_intraday_positions');
    const wallets = await getCollection('paper_wallets');

    const wallet = await ensureWallet(userId);
    const availableFunds = getWalletAvailableFunds(wallet);
    if (upperSide === 'BUY') {
      if (availableFunds < estimatedCost) {
        throw new Error(`Insufficient wallet balance. Required ₹${estimatedCost.toFixed(2)}, available ₹${availableFunds.toFixed(2)}`);
      }
    }

    if (normalizedProductType === 'INTRADAY') {
      const existingPosition = await positions.findOne({ user_id: userId, symbol: upperSymbol });

      const currentQty = Number(existingPosition?.net_qty || 0);
      if (upperSide === 'SELL' && currentQty < parsedQty) {
        throw new Error(`Insufficient intraday quantity. You have ${currentQty} shares of ${upperSymbol}`);
      }

      const orderId = randomUUID();
      await orders.insertOne({
        _id: orderId,
        id: orderId,
        user_id: userId,
        symbol: upperSymbol,
        product_type: normalizedProductType,
        order_type: normalizedOrderType,
        side: upperSide,
        qty: parsedQty,
        price: fillPrice,
        trigger_price: parsedTriggerPrice,
        reserved_amount: upperSide === 'BUY' ? estimatedCost : 0,
        status: initialStatus,
        created_at: new Date(),
      });

      if (upperSide === 'BUY') {
        await wallets.updateOne(
          { user_id: userId },
          { $inc: { reserved: estimatedCost }, $set: { updated_at: new Date() } }
        );
      }

      if (shouldFillNow) {
        const newQty = upperSide === 'BUY' ? currentQty + parsedQty : currentQty - parsedQty;
        if (!existingPosition && newQty > 0) {
          const positionId = randomUUID();
          await positions.insertOne({
            _id: positionId,
            id: positionId,
            user_id: userId,
            symbol: upperSymbol,
            net_qty: newQty,
            avg_price: fillPrice,
            updated_at: new Date(),
          });
        } else if (existingPosition && newQty === 0) {
          await positions.deleteOne({ user_id: userId, symbol: upperSymbol });
        } else if (existingPosition && newQty > 0) {
          let newAvgPrice = Number(existingPosition.avg_price || 0);
          if (upperSide === 'BUY') {
            const totalCost = (newAvgPrice * currentQty) + (fillPrice * parsedQty);
            newAvgPrice = totalCost / newQty;
          }
          await positions.updateOne(
            { user_id: userId, symbol: upperSymbol },
            { $set: { net_qty: newQty, avg_price: newAvgPrice, updated_at: new Date() } }
          );
        }

        if (upperSide === 'BUY') {
          const finalCost = fillPrice * parsedQty;
          await wallets.updateOne(
            { user_id: userId },
            { $inc: { reserved: -estimatedCost, balance: -finalCost }, $set: { updated_at: new Date() } }
          );
        } else {
          await wallets.updateOne(
            { user_id: userId },
            { $inc: { balance: fillPrice * parsedQty }, $set: { updated_at: new Date() } }
          );
        }
      }

      res.json({
        success: true,
        orderId,
        status: initialStatus,
        message: initialStatus === 'PENDING'
          ? `${upperSide} ${normalizedProductType} ${normalizedOrderType} order queued as PENDING. It will execute when market opens and conditions match.`
          : `${upperSide} ${normalizedProductType} ${normalizedOrderType} order placed successfully`
      });
      return;
    }

    // DELIVERY flow
    if (upperSide === 'SELL') {
      const holding = await holdings.findOne({ user_id: userId, symbol: upperSymbol }, { projection: { qty: 1 } });

      if (!holding || holding.qty < parsedQty) {
        throw new Error(`Insufficient quantity. You have ${holding?.qty || 0} shares of ${upperSymbol}`);
      }
    }

    const orderId = randomUUID();
    await orders.insertOne({
      _id: orderId,
      id: orderId,
      user_id: userId,
      symbol: upperSymbol,
      product_type: normalizedProductType,
      order_type: normalizedOrderType,
      side: upperSide,
      qty: parsedQty,
      price: fillPrice,
      trigger_price: parsedTriggerPrice,
      reserved_amount: upperSide === 'BUY' ? estimatedCost : 0,
      status: initialStatus,
      created_at: new Date(),
    });

    if (upperSide === 'BUY') {
      await wallets.updateOne(
        { user_id: userId },
        { $inc: { reserved: estimatedCost }, $set: { updated_at: new Date() } }
      );
    }

    if (!shouldFillNow) {
      res.json({
        success: true,
        orderId,
        status: initialStatus,
        message: `${upperSide} ${normalizedProductType} ${normalizedOrderType} order queued as PENDING. It will execute when market opens and conditions match.`
      });
      return;
    }

    const existingHolding = await holdings.findOne({ user_id: userId, symbol: upperSymbol });

    if (upperSide === 'BUY') {
      if (existingHolding) {
        const totalCost = (existingHolding.avg_price * existingHolding.qty) + (fillPrice * parsedQty);
        const totalQty = existingHolding.qty + parsedQty;
        const newAvgPrice = totalCost / totalQty;

        await holdings.updateOne(
          { user_id: userId, symbol: upperSymbol },
          { $set: { qty: totalQty, avg_price: newAvgPrice, updated_at: new Date() } }
        );
      } else {
        const holdingId = randomUUID();
        await holdings.insertOne({
          _id: holdingId,
          id: holdingId,
          user_id: userId,
          symbol: upperSymbol,
          qty: parsedQty,
          avg_price: fillPrice,
          updated_at: new Date(),
        });
      }

      const finalCost = fillPrice * parsedQty;
      await wallets.updateOne(
        { user_id: userId },
        { $inc: { reserved: -estimatedCost, balance: -finalCost }, $set: { updated_at: new Date() } }
      );
    } else {
      const newQty = existingHolding.qty - parsedQty;
      if (newQty === 0) {
        await holdings.deleteOne({ user_id: userId, symbol: upperSymbol });
      } else {
        await holdings.updateOne(
          { user_id: userId, symbol: upperSymbol },
          { $set: { qty: newQty, updated_at: new Date() } }
        );
      }
      await wallets.updateOne(
        { user_id: userId },
        { $inc: { balance: fillPrice * parsedQty }, $set: { updated_at: new Date() } }
      );
    }

    res.json({
      success: true,
      orderId,
      status: initialStatus,
      message: `${upperSide} ${normalizedProductType} ${normalizedOrderType} order placed successfully`
    });
    return;
  } catch (error) {
    console.error('Place order error:', error);
    res.status(400).json({ error: error.message || 'Failed to place order' });
  }
});

// Global leaderboard based on real DB users and their paper trading returns
app.get('/api/leaderboard', async (req, res) => {
  try {
    const period = (req.query.period || '1M').toString();
    const startDate = getLeaderboardWindowStart(period);

    const usersCol = await getUsersCollection();
    const ordersCol = await getCollection('paper_orders');
    const holdingsCol = await getCollection('paper_holdings');

    const users = await usersCol
      .find({}, { projection: { id: 1, name: 1 } })
      .sort({ name: 1 })
      .toArray();
    const rankings = [];

    for (const user of users) {
      const userId = user.id || user._id;
      const orderQuery = { user_id: userId, status: 'FILLED' };
      if (startDate) {
        orderQuery.created_at = { $gte: startDate };
      }

      const orders = await ordersCol
        .find(orderQuery, { projection: { symbol: 1, side: 1, qty: 1, price: 1 } })
        .sort({ created_at: 1 })
        .toArray();

      if (orders.length === 0) {
        continue;
      }

      const holdings = await holdingsCol
        .find({ user_id: userId, qty: { $gt: 0 } }, { projection: { symbol: 1, qty: 1 } })
        .toArray();

      let buyValue = 0;
      let sellValue = 0;
      let sellCount = 0;
      const buysBySymbol = new Map();

      orders.forEach((o) => {
        const value = Number(o.qty) * Number(o.price);
        if (o.side === 'BUY') {
          buyValue += value;
          const agg = buysBySymbol.get(o.symbol) || { qty: 0, value: 0 };
          agg.qty += Number(o.qty);
          agg.value += value;
          buysBySymbol.set(o.symbol, agg);
        } else if (o.side === 'SELL') {
          sellValue += value;
          sellCount += 1;
        }
      });

      let holdingsValue = 0;
      holdings.forEach((h) => {
        const ltp = latestPricesBySymbol.get(h.symbol);
        if (ltp && Number.isFinite(ltp)) {
          holdingsValue += Number(h.qty) * ltp;
        }
      });

      const equityValue = sellValue + holdingsValue;
      const pnl = equityValue - buyValue;
      const returnPct = buyValue > 0 ? (pnl / buyValue) * 100 : 0;

      // Approx win-rate: profitable sells over all sells using weighted avg historical buy
      let winningSells = 0;
      if (sellCount > 0) {
        orders.forEach((o) => {
          if (o.side !== 'SELL') return;
          const agg = buysBySymbol.get(o.symbol);
          if (!agg || agg.qty <= 0) return;
          const avgBuy = agg.value / agg.qty;
          if (Number(o.price) > avgBuy) {
            winningSells += 1;
          }
        });
      }

      rankings.push({
        user: user.name,
        return: returnPct,
        pnl,
        trades: orders.length,
        winRate: sellCount > 0 ? (winningSells / sellCount) * 100 : 0,
      });
    }

    rankings.sort((a, b) => b.return - a.return);

    const leaderboard = rankings.map((row, idx) => ({
      rank: idx + 1,
      ...row,
    }));

    res.json({
      period: period.toUpperCase(),
      leaderboard,
      summary: {
        totalRankedTraders: leaderboard.length,
        averageWinRate: leaderboard.length > 0
          ? leaderboard.reduce((acc, cur) => acc + cur.winRate, 0) / leaderboard.length
          : 0,
      },
    });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ========================================
// ML INSIGHTS API ROUTES
// ========================================

const STOCKS_BY_SECTOR = {
  Banking: ['HDFCBANK', 'ICICIBANK', 'KOTAKBANK', 'AXISBANK', 'SBIN'],
  Financial_Services: ['BAJFINANCE', 'BAJAJFINSV'],
  Information_Technology: ['TCS', 'INFY', 'HCLTECH', 'WIPRO'],
  Telecom: ['BHARTIARTL'],
  Oil_Gas_Energy: ['RELIANCE', 'ONGC', 'NTPC', 'COALINDIA'],
  Power_Utilities: ['POWERGRID'],
  Automobile: ['MARUTI', 'TATAMOTORS', 'HEROMOTOCO', 'EICHERMOT', 'M&M', 'BAJAJ-AUTO', 'TVSMOTOR', 'ASHOKLEY'],
  Pharma_Healthcare: ['SUNPHARMA', 'DIVISLAB', 'CIPLA', 'LUPIN'],
  FMCG_Consumer: ['HINDUNILVR', 'ITC', 'NESTLEIND', 'DABUR', 'BRITANNIA', 'GODREJCP', 'COLPAL'],
  Metals_Mining: ['JSWSTEEL', 'VEDL', 'HINDALCO', 'TATASTEEL'],
  Cement_BuildingMaterials: ['ULTRACEMCO', 'AMBUJACEM', 'SHREECEM'],
  Construction_Infrastructure: ['LT'],
  Conglomerate: ['ADANIENT', 'GRASIM'],
  Logistics_Port: ['ADANIPORTS'],
  Paints_Chemicals: ['ASIANPAINT', 'BERGEPAINT', 'PIDILITIND'],
  Retail_Luxury_Jewellery: ['TITAN'],
  Technology_Hardware: ['BBOX'],
};

const SYMBOL_SECTOR_MAP = Object.entries(STOCKS_BY_SECTOR).reduce((acc, [sector, symbols]) => {
  const displaySector = String(sector || '').replace(/_/g, ' ').trim();
  symbols.forEach((rawSymbol) => {
    const symbol = String(rawSymbol || '').trim().toUpperCase();
    if (!symbol) return;
    acc[symbol] = displaySector;
    acc[normalizeSymbolKey(symbol)] = displaySector;
  });
  return acc;
}, {});

const REAL_MODEL_INFO = {
  name: 'Gradient Boosting Regressor',
  r2_score: null,
};
const ML_PYTHON_PATH = process.env.ML_PYTHON_PATH || '/Users/rudrajena/Desktop/Trade_Insights/.venv/bin/python';
const ML_RUNNER_PATH = process.env.ML_RUNNER_PATH || '/Users/rudrajena/Desktop/Trade_Insights/Website/src/ml/real_model_runner.py';

const SYMBOL_INDUSTRY_MAP = {
  RELIANCE: 'Oil & Gas Integrated',
  ONGC: 'Oil & Gas Integrated',
  COALINDIA: 'Thermal Coal',
  NTPC: 'Utilities - Regulated Electric',
  POWERGRID: 'Utilities - Regulated Electric',
  TCS: 'Software - Infrastructure',
  INFY: 'Software - Infrastructure',
  WIPRO: 'Software - Infrastructure',
  HCLTECH: 'Software - Infrastructure',
  HDFCBANK: 'Banks - Regional',
  ICICIBANK: 'Banks - Regional',
  KOTAKBANK: 'Banks - Regional',
  AXISBANK: 'Banks - Regional',
  SBIN: 'Banks - Regional',
  BAJFINANCE: 'Credit Services',
  BAJAJFINSV: 'Credit Services',
  BHARTIARTL: 'Telecom Services',
  TATASTEEL: 'Steel',
  JSWSTEEL: 'Steel',
  PIDILITIND: 'Specialty Chemicals',
};

function normalizeSymbolKey(symbol = '') {
  return String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_');
}

function getSectorForSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  return SYMBOL_SECTOR_MAP[raw] || SYMBOL_SECTOR_MAP[normalizeSymbolKey(raw)] || 'Other';
}

function toModelSectorCategory(displaySector = '') {
  const s = String(displaySector || '').trim().toLowerCase();
  if (s === 'banking' || s === 'financial services') return 'Financial Services';
  if (s === 'information technology' || s === 'technology hardware') return 'Technology';
  if (s === 'telecom') return 'Communication Services';
  if (s === 'oil gas energy') return 'Energy';
  if (s === 'power utilities') return 'Utilities';
  if (s === 'automobile' || s === 'retail luxury jewellery') return 'Consumer Cyclical';
  if (s === 'fmcg consumer') return 'Consumer Defensive';
  if (s === 'metals mining' || s === 'cement buildingmaterials' || s === 'construction infrastructure' || s === 'logistics port' || s === 'paints chemicals') {
    return 'Industrials';
  }
  return 'Others';
}

function getIndustryForSymbol(symbol) {
  const raw = String(symbol || '').trim().toUpperCase();
  return SYMBOL_INDUSTRY_MAP[raw] || SYMBOL_INDUSTRY_MAP[normalizeSymbolKey(raw)] || 'Others';
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value) {
  return Math.round(num(value) * 100) / 100;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = mean(values.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

function safeWinRate(positive, total) {
  if (!total) return 0;
  return (positive / total) * 100;
}

function toMonthName(date) {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? 'January' : d.toLocaleString('en-US', { month: 'long' });
}

function toDayName(date) {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? 'Monday' : d.toLocaleString('en-US', { weekday: 'long' });
}

function toDayNum(date) {
  const d = date instanceof Date ? date : new Date(date);
  const n = d.getDate();
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function toMinutesOfDay(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return 570;
  return (d.getHours() * 60) + d.getMinutes();
}

function toModelFeatureName(raw = '') {
  const s = String(raw || '').replace(/_/g, ' ').trim();
  return s;
}

function runRealModel(payload) {
  const proc = spawnSync(ML_PYTHON_PATH, [ML_RUNNER_PATH], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    timeout: 20000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (proc.error) {
    throw new Error(`ML runner process error: ${proc.error.message}`);
  }
  if (proc.status !== 0) {
    throw new Error(`ML runner exited with code ${proc.status}: ${proc.stderr || 'unknown error'}`);
  }

  const out = JSON.parse(proc.stdout || '{}');
  if (!out.ok) {
    throw new Error(out.error || 'ML runner returned an error');
  }
  return out;
}

function buildRecommendationFromPnl(avgPnl) {
  if (avgPnl > 0) return 'Best';
  if (avgPnl > -100) return 'Average';
  return 'Caution';
}

function buildFeatureImportance(holdingRows, holdingValueBySymbol, totalHoldingValue, totalOrders, bestTimeWinRate) {
  const allocations = Object.values(holdingValueBySymbol);
  const maxAllocationPct = totalHoldingValue > 0 ? Math.max(...allocations, 0) / totalHoldingValue : 0;

  const avgPriceDeviation = mean(
    holdingRows.map((h) => {
      if (!h.avg_price) return 0;
      const ltp = num(h.ltp, h.avg_price);
      return Math.abs((ltp - h.avg_price) / h.avg_price);
    })
  );

  const sectors = new Set(holdingRows.map((h) => h.sector));
  const rawFactors = [
    { feature: 'Portfolio Allocation', value: maxAllocationPct, category: 'Risk' },
    { feature: 'Price Deviation', value: avgPriceDeviation, category: 'Price' },
    { feature: 'Trade Frequency', value: totalOrders / Math.max(holdingRows.length, 1), category: 'Activity' },
    { feature: 'Time Accuracy', value: bestTimeWinRate / 100, category: 'Timing' },
    { feature: 'Sector Diversification', value: sectors.size / Math.max(holdingRows.length, 1), category: 'Diversification' },
    { feature: 'Holding Count', value: holdingRows.length / 10, category: 'Portfolio' },
  ];

  const sumRaw = rawFactors.reduce((sum, item) => sum + Math.max(item.value, 0), 0) || 1;
  return rawFactors
    .map((item) => ({
      feature: item.feature,
      importance: round2(Math.max(item.value, 0) / sumRaw),
      category: item.category,
    }))
    .sort((a, b) => b.importance - a.importance);
}

function buildRecommendations({
  totalUnrealizedPnl,
  totalHoldingValue,
  topHolding,
  bestTime,
  worstSector,
  hasOrders,
}) {
  const list = [];

  if (topHolding && topHolding.allocation_pct >= 35) {
    list.push({
      title: 'Concentration Risk Alert',
      description: `${topHolding.symbol} is ${round2(topHolding.allocation_pct)}% of your portfolio. Consider rebalancing.`,
      impact: 'Risk reduction',
      confidence: 'High',
    });
  }

  if (bestTime) {
    list.push({
      title: 'Best Entry Window',
      description: `Your strongest entry window is ${bestTime.time} with ${bestTime.win_rate} win rate.`,
      impact: 'Improve strike rate',
      confidence: 'Medium',
    });
  }

  if (worstSector && num(worstSector.avg_pnl) < 0) {
    list.push({
      title: 'Weak Sector Flag',
      description: `${worstSector.sector} is currently underperforming in your portfolio.`,
      impact: `${round2(worstSector.avg_pnl)} P&L avg`,
      confidence: 'Medium',
    });
  }

  if (!list.length) {
    list.push({
      title: 'Portfolio Baseline Ready',
      description: 'Your current holdings data is being tracked. Add more executed trades for deeper predictions.',
      impact: hasOrders ? `${round2(totalUnrealizedPnl)} unrealized P&L` : 'More data needed',
      confidence: 'Medium',
    });
  }

  if (totalHoldingValue > 0 && totalUnrealizedPnl < 0) {
    list.push({
      title: 'Drawdown Control',
      description: 'Current holdings are in drawdown. Use tighter stop-loss for new entries on weak symbols.',
      impact: 'Protect capital',
      confidence: 'High',
    });
  }

  return list.slice(0, 3);
}

function buildModelFeatureRow({
  qty,
  buyPrice,
  sellPrice,
  buyDate,
  sellDate,
  sector,
  industry,
  remark,
  totalCharges,
  holdingPeriodDays,
}) {
  return {
    Quantity: Math.max(1, Math.round(num(qty, 1))),
    'Buy price': round2(num(buyPrice, sellPrice)),
    Remark: remark || 'Delivery Trade',
    Sector: sector || 'Others',
    Industry: industry || 'Others',
    'Buy Month': toMonthName(buyDate),
    'Buy Day': toDayNum(buyDate),
    'Buy Day of Week': toDayName(buyDate),
    'Sell Month': toMonthName(sellDate),
    'Sell Day': toDayNum(sellDate),
    'Sell Day of Week': toDayName(sellDate),
    'Buy Time Minutes': toMinutesOfDay(buyDate),
    'Sell Time Minutes': toMinutesOfDay(sellDate),
    'Total Charges': round2(Math.max(0, num(totalCharges, 0))),
    'Holding Period (Days)': Math.max(1, Math.round(num(holdingPeriodDays, 1))),
    'Buy/Sell Price Ratio': round2(num(buyPrice, 1) / Math.max(num(sellPrice, 1), 0.01)),
  };
}

function riskLevelFromScore(score) {
  if (score >= 65) return 'High';
  if (score >= 35) return 'Medium';
  return 'Low';
}

// Get ML insights and feature importance
app.get('/api/ml/insights', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const holdingsCol = await getCollection('paper_holdings');
    const ordersCol = await getCollection('paper_orders');

    const holdings = await holdingsCol
      .find({ user_id: userId, qty: { $gt: 0 } }, { projection: { symbol: 1, qty: 1, avg_price: 1 } })
      .sort({ symbol: 1 })
      .toArray();

    if (!holdings.length) {
      const modelMeta = runRealModel({ mode: 'meta' });
      return res.json({
        model_status: 'no_data',
        model_info: {
          name: REAL_MODEL_INFO.name,
          r2_score: REAL_MODEL_INFO.r2_score,
          last_trained: null,
          required_features: modelMeta.requiredFeatures || [],
        },
        holdings: [],
        feature_importance: (modelMeta.featureImportance || []).map((f) => ({
          feature: toModelFeatureName(f.feature),
          importance: round2(num(f.importance, 0)),
          importance_pct: round2(num(f.importancePct, 0)),
        })),
        expected_move_and_risk: [],
        model_alerts: [],
        trading_insights: {
          best_trading_times: { description: 'No holdings available', data: [] },
          sector_performance: { description: 'No holdings available', data: [] },
          day_of_week_analysis: { description: 'No holdings available', data: [] },
          recommendations: [
            {
              title: 'Add Holdings To Unlock Insights',
              description: 'Place paper trades and hold positions to generate personalized ML graphs.',
              impact: 'No active holdings',
              confidence: 'High',
            },
          ],
        },
        summary: {
          holdingCount: 0,
          totalHoldingValue: 0,
          totalUnrealizedPnl: 0,
        },
      });
    }

    const symbols = holdings.map((h) => h.symbol);

    const orders = await ordersCol
      .find(
        { user_id: userId, status: 'FILLED', symbol: { $in: symbols } },
        { projection: { symbol: 1, side: 1, qty: 1, price: 1, created_at: 1, product_type: 1 } }
      )
      .sort({ created_at: 1 })
      .toArray();

    const holdingRows = holdings.map((h) => {
      const ltp = num(latestPricesBySymbol.get(h.symbol), h.avg_price);
      const holdingValue = ltp * num(h.qty);
      const unrealizedPnl = (ltp - num(h.avg_price)) * num(h.qty);
      return {
        symbol: h.symbol,
        qty: num(h.qty),
        avg_price: num(h.avg_price),
        ltp,
        sector: getSectorForSymbol(h.symbol),
        unrealized_pnl: round2(unrealizedPnl),
        holding_value: round2(holdingValue),
      };
    });

    const totalHoldingValue = holdingRows.reduce((sum, h) => sum + h.holding_value, 0);
    const totalUnrealizedPnl = holdingRows.reduce((sum, h) => sum + h.unrealized_pnl, 0);

    const holdingValueBySymbol = {};
    holdingRows.forEach((h) => {
      holdingValueBySymbol[h.symbol] = h.holding_value;
      h.allocation_pct = totalHoldingValue > 0 ? round2((h.holding_value / totalHoldingValue) * 100) : 0;
    });

    const sectorStats = new Map();
    const hourStats = new Map();
    const dayStats = new Map();

    orders.forEach((o) => {
      if (o.side !== 'BUY') return;

      const symbol = o.symbol;
      const ltp = num(latestPricesBySymbol.get(symbol), o.price);
      const pnl = (ltp - num(o.price)) * num(o.qty);
      const sector = getSectorForSymbol(symbol);

      const sectorAgg = sectorStats.get(sector) || { pnlSum: 0, trades: 0 };
      sectorAgg.pnlSum += pnl;
      sectorAgg.trades += 1;
      sectorStats.set(sector, sectorAgg);

      const date = new Date(o.created_at);
      const hour = Number.isFinite(date.getHours()) ? date.getHours() : 9;
      const timeKey = `${String(hour).padStart(2, '0')}:00-${String(hour).padStart(2, '0')}:59`;
      const timeAgg = hourStats.get(timeKey) || { pnlSum: 0, wins: 0, total: 0 };
      timeAgg.pnlSum += pnl;
      timeAgg.wins += pnl > 0 ? 1 : 0;
      timeAgg.total += 1;
      hourStats.set(timeKey, timeAgg);

      const day = Number.isFinite(date.getDay()) ? date.toLocaleDateString('en-US', { weekday: 'long' }) : 'Unknown';
      const dayAgg = dayStats.get(day) || { pnlSum: 0, total: 0 };
      dayAgg.pnlSum += pnl;
      dayAgg.total += 1;
      dayStats.set(day, dayAgg);
    });

    if (!sectorStats.size) {
      holdingRows.forEach((h) => {
        const s = sectorStats.get(h.sector) || { pnlSum: 0, trades: 0 };
        s.pnlSum += h.unrealized_pnl;
        s.trades += 1;
        sectorStats.set(h.sector, s);
      });
    }

    const sectorPerformance = Array.from(sectorStats.entries())
      .map(([sector, agg]) => ({
        sector,
        avg_pnl: round2(agg.trades > 0 ? agg.pnlSum / agg.trades : 0),
        trades: agg.trades,
      }))
      .sort((a, b) => b.avg_pnl - a.avg_pnl)
      .slice(0, 8);

    const bestTradingTimes = Array.from(hourStats.entries())
      .map(([time, agg]) => ({
        time,
        avg_pnl: round2(agg.total > 0 ? agg.pnlSum / agg.total : 0),
        win_rate: `${round2(safeWinRate(agg.wins, agg.total))}%`,
      }))
      .sort((a, b) => num(b.win_rate.replace('%', '')) - num(a.win_rate.replace('%', '')))
      .slice(0, 6);

    const weekOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const dayOfWeekAnalysis = Array.from(dayStats.entries())
      .map(([day, agg]) => ({
        day,
        avg_pnl: round2(agg.total > 0 ? agg.pnlSum / agg.total : 0),
        recommendation: buildRecommendationFromPnl(agg.total > 0 ? agg.pnlSum / agg.total : 0),
      }))
      .sort((a, b) => weekOrder.indexOf(a.day) - weekOrder.indexOf(b.day));

    const bestTime = bestTradingTimes[0] || null;
    const now = new Date();
    const buyOrdersBySymbol = new Map();
    orders
      .filter((o) => String(o.side || '').toUpperCase() === 'BUY')
      .forEach((o) => {
        const key = String(o.symbol || '').toUpperCase();
        const existing = buyOrdersBySymbol.get(key);
        if (!existing || new Date(o.created_at).getTime() > new Date(existing.created_at).getTime()) {
          buyOrdersBySymbol.set(key, o);
        }
      });

    const scenarioMultipliers = [0.94, 0.96, 0.98, 1.0, 1.02, 1.04, 1.06];
    const modelRows = [];
    const modelSlices = [];

    holdingRows.forEach((h) => {
      const buyOrder = buyOrdersBySymbol.get(String(h.symbol || '').toUpperCase());
      const buyDate = buyOrder ? new Date(buyOrder.created_at) : new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
      const ltp = num(h.ltp, h.avg_price);
      const buyPrice = num(buyOrder?.price, h.avg_price || ltp);
      const qty = num(h.qty, 1);
      const rawSector = h.sector || getSectorForSymbol(h.symbol);
      const sector = toModelSectorCategory(rawSector);
      const industry = getIndustryForSymbol(h.symbol);
      const remark = String(buyOrder?.product_type || '').toUpperCase() === 'INTRADAY' ? 'Intraday trade' : 'Delivery Trade';
      const holdingPeriodDays = Math.max(1, Math.round((now.getTime() - buyDate.getTime()) / (24 * 60 * 60 * 1000)));
      const totalCharges = 0;

      const startIdx = modelRows.length;
      scenarioMultipliers.forEach((m) => {
        const sellPrice = round2(ltp * m);
        modelRows.push(
          buildModelFeatureRow({
            qty,
            buyPrice,
            sellPrice,
            buyDate,
            sellDate: now,
            sector,
            industry,
            remark,
            totalCharges,
            holdingPeriodDays,
          })
        );
      });
      const endIdx = modelRows.length;
      modelSlices.push({
        symbol: h.symbol,
        ltp,
        startIdx,
        endIdx,
        baseIndex: startIdx + 3,
      });
    });

    const modelResult = runRealModel({ mode: 'predict_batch', rows: modelRows });
    const featureImportance = (modelResult.featureImportance || []).map((f) => ({
      feature: toModelFeatureName(f.feature),
      importance: round2(num(f.importance, 0)),
      importance_pct: round2(num(f.importancePct, 0)),
    }));

    const expectedMoveAndRisk = modelSlices.map((s) => {
      const preds = modelResult.predictions.slice(s.startIdx, s.endIdx);
      const drivers = modelResult.topDrivers.slice(s.startIdx, s.endIdx);
      const scenarioRows = scenarioMultipliers.map((m, idx) => ({
        multiplier: m,
        price: round2(s.ltp * m),
        prediction: num(preds[idx]),
      }));
      const positive = scenarioRows.filter((row) => row.prediction >= 0);
      const selectedRows = positive.length >= 2
        ? positive
        : [...scenarioRows].sort((a, b) => b.prediction - a.prediction).slice(0, 3);

      const downsideProbability = scenarioRows.length
        ? scenarioRows.filter((row) => row.prediction < 0).length / scenarioRows.length
        : 0.5;
      const volatilityComponent = Math.min(100, (stdDev(preds) / Math.max(Math.abs(mean(preds)), 1)) * 100);
      const riskScore = round2(Math.min(100, (downsideProbability * 70) + (volatilityComponent * 0.3)));
      const driverFeature = toModelFeatureName(drivers[s.baseIndex - s.startIdx]?.feature || '');
      const downsidePct = round2(downsideProbability * 100);
      const reason = downsideProbability >= 0.5
        ? `High risk (${downsidePct}% downside). Main factor: ${driverFeature || 'price trend'}.`
        : `Lower risk right now. Main factor: ${driverFeature || 'price trend'}.`;

      return {
        symbol: s.symbol,
        current_price: round2(s.ltp),
        expected_lower: round2(Math.min(...selectedRows.map((r) => r.price))),
        expected_upper: round2(Math.max(...selectedRows.map((r) => r.price))),
        model_prediction_now: round2(num(preds[s.baseIndex - s.startIdx], 0)),
        downside_probability: round2(downsideProbability * 100),
        risk_score: riskScore,
        risk_level: riskLevelFromScore(riskScore),
        reason,
      };
    });

    const modelAlerts = expectedMoveAndRisk
      .filter((row) => row.risk_level === 'High' || row.downside_probability >= 50)
      .map((row) => ({
        symbol: row.symbol,
        message: row.risk_level === 'High'
          ? `High risk: price may be unstable right now.`
          : `Caution: chance of downside is higher than usual.`,
      }))
      .slice(0, 6);

    const topFeature = featureImportance[0]?.feature || 'N/A';
    const bestExpected = [...expectedMoveAndRisk].sort((a, b) => num(b.model_prediction_now) - num(a.model_prediction_now))[0] || null;
    const highestRisk = [...expectedMoveAndRisk].sort((a, b) => num(b.risk_score) - num(a.risk_score))[0] || null;
    const lowestRisk = [...expectedMoveAndRisk].sort((a, b) => num(a.risk_score) - num(b.risk_score))[0] || null;
    const modelActionableInsights = [];
    if (bestExpected) {
      modelActionableInsights.push({
        title: 'Best setup today',
        description: `${bestExpected.symbol} looks strongest now. Expected range: ₹${bestExpected.expected_lower} to ₹${bestExpected.expected_upper}.`,
      });
    }
    if (highestRisk) {
      modelActionableInsights.push({
        title: 'High risk stock',
        description: `${highestRisk.symbol} looks risky now. Chance of downside is ${round2(highestRisk.downside_probability)}%.`,
      });
    }
    if (lowestRisk) {
      modelActionableInsights.push({
        title: 'More stable stock',
        description: `${lowestRisk.symbol} looks relatively safer compared to your other holdings.`,
      });
    }
    modelActionableInsights.push({
      title: 'Key reason',
      description: `The model is mainly reacting to ${topFeature}.`,
    });

    return res.json({
      model_status: 'ready',
      model_info: {
        name: REAL_MODEL_INFO.name,
        r2_score: REAL_MODEL_INFO.r2_score,
        last_trained: new Date().toISOString().slice(0, 10),
        required_features: modelResult.requiredFeatures || [],
      },
      holdings: holdingRows,
      feature_importance: featureImportance,
      expected_move_and_risk: expectedMoveAndRisk,
      model_alerts: modelAlerts,
      model_actionable_insights: modelActionableInsights.slice(0, 6),
      trading_insights: {
        best_trading_times: {
          description: 'Entry windows derived from your executed BUY orders for currently held symbols',
          data: bestTradingTimes,
        },
        sector_performance: {
          description: 'Sector performance from your current holdings and live mark-to-market values',
          data: sectorPerformance,
        },
        day_of_week_analysis: {
          description: 'Day-wise performance based on your order timestamps and current market price context',
          data: dayOfWeekAnalysis,
        },
        recommendations: modelActionableInsights.slice(0, 6),
      },
      summary: {
        holdingCount: holdingRows.length,
        totalHoldingValue: round2(totalHoldingValue),
        totalUnrealizedPnl: round2(totalUnrealizedPnl),
      },
    });
  } catch (error) {
    console.error('ML insights error:', error);
    res.status(500).json({ error: 'Failed to fetch ML insights' });
  }
});

// Predict trade P&L
app.post('/api/ml/predict', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const tradeData = req.body;
    
    // Validate required fields
    const required = ['quantity', 'buy_price', 'sell_price', 'symbol'];
    const missing = required.filter(field => !tradeData[field]);
    
    if (missing.length > 0) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }

    const symbol = String(tradeData.symbol).trim().toUpperCase();
    const holdingsCol = await getCollection('paper_holdings');
    const ordersCol = await getCollection('paper_orders');

    const holding = await holdingsCol.findOne(
      { user_id: userId, symbol, qty: { $gt: 0 } },
      { projection: { symbol: 1, qty: 1, avg_price: 1 } }
    );

    if (!holding) {
      return res.status(400).json({
        error: 'Prediction is only available for symbols in your current holdings',
      });
    }
    
    // Calculate values
    const quantity = parseFloat(tradeData.quantity);
    const buyPrice = parseFloat(tradeData.buy_price);
    const sellPrice = parseFloat(tradeData.sell_price);

    if (!Number.isFinite(quantity) || !Number.isFinite(buyPrice) || !Number.isFinite(sellPrice) || quantity <= 0 || buyPrice <= 0 || sellPrice <= 0) {
      return res.status(400).json({ error: 'Quantity, buy_price and sell_price must be positive numbers' });
    }

    const buyValue = quantity * buyPrice;
    const sellValue = quantity * sellPrice;
    const currentLtp = num(latestPricesBySymbol.get(symbol), holding.avg_price);
      const sector = toModelSectorCategory(getSectorForSymbol(symbol));
    const industry = getIndustryForSymbol(symbol);

    const symbolOrders = await ordersCol
      .find(
        { user_id: userId, symbol, status: 'FILLED' },
        { projection: { side: 1, qty: 1, price: 1, created_at: 1 } }
      )
      .sort({ created_at: 1 })
      .toArray();

    const now = new Date();
    const firstBuy = symbolOrders.find((o) => String(o.side || '').toUpperCase() === 'BUY');
    const buyDate = firstBuy ? new Date(firstBuy.created_at) : new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    const holdingPeriodDays = Math.max(1, Math.round((now.getTime() - buyDate.getTime()) / (24 * 60 * 60 * 1000)));
    const remark = String(tradeData.product_type || 'DELIVERY').toUpperCase() === 'INTRADAY' ? 'Intraday trade' : 'Delivery Trade';

    const modelRow = buildModelFeatureRow({
      qty: quantity,
      buyPrice,
      sellPrice,
      buyDate,
      sellDate: now,
      sector,
      industry,
      remark,
      totalCharges: 0,
      holdingPeriodDays,
    });
    const modelResult = runRealModel({ mode: 'predict_batch', rows: [modelRow] });
    const predictedPnl = round2(num(modelResult.predictions?.[0], 0));
    const topDriver = toModelFeatureName(modelResult.topDrivers?.[0]?.feature || '');
    const driverScore = round2(num(modelResult.topDrivers?.[0]?.score, 0));

    const scenarioRows = [0.96, 0.98, 1.0, 1.02, 1.04].map((m) =>
      buildModelFeatureRow({
        qty: quantity,
        buyPrice,
        sellPrice: round2(sellPrice * m),
        buyDate,
        sellDate: now,
        sector,
        industry,
        remark,
        totalCharges: 0,
        holdingPeriodDays,
      })
    );
    const scenarioResult = runRealModel({ mode: 'predict_batch', rows: scenarioRows });
    const scenarioPreds = scenarioResult.predictions || [];
    const downsideProbability = scenarioPreds.length
      ? scenarioPreds.filter((p) => num(p) < 0).length / scenarioPreds.length
      : 0.5;
    const confidence = round2(Math.max(0.35, Math.min(0.95, 1 - downsideProbability)));
    
    const response = {
      prediction: Math.round(predictedPnl * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
      trade_metrics: {
        buy_value: Math.round(buyValue * 100) / 100,
        sell_value: Math.round(sellValue * 100) / 100,
        potential_return_pct: Math.round(((sellValue - buyValue) / buyValue) * 10000) / 100,
        current_holding_qty: num(holding.qty),
        current_avg_price: round2(holding.avg_price),
        current_ltp: round2(currentLtp),
      },
      factors: {
        model_driver: topDriver || 'N/A',
        model_driver_score: driverScore,
        downside_probability: round2(downsideProbability * 100),
        sector,
        industry,
      },
      recommendation: predictedPnl > 0 ? 'Favorable' : 'Unfavorable',
    };
    
    res.json(response);
  } catch (error) {
    console.error('ML prediction error:', error);
    res.status(500).json({ error: 'Failed to generate prediction' });
  }
});

// Get user's historical P&L analysis
app.get('/api/ml/analysis', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's orders
    const ordersCol = await getCollection('paper_orders');
    const orders = await ordersCol
      .find(
        { user_id: userId, status: 'FILLED' },
        { projection: { symbol: 1, side: 1, qty: 1, price: 1, created_at: 1 } }
      )
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
    
    if (!orders || orders.length === 0) {
      return res.json({
        message: 'No trading history available for analysis',
        analysis: null
      });
    }
    
    // Calculate metrics
    const totalTrades = orders.length;
    const profitableTrades = orders.filter(o => o.side === 'SELL').length;
    const totalPnl = orders.reduce((sum, o) => sum + ((o.side === 'SELL' ? 1 : -1) * parseFloat(o.price || 0) * parseFloat(o.qty || 0)), 0);
    const avgPnl = totalPnl / totalTrades;
    const winRate = (profitableTrades / totalTrades) * 100;
    
    // Group by symbol for top performers
    const bySymbol = {};
    orders.forEach(o => {
      if (!bySymbol[o.symbol]) {
        bySymbol[o.symbol] = { pnl: 0, count: 0 };
      }
      bySymbol[o.symbol].pnl += (o.side === 'SELL' ? 1 : -1) * parseFloat(o.price || 0) * parseFloat(o.qty || 0);
      bySymbol[o.symbol].count += 1;
    });
    
    const topSymbols = Object.entries(bySymbol)
      .map(([symbol, data]) => ({ symbol, ...data }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);
    
    const analysis = {
      total_trades: totalTrades,
      profitable_trades: profitableTrades,
      total_pnl: Math.round(totalPnl * 100) / 100,
      avg_pnl_per_trade: Math.round(avgPnl * 100) / 100,
      win_rate: Math.round(winRate * 100) / 100,
      top_performers: topSymbols,
      ml_recommendations: [
        winRate < 50 ? 'Consider reviewing entry timing based on model analysis' : 'Good win rate, consider increasing position sizes',
        avgPnl < 0 ? 'Average trade is losing. Review risk management strategy' : 'Positive average P&L per trade',
        profitableTrades > totalTrades * 0.6 ? 'Strong performance. Model suggests scaling up' : 'Focus on improving entry quality'
      ]
    };
    
    res.json(analysis);
  } catch (error) {
    console.error('ML analysis error:', error);
    res.status(500).json({ error: 'Failed to generate analysis' });
  }
});

app.get('/api/market/intraday-candles', authMiddleware, async (req, res) => {
  try {
    const symbol = normalizeTradingSymbol(req.query.symbol);
    const interval = String(req.query.interval || 'FIVE_MINUTE').toUpperCase();
    const points = Number(req.query.points || 300);

    if (!symbol) {
      return res.status(400).json({ error: 'symbol query parameter is required' });
    }
    if (!ALLOWED_INTRADAY_INTERVALS.has(interval)) {
      return res.status(400).json({ error: 'Invalid interval for intraday candles' });
    }
    if (!Number.isInteger(points) || points < 10 || points > 1000) {
      return res.status(400).json({ error: 'points must be an integer between 10 and 1000' });
    }

    const token = getTokenForSymbol(symbol);
    if (!token) {
      return res.status(400).json({ error: `Symbol ${symbol} is not mapped for market data` });
    }

    const exchange = SYMBOL_EXCHANGE_MAP[symbol] || 'NSE';
    const hasSession = await ensureMarketSession();
    if (!hasSession) {
      return res.status(503).json({ error: 'Market data session unavailable' });
    }

    const toDate = new Date();
    const intervalMinutes = INTRADAY_INTERVAL_MINUTES[interval] || 5;
    const fromDate = new Date(toDate.getTime() - (points * intervalMinutes * 60 * 1000));

    const payload = {
      exchange,
      symboltoken: String(token),
      interval,
      fromdate: formatSmartApiDate(fromDate),
      todate: formatSmartApiDate(toDate),
    };

    const candleResponse = await smart_api.getCandleData(payload);
    if (!candleResponse?.status) {
      const reason = candleResponse?.message || candleResponse?.errorcode || 'SmartAPI candle request failed';
      return res.status(502).json({ error: reason });
    }

    const candles = Array.isArray(candleResponse.data) ? candleResponse.data : [];
    const formatted = candles.map((row) => ({
      time: row[0],
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5] || 0),
    }));

    return res.json({
      symbol,
      exchange,
      interval,
      points: formatted.length,
      candles: formatted,
    });
  } catch (error) {
    console.error('Intraday candle API error:', error);
    return res.status(500).json({ error: 'Failed to fetch intraday candles' });
  }
});

// ========================================
// SOCKET & MARKET DATA
// ========================================

io.on("connection", (socket) => {
  console.log("Frontend connected:", socket.id);

  const cachedPayload = buildCachedMarketTickPayload();
  const cachedCount = Object.values(cachedPayload).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  if (cachedCount > 0) {
    socket.emit("market-tick", cachedPayload);
    console.log(`📦 Sent cached snapshot (${cachedCount} symbols) to ${socket.id}`);
  }

  // allow client to request token list / interval changes
  socket.on("subscribe", ({ tokens, intervalMs }) => {
    if (tokens) {
      // tokens expected as { NSE: ["3045", ...], BSE: [...] }
      // restart polling with new tokens
      clearInterval(pollTimer);
      pollInterval = intervalMs || pollInterval;
      pollTimer = setInterval(() => pollQuotes(tokens), pollInterval);
    }
  });
});

app.get("/", (req, res) => res.send("Paper Trading Backend is running"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Paper Trading API ready`);
  try {
    await startPolling();
  } catch (e) {
    console.error("Startup error:", e.message || e);
  }
});
