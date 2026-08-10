# WebSocket Protocol — fxincap-ws

Server: [fxincapws/src/server.js](../fxincapws/src/server.js). Every message shape below is taken
verbatim from the code; no fields are invented.

## 1. Endpoint

| | |
| --- | --- |
| Path | `/stream` |
| Port | `WS_PORT`, default `4040` |
| Local | `ws://localhost:4040/stream` |
| Browser default | `ws(s)://<page-hostname>:4040/stream` — derived, not configured |
| Override | `VITE_WS_STREAM_URL` at fxincaptrade build time (no trailing slash) |

The WebSocket server shares the HTTP listener:

```js
wss = new WebSocketServer({ server: httpServer, path: '/stream' });
```

so `/health`, `/quote/:symbol` and `/stream` are all on the same port.

## 2. Authentication — there is none

`wss.on('connection')` accepts every socket. No token, no origin check, no per-user rate limit, no
subscription cap. Market data is treated as public. The `ADMIN_TOKEN` gate applies only to the
`/admin/*` HTTP routes, never to `/stream`.

This is a deliberate design point but it means anyone who can reach port 4040 can open unlimited
sockets and subscribe to unlimited symbols. See [SECURITY.md](./SECURITY.md).

## 3. Client → server messages

Only two actions are recognised. Anything else is ignored silently.

### Subscribe

```json
{ "action": "subscribe", "symbol": "XAUUSD" }
```

- `symbol` is uppercased server-side.
- Registers the socket in `symbolClients[symbol]` and, if this is the first subscriber, opens the
  upstream provider subscription.
- Immediately replies with a `quote` snapshot **if** one is available.

### Unsubscribe

```json
{ "action": "unsubscribe", "symbol": "XAUUSD" }
```

- Removes the socket. When the last subscriber for a symbol leaves, the upstream provider
  subscription is dropped too.

## 4. Server → client messages

### `last` — streaming tick

Sent to every subscriber of a symbol on each upstream update.

```json
{ "type": "last", "symbol": "XAUUSD", "bid": 4535.12, "ask": 4537.39, "mid": 4536.25, "last": 4536.25, "time": 1770000000 }
```

The payload after `type` is a spread of whatever the provider adapter emitted:

```js
const message = JSON.stringify({ type: 'last', ...update });
```

So the exact field set **depends on the active provider**:

| Active provider | Fields actually present |
| --- | --- |
| `twelvedata` | `symbol, bid, ask, mid, last, time` |
| `finnhub` | `symbol, last, ts` — **no `bid`, no `ask`, no `time`** |

Clients that require `bid` must tolerate its absence. `useMarketStream` does:
it drops any message where `msg.bid == null`.

### `quote` — snapshot on subscribe

```json
{ "type": "quote", "symbol": "XAUUSD", "bid": 4535.12, "ask": 4537.39, "mid": 4536.25, "last": 4536.25, "time": 1770000000, "provider": "twelvedata" }
```

Identical to `last` plus a `provider` field, and only sent once, in response to `subscribe`. Sent only
when `getQuoteWithFailover()` returned a quote — under Finnhub it never is, because
`FinnhubProvider.getQuote()` returns `null`.

### `error`

```json
{ "type": "error", "message": "No provider available" }
```

Emitted when handling an inbound message throws — malformed JSON, or no provider could be activated
for the requested symbol.

### `webhook` — broadcast, not per-subscription

```json
{ "type": "webhook", "source": "finnhub", "payload": { } }
```

Sent to **every** connected client (not just subscribers of a symbol) when `POST /webhook/finnhub`
receives a validated request.

## 5. Heartbeat and reconnection

**Server → client: no heartbeat.** The service never sends ping frames and never times out an idle
socket. Dead client detection relies on TCP alone.

**Upstream heartbeat:** TwelveData requires one, so `twelvedata-ws.js` sends
`{"action":"heartbeat"}` every 10 s.

**Client reconnect** ([useMarketStream.ts](../fxincaptrade/client/hooks/useMarketStream.ts)):

