import "dotenv/config";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import { createServer as createHttpServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

// Configuration is validated at module evaluation inside lib/env.ts, which runs
// before lib/database.ts builds its Pool. A missing JWT_SECRET, database
// coordinate or internal service token stops the process there with a listing of
// everything that is missing. See docs/SECURITY.md §3 and §4.
import {
  SL_TP_POLL_MS,
  TRADE_AUTO_CLOSE_POLL_MS,
  PRICE_SYNC_POLL_MS,
  TRADE_WORKERS_ENABLED,
} from "./lib/env.js";
import { testConnection } from "./lib/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Route imports
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user_v2.js";
import positionRoutes from "./routes/positions.js";
import tradeRoutes from "./routes/trades.js";
import historyRoutes from "./routes/history.js";
import orderRoutes from "./routes/orders.js";
import adminRoutes from "./routes/admin.js";
import adminAuthRoutes from "./routes/adminAuth.js";
import mamRoutes from "./routes/mam.js";
import pammRoutes from "./routes/pamm.js";
import ibRoutes from "./routes/ib.js";
import walletRoutes from "./routes/wallet.js";
import paymentRoutes from "./routes/payment.js";
import brokerRoutes from "./routes/broker.js";
import notificationRoutes from "./routes/notifications.js";
import priceRoutes from "./routes/prices.js";
import offerRoutes from "./routes/offers.js";
import supportRoutes from "./routes/support.js";
import healthRoutes from "./routes/health.js";
import emailRoutes from "./routes/email.js";
import { getAutoCloseTimeoutMinutes } from "./lib/trade-settings.js";
import { autoCloseExpiredTrades, processAllStopLossTakeProfit } from "./lib/trading-engine.js";
import { syncOpenTradePrices, reconcileFlatAccountEquity } from "./lib/price-sync.js";
import { verifyToken } from "./routes/auth.js";
import { requireAdmin } from "./middleware/adminAuth.js";

const uploadsPath = path.resolve(__dirname, "../uploads");

const app: Express = express();
const server = createHttpServer(app);

function buildCors() {
  const raw = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || "";
  const fromEnv = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const devLocal =
    process.env.NODE_ENV !== "production"
      ? [
          "http://localhost:3000", "http://127.0.0.1:3000",
          "http://localhost:3001", "http://127.0.0.1:3001",
          "http://localhost:3002", "http://127.0.0.1:3002",
          "http://localhost:3003", "http://127.0.0.1:3003",
          "http://localhost:3004", "http://127.0.0.1:3004",
          "http://localhost:5173", "http://127.0.0.1:5173",
          "http://localhost:5174", "http://127.0.0.1:5174",
          "http://localhost:5175", "http://127.0.0.1:5175",
          "http://localhost:5176", "http://127.0.0.1:5176",
          "http://localhost:5177", "http://127.0.0.1:5177",
        ]
      : [];
  const allowed = Array.from(new Set([...fromEnv, ...devLocal]));
  if (allowed.length === 0) {
    return cors({ origin: true, credentials: true });
  }
  return cors({
    credentials: true,
    origin(origin, cb) {
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    },
  });
}

// Middleware
app.use(buildCors());
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded assets
app.use("/uploads", express.static(uploadsPath));

// Initialize database
testConnection().catch((err) => {
  console.error("❌ Database connection failed:", err.message);
});

// Health check
app.get("/api/ping", (_req: Request, res: Response) => {
  res.json({ message: "pong", timestamp: new Date().toISOString(), version: "1.0.0" });
});

// API Documentation
app.get("/api/docs", (_req: Request, res: Response) => {
  res.json({
    name: "SUIMFXUSERAPP API Server",
    version: "1.0.0",
    description: "Production-ready REST API with 79 endpoints",
    endpoints: {
      authentication: "2",
      users: "10",
      trading: "5",
      positions: "4",
      orders: "4",
      admin: "10",
      mam: "8",
      pamm: "8",
      ib: "8",
      payment: "6",
      broker: "5",
      notifications: "4",
      support: "2",
      prices: "2",
    },
    total: "79 endpoints",
  });
});

// Route registration
app.use("/api/auth", authRoutes);
// Withdrawal wallet. Mounted BEFORE the generic /api/user router so these
// paths resolve here and cannot be shadowed by a route added there later.
app.use("/api/user/wallet", walletRoutes);
app.use("/api/user", userRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/trades", tradeRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/orders", orderRoutes);
/**
 * Administrator authorization boundary.
 *
 * Every /api/admin/* route previously relied on `verifyToken` alone — the user
 * authentication middleware — so any customer's JWT was accepted on endpoints
 * that set balances, change passwords and impersonate traders.
 * See docs/SECURITY.md §1.
 *
 * One documented exemption: GET /api/admin/style-settings is public platform
 * branding, fetched by the trading client (fxincaptrade/client/App.tsx) and the
 * admin sidebar before a session exists. It is read-only and carries no
 * customer or credential data. Its POST counterpart is admin-only.
 */
const PUBLIC_ADMIN_GETS = new Set(["/style-settings"]);

app.use(
  "/api/admin",
  (req: Request, res: Response, next) => {
    if (req.method === "GET" && PUBLIC_ADMIN_GETS.has(req.path)) {
      return next();
    }
    return verifyToken(req, res, () => requireAdmin(req, res, next));
  },
  adminRoutes
);
app.use("/api/admin-auth", adminAuthRoutes);
app.use("/api/mam", mamRoutes);
app.use("/api/pamm", pammRoutes);
app.use("/api/ib", ibRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/broker", brokerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/prices", priceRoutes);
// Public, display-only promotional banners; writes are admin-only under /api/admin/offers.
app.use("/api/offers", offerRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/email", emailRoutes);

/**
 * Registers a background worker that mutates live financial state.
 *
 * Skipped entirely unless TRADE_WORKERS_ENABLED (production, or an explicit
 * ENABLE_TRADE_WORKERS=true). This stops a developer machine connected to the
 * production database from closing real positions alongside the live server.
 */
function registerTradeWorker(fn: () => Promise<void>, intervalMs: number): void {
  if (!TRADE_WORKERS_ENABLED) return;
  setInterval(fn, intervalMs);
}

if (!TRADE_WORKERS_ENABLED) {
  console.warn(
    "[TRADE] Background workers DISABLED (auto-close, price sync, SL/TP). " +
      "NODE_ENV is not \"production\". Set ENABLE_TRADE_WORKERS=true to override."
  );
}

const autoClosePollMs = TRADE_AUTO_CLOSE_POLL_MS;
let autoCloseWorkerRunning = false;

registerTradeWorker(async () => {
  if (autoCloseWorkerRunning) {
    return;
  }

  autoCloseWorkerRunning = true;
  try {
    const timeoutMinutes = await getAutoCloseTimeoutMinutes();
    const closedCount = await autoCloseExpiredTrades(timeoutMinutes);
    if (closedCount > 0) {
      console.log(
        `[TRADE] Auto-closed ${closedCount} trade(s) due to timeout (${timeoutMinutes} minute(s))`
      );
    }
  } catch (error) {
    console.error("[TRADE] Auto-close worker failed:", error);
  } finally {
    autoCloseWorkerRunning = false;
  }
}, autoClosePollMs);

/**
 * Server-side valuation worker.
 *
 * Values every open position from fxincapws prices and persists current_price,
 * pnl, pnl_percentage and account equity. This is what makes the server — not
 * the browser — the source of truth for open-position P&L; the client-driven
 * /api/trades/price-update path is now an authenticated maintenance endpoint
 * rather than the primary mechanism. See docs/PNL_ENGINE.md.
 */
let priceSyncRunning = false;

registerTradeWorker(async () => {
  if (priceSyncRunning) return;
  priceSyncRunning = true;
  try {
    const result = await syncOpenTradePrices();
    if (result.symbolsUnavailable > 0) {
      console.warn(
        `[PRICE] ${result.symbolsUnavailable}/${result.symbols} symbol(s) had no fresh server quote; ` +
          `those positions were not revalued`
      );
    }
    await reconcileFlatAccountEquity();
  } catch (error) {
    console.error("[PRICE] Price sync worker failed:", error);
  } finally {
    priceSyncRunning = false;
  }
}, PRICE_SYNC_POLL_MS);

const slTpPollMs = SL_TP_POLL_MS;
let slTpWorkerRunning = false;

registerTradeWorker(async () => {
  if (slTpWorkerRunning) return;
  slTpWorkerRunning = true;
  try {
    const { checked, closed } = await processAllStopLossTakeProfit();
    if (closed > 0) {
      console.log(`[TRADE] SL/TP: closed ${closed} trade(s) (${checked} checked)`);
    }
  } catch (error) {
    console.error("[TRADE] SL/TP worker failed:", error);
  } finally {
    slTpWorkerRunning = false;
  }
}, slTpPollMs);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ API Server running on port ${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
});

