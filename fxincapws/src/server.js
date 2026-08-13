import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { PORT, ADMIN_TOKEN, FINNHUB_WEBHOOK_SECRET } from './config.js';
import { initSettingsTable, getSettings, updateSettings, getAllProviders, getProviderByName, updateProvider, getProviderFailoverChain } from './db.js';
import { FinnhubProvider } from './providers/finnhub.js';
import { BinanceProvider } from './providers/binance.js';
import { TwelvedataProvider } from './providers/twelvedata.js';
import { InfowayProvider } from './providers/infoway.js';

const app = express();
app.use(cors());
app.use(express.json());

const SUPPORTED_RUNTIME_PROVIDERS = new Set(['finnhub', 'twelvedata', 'infoway']);

/** Providers accepted by the admin configuration endpoints. */
const CONFIGURABLE_PROVIDERS = ['finnhub', 'binance', 'twelvedata', 'infoway'];

let provider = null;
let providerChain = [];
let activeProviderIndex = -1;
let switchingProvider = false;
let currentSettings = { provider: 'finnhub', api_key: '' };
let wss;
let providerStatus = 'initializing';
let providerLoadError = null;
let providerLoadedAt = null;
let lastFailoverReason = null;

const clientSubs = new Map();
const symbolClients = new Map();
const providerHandlers = new Map();

function normalizeErrorMessage(error) {
  return error?.message || String(error);
}

function getHealthPayload() {
  return {
    status: 'ok',
    provider: currentSettings.provider,
    provider_status: providerStatus,
    provider_error: providerLoadError,
    provider_loaded_at: providerLoadedAt,
    provider_candidates: providerChain.map((item) => item.provider),
    failover_reason: lastFailoverReason,
    ws_clients: wss?.clients?.size || 0,
    uptime_seconds: Math.round(process.uptime()),
  };
}

function createProviderInstance(candidate) {
  const options = {
    onFailure: (error) => {
      void handleProviderFailure(candidate.provider, error);
    },
  };

  if (candidate.provider === 'finnhub') {
    return new FinnhubProvider(candidate.api_key, options);
  }
  if (candidate.provider === 'twelvedata') {
    return new TwelvedataProvider(candidate.api_key, options);
  }
  if (candidate.provider === 'infoway') {
    return new InfowayProvider(candidate.api_key, options);
  }
  return new BinanceProvider(candidate.api_key);
}

function closeCurrentProvider() {
  if (!provider) return;
  for (const symbol of providerHandlers.keys()) {
    try {
      provider.unsubscribe?.(symbol);
    } catch {}
  }
  providerHandlers.clear();
  try {
    provider.disconnect?.();
  } catch {}
  provider = null;
}

function broadcastSymbolUpdate(symbol, update) {
  const clients = symbolClients.get(symbol);
  if (!clients?.size) return;
  const message = JSON.stringify({ type: 'last', ...update });
  clients.forEach((client) => {
    try {
      client.send(message);
    } catch {}
  });
}

function subscribeSymbolOnProvider(symbol) {
  if (!provider || providerHandlers.has(symbol)) return;
  const handler = (update) => {
    broadcastSymbolUpdate(symbol, update);
  };
  provider.subscribe(symbol, handler);
  providerHandlers.set(symbol, handler);
}

function unsubscribeSymbolFromProvider(symbol) {
  if (!providerHandlers.has(symbol)) return;
  try {
    provider?.unsubscribe?.(symbol);
  } catch {}
  providerHandlers.delete(symbol);
}

function replayProviderSubscriptions() {
  providerHandlers.clear();
  for (const symbol of symbolClients.keys()) {
    try {
      subscribeSymbolOnProvider(symbol);
    } catch (error) {
      console.warn(`[fxincap-ws] Failed to replay subscription for ${symbol}:`, normalizeErrorMessage(error));
    }
  }
}

async function refreshProviderChain(preferredProvider = null) {
  const candidates = await getProviderFailoverChain(preferredProvider || currentSettings.provider);
  providerChain = candidates.filter((candidate) => {
    if (!SUPPORTED_RUNTIME_PROVIDERS.has(candidate.provider)) return false;
    return candidate.enabled === true || Boolean(candidate.api_key);
  });

  activeProviderIndex = providerChain.findIndex((candidate) => candidate.provider === currentSettings.provider);
}

