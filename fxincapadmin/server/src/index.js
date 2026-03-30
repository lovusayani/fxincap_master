import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

// Load env from server/.env or project root .env
dotenv.config();
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const app = express();
const PORT = process.env.PORT || 4096;
const NODE_ENV = process.env.NODE_ENV || 'development';
const ADMIN_API_URL = process.env.ADMIN_API_URL || 'https://api.suimfx.world';
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || '';
const LOCAL_ADMIN_API_URL = process.env.LOCAL_ADMIN_API_URL || ADMIN_API_URL;
const WS_SERVICE_URL = process.env.WS_SERVICE_URL || 'https://ws.fxincap.com';
const WS_ADMIN_TOKEN = process.env.WS_ADMIN_TOKEN || 'changeme-admin-token';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientBuildPath = path.resolve(__dirname, '../../client/dist');

const forwardJsonBody = (proxyReq, req) => {
  const method = (req.method || '').toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
  if (!req.body || Object.keys(req.body).length === 0) return;
  const bodyData = JSON.stringify(req.body);
  proxyReq.setHeader('Content-Type', 'application/json');
  proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
  proxyReq.write(bodyData);
};

app.use(cors({ credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// WS service proxy — must come before /api/admin routes
app.use(
  '/api/ws-admin',
  createProxyMiddleware({
    target: WS_SERVICE_URL,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/api/ws-admin': '' },
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader('x-admin-token', WS_ADMIN_TOKEN);
      forwardJsonBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      console.error('WS service proxy error:', err.message);
      res.status(503).json({ error: 'WS service unavailable' });
    },
  })
);

// Proxy admin API so the frontend can call same-origin without exposing token in the client bundle
app.use(
  '/api/admin/server-settings',
  createProxyMiddleware({
    target: LOCAL_ADMIN_API_URL,
    changeOrigin: true,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req) => {
      if (ADMIN_API_TOKEN) {
        proxyReq.setHeader('authorization', `Bearer ${ADMIN_API_TOKEN}`);
      }
      forwardJsonBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      console.error('Local admin API proxy error:', err.message);
      res.status(503).json({ error: 'Admin API unavailable' });
    },
  })
);

// Admin login/session routes live under /api/admin-auth on fxincapapi (not under /api/admin)
app.use(
  '/api/admin-auth',
  createProxyMiddleware({
    target: LOCAL_ADMIN_API_URL,
    changeOrigin: true,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req) => {
      if (ADMIN_API_TOKEN) {
        proxyReq.setHeader('authorization', `Bearer ${ADMIN_API_TOKEN}`);
      }
      forwardJsonBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      console.error('Admin auth proxy error:', err.message);
      res.status(503).json({ error: 'Admin API unavailable' });
    },
  })
);

app.use(
  '/api/admin',
  createProxyMiddleware({
    target: ADMIN_API_URL,
    changeOrigin: true,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req) => {
      if (ADMIN_API_TOKEN) {
        proxyReq.setHeader('authorization', `Bearer ${ADMIN_API_TOKEN}`);
      }
      forwardJsonBody(proxyReq, req);
    },
    onError: (err, req, res) => {
      console.error('Admin API proxy error:', err.message);
      res.status(503).json({ error: 'Admin API unavailable' });
    },
  })
);

// API routes - must come BEFORE proxy
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/info', (req, res) => {
  res.json({ name: 'SUIMFX Admin', version: '0.1.0' });
});

// Serve React client
if (NODE_ENV !== 'development') {
  // Production/staging: serve built React files
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
// Development: proxy to Vite dev server for hot reload
  app.use(
    '/',
    createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true,
      ws: true,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        res.status(503).json({ error: 'Vite server not available. Is it running?' });
      }
    })
  );
}

app.listen(PORT, () => {
  console.log(`Admin server listening on http://localhost:${PORT}`);
  if (NODE_ENV === 'production') {
    console.log(`Serving React UI from ${clientBuildPath}`);
  } else {
    console.log(`Dev mode: proxying UI from Vite on port 5173`);
  }
});
