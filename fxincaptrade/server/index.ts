import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer as createHttpServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import route handlers
import { handleDemo } from "./routes/demo";
import { createTicket, getUserTickets } from "./routes/support";
import { register, login, refreshToken, logout, verifyToken, verifyEmailCode, resendVerificationCode, getVerificationStatus, verifyLater } from "./routes/auth";
import {
  getUserBalance,
  getBankAccounts,
  createFundRequest,
  getUserFundRequests,
  getUserProfile,
  updateUserProfile,
  addBankAccount,
  getKYCStatus,
  uploadKYCDocument,
  getAccountSummary,
  getAuthenticatedBalance,
  updateSelectedTradingMode,
} from "./routes/user";
import { closePosition } from "./routes/trades";
import {
  getOpenPositions,
  createPosition,
  updatePositionPNL,
  closePositionDB,
} from "./routes/positions";
import { getTradingHistory } from "./routes/history";
import { deductTradeCharge } from "./routes/trade-charge";
import { testConnection } from "../shared/database";
import { getOrders, createOrder, cancelOrder } from "./routes/orders";
import { mockPrices, refreshMockPrices } from "./lib/mockData";

export function createServer() {
  const app = express();
  const server = createHttpServer(app);

  // Initialize database connection
  testConnection();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploads folder for static assets (logos, images, etc.)
  const uploadsPath = path.resolve(process.cwd(), "uploads");
  app.use("/uploads", express.static(uploadsPath));

  const spaPath = path.resolve(process.cwd(), "dist/spa");

  // Root route - serves API info
  app.get("/api", (_req, res) => {
    res.json({
      name: "SUIMFX Trading Platform",
      version: "1.0.0",
      status: "running",
      endpoints: {
        frontend: "https://trade.suimfx.world",
        live_api: "https://api.fxincap.com",
        local_api: "http://localhost:3000",
        health: "/api/ping",
        auth: "/api/auth/register, /api/auth/login",
        trading: "/api/positions, /api/orders, /api/trades",
        docs: "/api/docs",
      },
    });
  });

  // API Docs
  app.get("/api/docs", (_req, res) => {
    res.json({
      title: "SUIMFX API",
      version: "1.0.0",
      description: "Production trading platform API",
      servers: [
        { url: "https://api.fxincap.com", description: "Live production API" },
        { url: "https://trade.suimfx.world", description: "Production app server" },
        { url: "http://localhost:3000", description: "Local development" },
      ],
    });
  });

  // Health Check
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "pong";
    res.json({ message: ping });
  });

  // Demo Route
  app.get("/api/demo", handleDemo);

  // Support Routes
  app.post("/api/support", createTicket);
  app.get("/api/support/:userId", getUserTickets);

  // Authentication Routes
  app.post("/api/auth/register", register);
  app.post("/api/auth/verification-status", getVerificationStatus);
  app.post("/api/auth/verify-email", verifyEmailCode);
  app.post("/api/auth/verify-later", verifyLater);
  app.post("/api/auth/resend-verification", resendVerificationCode);
  app.post("/api/auth/login", login);
  app.post("/api/auth/refresh-token", refreshToken);
  app.post("/api/auth/logout", verifyToken, logout);

  // Trading Routes
  app.post("/api/trades/close", verifyToken, closePosition);

  // Position Management Routes
  app.get("/api/positions/open", verifyToken, getOpenPositions);
  app.post("/api/positions/create", verifyToken, createPosition);
  app.post("/api/positions/update-pnl", verifyToken, updatePositionPNL);
  app.post("/api/positions/close", verifyToken, closePositionDB);

  // Orders
  app.get("/api/orders", verifyToken, getOrders);
  app.post("/api/orders", verifyToken, createOrder);
  app.post("/api/orders/:orderId/cancel", verifyToken, cancelOrder);

  // Trading History Routes
  app.get("/api/history", verifyToken, getTradingHistory);

  // User Routes
  app.get("/api/account", verifyToken, getAccountSummary);
  app.get("/api/user/balance", verifyToken, getAuthenticatedBalance);
  app.put("/api/user/trading-mode", verifyToken, updateSelectedTradingMode);
  app.get("/api/user/profile", verifyToken, getUserProfile);
  app.put("/api/user/profile", verifyToken, updateUserProfile);
  app.post("/api/user/bank-accounts", verifyToken, addBankAccount);
  app.get("/api/user/kyc", verifyToken, getKYCStatus);
  app.post("/api/user/kyc", verifyToken, uploadKYCDocument);
  app.get("/api/user/balance/:userId", getUserBalance);
  app.get("/api/user/bank-accounts-legacy", getBankAccounts);
  app.post("/api/user/fund-request", createFundRequest);
  app.get("/api/user/fund-requests/:userId", getUserFundRequests);

  // Trade Charge Routes
  app.post("/api/user/deduct-trade-charge", verifyToken, deductTradeCharge);

  // Prices Route
  app.get("/api/prices", async (_req, res) => {
    refreshMockPrices();
    res.json(mockPrices);
  });

  app.use(express.static(spaPath));

  // 404 Handler - serve index.html for React Router (must be after all API routes)
  app.use((_req, res) => {
    const indexPath = path.join(spaPath, "index.html");
    res.sendFile(indexPath);
  });

  return { app, server };
}

export default createServer;