async function activateProviderAt(index, reason = null) {
  const candidate = providerChain[index];
  if (!candidate) return false;

  closeCurrentProvider();
  providerStatus = 'loading';
  providerLoadError = null;
  currentSettings = { provider: candidate.provider, api_key: candidate.api_key || '' };

  try {
    const instance = createProviderInstance(candidate);
    instance.connect?.();
    provider = instance;
    activeProviderIndex = index;
    providerStatus = 'ready';
    providerLoadedAt = new Date().toISOString();
    lastFailoverReason = reason;
    replayProviderSubscriptions();
    console.log(`[fxincap-ws] Provider loaded: ${candidate.provider}`);
    return true;
  } catch (error) {
    providerStatus = 'error';
    providerLoadError = normalizeErrorMessage(error);
    providerLoadedAt = null;
    provider = null;
    console.error(`[fxincap-ws] Failed to activate provider ${candidate.provider}:`, error);
    return false;
  }
}

async function loadProvider(preferredProvider = null) {
  if (switchingProvider) return providerStatus === 'ready';
  switchingProvider = true;

  try {
    if (!preferredProvider) {
      try {
        const settings = await getSettings();
        preferredProvider = settings?.provider || null;
      } catch {}
    }

    await refreshProviderChain(preferredProvider);
    if (!providerChain.length) {
      closeCurrentProvider();
      activeProviderIndex = -1;
      providerStatus = 'error';
      providerLoadError = 'No supported providers configured for runtime failover';
      providerLoadedAt = null;
      return false;
    }

    const preferredIndex = preferredProvider
      ? providerChain.findIndex((candidate) => candidate.provider === preferredProvider)
      : -1;

    const indices = [];
    if (preferredIndex >= 0) indices.push(preferredIndex);
    if (activeProviderIndex >= 0 && !indices.includes(activeProviderIndex)) indices.push(activeProviderIndex);
    for (let index = 0; index < providerChain.length; index += 1) {
      if (!indices.includes(index)) indices.push(index);
    }

    for (const index of indices) {
      if (await activateProviderAt(index)) return true;
    }

    closeCurrentProvider();
    activeProviderIndex = -1;
    providerStatus = 'error';
    if (!providerLoadError) providerLoadError = 'Failed to activate any configured provider';
    providerLoadedAt = null;
    return false;
  } finally {
    switchingProvider = false;
  }
}

async function activateNextProvider(reason, excludeProviders = new Set()) {
  if (switchingProvider) return false;
  switchingProvider = true;

  try {
    await refreshProviderChain(currentSettings.provider);
    if (!providerChain.length) {
      providerStatus = 'error';
      providerLoadError = 'No runtime providers available for failover';
      providerLoadedAt = null;
      return false;
    }

    const chainLength = providerChain.length;
    const startIndex = activeProviderIndex >= 0 ? activeProviderIndex + 1 : 0;

    for (let offset = 0; offset < chainLength; offset += 1) {
      const index = (startIndex + offset) % chainLength;
      const candidate = providerChain[index];
      if (!candidate) continue;
      if (excludeProviders.has(candidate.provider)) continue;
      if (await activateProviderAt(index, reason)) return true;
    }

    providerStatus = 'error';
    providerLoadError = reason || 'All configured providers failed';
    providerLoadedAt = null;
    return false;
  } finally {
    switchingProvider = false;
  }
}

async function handleProviderFailure(providerName, error) {
  if (providerName !== currentSettings.provider) return;
  const message = normalizeErrorMessage(error);
  console.warn(`[fxincap-ws] Provider failure detected for ${providerName}:`, message);
  await activateNextProvider(`Failover from ${providerName}: ${message}`, new Set([providerName]));
}

