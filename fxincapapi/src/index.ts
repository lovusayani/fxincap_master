import "dotenv/config";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import { createServer as createHttpServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
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
import paymentRoutes from "./routes/payment.js";
import brokerRoutes from "./routes/broker.js";
import notificationRoutes from "./routes/notifications.js";
import priceRoutes from "./routes/prices.js";
import supportRoutes from "./routes/support.js";
import healthRoutes from "./routes/health.js";
import emailRoutes from "./routes/email.js";
import { getAutoCloseTimeoutMinutes } from "./lib/trade-settings.js";
import { autoCloseExpiredTrades } from "./lib/trading-engine.js";

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
      ? ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
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
app.use("/api/user", userRoutes);
app.use("/api/positions", positionRoutes);
app.use("/api/trades", tradeRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin-auth", adminAuthRoutes);
app.use("/api/mam", mamRoutes);
app.use("/api/pamm", pammRoutes);
app.use("/api/ib", ibRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/broker", brokerRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/prices", priceRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/email", emailRoutes);

const autoClosePollMs = Number(process.env.TRADE_AUTO_CLOSE_POLL_MS || 15000);
let autoCloseWorkerRunning = false;

setInterval(async () => {
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

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Endpoint not found" });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`✅ API Server running on port ${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs`);
});

