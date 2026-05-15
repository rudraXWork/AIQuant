// src/hooks/useMarketSocket.js

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

// Symbol alias mapping for Overview page (indices and stocks)
const SYMBOL_ALIAS_MAP = {
  "INFOSYS": "INFY",
  "HDFC BANK": "HDFCBANK",
  "L&T": "LT",
};

// Reverse alias map (API symbol -> display symbol)
const REVERSE_ALIAS_MAP = Object.fromEntries(
  Object.entries(SYMBOL_ALIAS_MAP).map(([display, api]) => [api, display])
);

const DEFAULT_API_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

export default function useMarketSocket(url = DEFAULT_API_URL) {
  const [latest, setLatest] = useState({});

  useEffect(() => {
    const socket = io(url, { transports: ["websocket"] });

    socket.on("connect", () => console.log("✅ Connected to backend socket:", socket.id));

    socket.on("market-tick", (data) => {
      console.log("📥 useMarketSocket received:", data);
      const wrapper = data?.data ? data.data : data;
      const updates = {};

      Object.keys(wrapper || {}).forEach((exchange) => {
        const arr = wrapper[exchange];
        if (!Array.isArray(arr)) {
          console.log(`  ⚠️ ${exchange} is not an array:`, arr);
          return;
        }

        arr.forEach((item) => {
          const apiSymbol = item.tradingsymbol || item.symbol || item.name;
          const ltp = Number(item.lastTradedPrice || item.ltp || item.price);
          
          if (apiSymbol && ltp && ltp > 0) {
            // Use the symbol as-is (server already maps tokens to correct symbols)
            // Also add reverse alias mapping for display purposes
            updates[apiSymbol] = ltp;
            
            // If there's a reverse alias (e.g., INFY -> INFOSYS), also add that
            if (REVERSE_ALIAS_MAP[apiSymbol]) {
              updates[REVERSE_ALIAS_MAP[apiSymbol]] = ltp;
            }
          }
        });
      });

      if (Object.keys(updates).length > 0) {
        console.log("📈 useMarketSocket updates:", updates);
        setLatest((prev) => ({ ...prev, ...updates }));
      } else {
        console.log("⚠️ No valid updates found in market-tick data");
      }
    });

    socket.on("disconnect", () => console.warn("❌ Disconnected from backend"));

    return () => socket.disconnect();
  }, [url]);

  return latest;
}