async function getQuoteWithFailover(symbol) {
  if (!provider) {
    const loaded = await loadProvider();
    if (!loaded) return null;
  }

  // A single quote miss (quota limit, unsupported symbol, etc.) must not tear down
  // the shared streaming provider — that would drop live ticks for every other
  // subscriber. Real connectivity failures already trigger failover via each
  // provider's own onFailure hook (see createProviderInstance).
  try {
    const quote = await provider.getQuote(symbol);
    if (quote) return quote;
    providerLoadError = `Quote unavailable for ${symbol}`;
  } catch (error) {
    providerLoadError = normalizeErrorMessage(error);
  }

  return null;
}

async function ensureStreamProviderForSubscribe(symbol) {
  if (!provider) {
    const loaded = await loadProvider();
    if (!loaded) throw new Error('No provider available');
  }

  const attempted = new Set();
  while (provider && !attempted.has(currentSettings.provider)) {
    attempted.add(currentSettings.provider);
    try {
      subscribeSymbolOnProvider(symbol);
      return;
    } catch (error) {
      const switched = await activateNextProvider(`Subscribe failed for ${symbol}: ${normalizeErrorMessage(error)}`, attempted);
      if (!switched) throw error;
    }
  }

  throw new Error(`Unable to subscribe ${symbol} on any provider`);
}

// Health / status
app.get('/', (req, res) => {
  res.json(getHealthPayload());
});

app.get('/health', (req, res) => {
  res.json(getHealthPayload());
});

// Finnhub webhook endpoint: acknowledge quickly and validate secret
app.post('/webhook/finnhub', (req, res) => {
  const secret = req.headers['x-finnhub-secret'] || '';
  if (FINNHUB_WEBHOOK_SECRET && secret !== FINNHUB_WEBHOOK_SECRET) {
    return res.status(401).send('unauthorized');
  }
  res.status(200).send('ok');

  try {
    const payload = req.body || {};
    if (wss?.clients) {
      const message = JSON.stringify({ type: 'webhook', source: 'finnhub', payload });
      wss.clients.forEach((client) => {
        try { client.send(message); } catch {}
      });
    }
  } catch {}
});

/**
 * Constant-time admin token check.
 * Returns true when the request carries the correct token.
 */
function isAdminAuthorized(req) {
  const rawToken = req.headers['x-admin-token'] || req.query.token;
  const token = rawToken != null ? String(rawToken).trim() : '';
  if (!token || !ADMIN_TOKEN) return false;
  const a = Buffer.from(token, 'utf8');
  const b = Buffer.from(ADMIN_TOKEN, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Strip provider secrets before they leave the service.
 *
 * `api_key` was previously returned in full to the admin browser so the UI could
 * build `wss://…?apikey=…` test URLs. A credential that reaches a browser is a
 * credential that reaches browser history, extensions and any XSS.
 * Callers get only whether a key is set and a short non-reversible hint.
 */
function redactProvider(row) {
  const { api_key, ...rest } = row || {};
  const key = api_key == null ? '' : String(api_key);
  return {
    ...rest,
    has_api_key: key.length > 0,
    api_key_hint: key.length > 0 ? `••••${key.slice(-4)}` : null,
  };
}

// Admin endpoints
app.get('/admin/providers', async (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — ADMIN_TOKEN in fxincap-ws/.env must match WS_ADMIN_TOKEN in fxincapadmin/client/.env (Vite proxy)',
    });
  }
  try {
    const providers = (await getAllProviders()).map(redactProvider);
    res.json({ success: true, providers });
  } catch (e) {
    const msg = e?.message || 'Database error';
    console.error('[fxincap-ws] GET /admin/providers:', msg);
    // 200 + success:false so the admin UI always gets JSON (some proxies turn 5xx into opaque 500 HTML)
    res.status(200).json({ success: false, error: msg, providers: [] });
  }
});