```
onerror → ws.close()
onclose → setTimeout(connect, 3000)          fixed 3 s, no backoff, unlimited retries
onopen  → clear the subscription set, re-send subscribe for every current symbol
        → after 2 s, HTTP-fetch a quote for any symbol still without a price
```

**Upstream reconnect** (`TwelvedataProvider`): 5 s delay, `maxReconnectAttempts = 3`, then
`onFailure()` escalates to provider failover.

## 6. Provider failover as seen by a client

Failover is transparent — the socket is not closed and subscriptions are replayed onto the new
provider by `replayProviderSubscriptions()`. The only client-visible signals are:

- a possible gap in `last` messages during the swap
- a change in the `provider` field of any subsequent `quote` message
- `provider` / `failover_reason` on `GET /health`

## 7. HTTP surface on the same port

| Method | Path | Auth | Response |
| --- | --- | --- | --- |
| GET | `/` | none | health payload (§8) |
| GET | `/health` | none | health payload (§8) |
| GET | `/quote/:symbol` | none | `{ success, quote, provider }` or `404 { success:false, error }` |
| POST | `/webhook/finnhub` | `x-finnhub-secret` (only enforced when `FINNHUB_WEBHOOK_SECRET` is set) | `200 ok` |
| GET | `/admin/providers` | `x-admin-token` or `?token=` | `{ success, providers[] }` |
| POST | `/admin/providers/:provider` | `x-admin-token` | `{ success, provider }` |
| GET | `/admin/settings` | **none** | `{ success, settings }` |
| POST | `/admin/settings` | `x-admin-token` | `{ success }` |

> `GET /admin/settings` is missing its token check ([server.js:370](../fxincapws/src/server.js#L370))
> while its sibling routes have one. It returns the active provider name **and its API key**.
> Recorded in [SECURITY.md](./SECURITY.md); not changed here.

### `/quote/:symbol` response envelope

```json
{
  "success": true,
  "quote": { "symbol": "XAUUSD", "bid": 4535.12, "ask": 4537.39, "mid": 4536.25, "last": 4536.25, "time": 1770000000 },
  "provider": "twelvedata"
}
```

Note the nesting under `quote`. Two consumers get this wrong:

- [useMarketStream.ts:50](../fxincaptrade/client/hooks/useMarketStream.ts#L50) reads `data.bid` →
  the HTTP fallback never populates a price.
- [trading-engine.ts:541](../fxincapapi/src/lib/trading-engine.ts#L541) reads `data.bid` →
  server-side SL/TP never fires. See [TRADING_ENGINE.md](./TRADING_ENGINE.md) §9.

## 8. Health payload

```json
{
  "status": "ok",
  "provider": "twelvedata",
  "provider_status": "initializing | loading | ready | error",
  "provider_error": null,
  "provider_loaded_at": "2026-08-10T12:00:00.000Z",
  "provider_candidates": ["twelvedata", "finnhub"],
  "failover_reason": null,
  "ws_clients": 12,
  "uptime_seconds": 3600
}
```

`status` is the string literal `"ok"` unconditionally — it is not a computed health verdict. Monitor
`provider_status` and `provider_error` instead.

## 9. Client lifecycle summary

```
connect ──► clientSubs.set(ws, ∅)
   │
   ├─ subscribe(sym) ─► clientSubs[ws] += sym
   │                    symbolClients[sym] += ws
   │                    first subscriber?  → provider.subscribe(sym, handler)
   │                    ← {type:"quote", …}  (if a quote is available)
   │
   ├─ upstream tick  ─► broadcast {type:"last", …} to symbolClients[sym]
   │
   ├─ unsubscribe(sym)► reverse; last subscriber? → provider.unsubscribe(sym)
   │
   └─ close ─────────► drop ws from every symbol; release orphaned upstream subs
```

Provider subscriptions are reference-counted by subscriber set size, so upstream bandwidth scales
with distinct symbols, not with client count.