app.post('/admin/providers/:provider', async (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — ADMIN_TOKEN on fxincap-ws must match WS_ADMIN_TOKEN on the admin server',
    });
  }

  const { provider: p } = req.params;
  const { api_key, enabled, clear_api_key } = req.body || {};

  if (!CONFIGURABLE_PROVIDERS.includes(p)) {
    return res.status(400).json({ success: false, error: 'Invalid provider' });
  }

  try {
    // The admin UI no longer receives existing keys, so it cannot echo one back.
    // An absent/empty api_key therefore means "leave the stored key unchanged";
    // clearing requires the explicit clear_api_key flag. Without this, saving an
    // enable/disable toggle would silently wipe the provider credential.
    let nextKey;
    if (clear_api_key === true) {
      nextKey = '';
    } else if (typeof api_key === 'string' && api_key.trim() !== '') {
      nextKey = api_key.trim();
    } else {
      const existing = await getProviderByName(p);
      nextKey = existing?.api_key || '';
    }

    const success = await updateProvider({ provider: p, api_key: nextKey, enabled: enabled === true });
    if (!success) {
      return res.status(500).json({ success: false, error: 'Database update failed' });
    }

    await loadProvider(enabled === true ? p : currentSettings.provider);

    const updated = await getProviderByName(p);
    res.json({ success: true, provider: updated ? redactProvider(updated) : null });
  } catch (e) {
    console.error('[fxincap-ws] admin provider update error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// Previously unauthenticated AND returned the active provider's API key in
// cleartext, unlike its three sibling /admin routes. Now gated and redacted.
app.get('/admin/settings', async (req, res) => {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  const settings = await getSettings();
  const key = settings?.api_key == null ? '' : String(settings.api_key);
  res.json({
    success: true,
    settings: {
      provider: settings?.provider ?? null,
      has_api_key: key.length > 0,
      api_key_hint: key.length > 0 ? `••••${key.slice(-4)}` : null,
    },
  });
});

app.post('/admin/settings', async (req, res) => {
  if (!isAdminAuthorized(req)) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const { provider: p, api_key } = req.body || {};
  if (!CONFIGURABLE_PROVIDERS.includes(p)) return res.status(400).json({ success: false, error: 'Invalid provider' });
  try {
    await updateSettings({ provider: p, api_key: api_key || '' });
    await loadProvider(p);
    res.json({ success: true });
  } catch (e) {
    console.error('[fxincap-ws] admin settings error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await getQuoteWithFailover(symbol.toUpperCase());
    if (!quote) {
      return res.status(404).json({ success: false, error: providerLoadError || 'Quote unavailable from configured providers' });
    }
    res.json({ success: true, quote, provider: currentSettings.provider });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

const httpServer = app.listen(PORT, async () => {
  await initSettingsTable();
  await loadProvider();
  console.log(`[fxincap-ws] HTTP server listening on ${PORT}`);
});

wss = new WebSocketServer({ server: httpServer, path: '/stream' });

wss.on('connection', (ws) => {
  clientSubs.set(ws, new Set());

  ws.on('message', async (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.action === 'subscribe' && data.symbol) {
        const sym = data.symbol.toUpperCase();
        const subscriptions = clientSubs.get(ws) || new Set();
        subscriptions.add(sym);
        clientSubs.set(ws, subscriptions);

        const clients = symbolClients.get(sym) || new Set();
        clients.add(ws);
        symbolClients.set(sym, clients);

        await ensureStreamProviderForSubscribe(sym);

        const quote = await getQuoteWithFailover(sym);
        if (quote) {
          ws.send(JSON.stringify({ type: 'quote', ...quote, provider: currentSettings.provider }));
        }
      } else if (data.action === 'unsubscribe' && data.symbol) {
        const sym = data.symbol.toUpperCase();
        clientSubs.get(ws)?.delete(sym);
        const clients = symbolClients.get(sym);
        if (clients) {
          clients.delete(ws);
          if (clients.size === 0) {
            symbolClients.delete(sym);
            unsubscribeSymbolFromProvider(sym);
          }
        }
      }
    } catch (error) {
      try {
        ws.send(JSON.stringify({ type: 'error', message: normalizeErrorMessage(error) }));
      } catch {}
    }
  });

  ws.on('close', () => {
    const subs = clientSubs.get(ws) || new Set();
    for (const sym of subs) {
      const clients = symbolClients.get(sym);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          symbolClients.delete(sym);
          unsubscribeSymbolFromProvider(sym);
        }
      }
    }
    clientSubs.delete(ws);
  });
});
