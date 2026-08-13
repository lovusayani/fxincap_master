import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  InfowayProvider,
  normalizeRestQuote,
  resolveBusiness,
  toInfowaySymbol,
  buildSymbolMap,
} from './infoway.js';
import { parseDepthPush, parseTradePush, INFOWAY_CODES } from './infoway-ws.js';

/**
 * Run: cd fxincapws && npm test
 *
 * Payloads below are the documented Infoway shapes:
 *   depth push  https://docs.infoway.io/websocket-api/subscribe-and-unsubscribe/depth-subscribe
 *   trade push  https://docs.infoway.io/websocket-api/subscribe-and-unsubscribe/trade-subscribe
 *   REST        https://docs.infoway.io/rest-api/http-endpoints/get-depth
 */

const DEPTH_PUSH = {
  code: 10005,
  data: {
    a: [
      ['103594.12000000', '103594.13000000', '103594.38000000'],
      ['3.50039000', '0.00016000', '0.00006000'],
    ],
    b: [
      ['103594.11000000', '103594.10000000', '103594.09000000'],
      ['3.55117000', '0.05942000', '0.00006000'],
    ],
    s: 'BTCUSDT',
    t: 1747553102161,
  },
};

const TRADE_PUSH = {
  code: 10002,
  data: { p: '103482.94', s: 'BTCUSDT', t: 1747552358393, td: 2, v: '0.00096', vw: '99.3436224' },
};

const REST_DEPTH = {
  ret: 200,
  msg: 'success',
  traceId: '81688452-dd7c-4de7-b423-b5e39d18e298',
  data: [
    {
      s: '01810.HK',
      t: 1769760489943,
      a: [['35.520', '35.540'], ['3031600', '134600']],
      b: [['35.500', '35.480'], ['433800', '858400']],
    },
  ],
};

const REST_TRADE = {
  ret: 200,
  msg: 'success',
  data: [{ s: 'TSLA.US', t: 1750177346523, p: '5188.211', v: '3.0', vw: '15564.6330', td: 1 }],
};

describe('protocol codes', () => {
  test('match the documented Infoway protocol numbers', () => {
    assert.equal(INFOWAY_CODES.SUBSCRIBE_TRADE, 10000);
    assert.equal(INFOWAY_CODES.TRADE_PUSH, 10002);
    assert.equal(INFOWAY_CODES.SUBSCRIBE_DEPTH, 10003);
    assert.equal(INFOWAY_CODES.DEPTH_PUSH, 10005);
    assert.equal(INFOWAY_CODES.HEARTBEAT, 10010);
  });
});

describe('WebSocket message normalization', () => {
  test('depth push yields best bid and best ask from the top of book', () => {
    const parsed = parseDepthPush(DEPTH_PUSH.data);
    assert.equal(parsed.symbol, 'BTCUSDT');
    assert.equal(parsed.bid, 103594.11); // b[0][0]
    assert.equal(parsed.ask, 103594.12); // a[0][0]
    assert.equal(parsed.ts, 1747553102161);
  });

  test('bid is below ask — sides are not transposed', () => {
    const { bid, ask } = parseDepthPush(DEPTH_PUSH.data);
    assert.ok(bid < ask, 'bid must be lower than ask');
  });

  test('trade push yields the executed price', () => {
    const parsed = parseTradePush(TRADE_PUSH.data);
    assert.equal(parsed.symbol, 'BTCUSDT');
    assert.equal(parsed.price, 103482.94);
    assert.equal(parsed.ts, 1747552358393);
  });

  test('rejects malformed or empty depth payloads', () => {
    assert.equal(parseDepthPush(null), null);
    assert.equal(parseDepthPush({}), null);
    assert.equal(parseDepthPush({ s: 'X' }), null);
    assert.equal(parseDepthPush({ s: 'X', a: [[]], b: [[]] }), null);
    assert.equal(parseDepthPush({ s: 'X', a: [['0']], b: [['0']] }), null, 'zero prices are invalid');
    assert.equal(parseDepthPush({ s: 'X', a: [['abc']], b: [['1']] }), null);
  });

  test('rejects malformed trade payloads', () => {
    assert.equal(parseTradePush(null), null);
    assert.equal(parseTradePush({ s: 'X' }), null);
    assert.equal(parseTradePush({ s: 'X', p: '0' }), null);
    assert.equal(parseTradePush({ s: 'X', p: '-5' }), null);
  });

  test('substitutes now when the timestamp is absent or invalid', () => {
    const before = Date.now();
    const parsed = parseTradePush({ s: 'X', p: '1.5' });
    assert.ok(parsed.ts >= before);
  });
});

describe('REST normalization', () => {
  test('depth response becomes the internal contract', () => {
    const quote = normalizeRestQuote('XAUUSD', REST_DEPTH);
    assert.deepEqual(Object.keys(quote).sort(), ['ask', 'bid', 'last', 'mid', 'symbol', 'time']);
    assert.equal(quote.symbol, 'XAUUSD', 'relabelled to the CLIENT symbol, not 01810.HK');
    assert.equal(quote.bid, 35.5);
    assert.equal(quote.ask, 35.52);
    // mid is left unrounded, matching the existing TwelveData adapter.
    assert.ok(Math.abs(quote.mid - 35.51) < 1e-9);
    assert.ok(Math.abs(quote.last - 35.51) < 1e-9, 'last falls back to mid when no trade price is supplied');
  });

  test('converts the millisecond timestamp to seconds', () => {
    const quote = normalizeRestQuote('XAUUSD', REST_DEPTH);
    assert.equal(quote.time, Math.floor(1769760489943 / 1000));
    assert.equal(quote.time, 1769760489);
    assert.ok(quote.time < 1e12, 'time must be seconds, not milliseconds');
  });

  test('uses the supplied trade price as last when available', () => {
    const quote = normalizeRestQuote('XAUUSD', REST_DEPTH, { last: '35.51' });
    assert.equal(quote.last, 35.51);
    assert.equal(quote.bid, 35.5, 'bid still comes from the book');
  });

  test('trade-only response collapses to a zero-spread quote', () => {
    const quote = normalizeRestQuote('TSLA.US', REST_TRADE);
    assert.equal(quote.bid, 5188.211);
    assert.equal(quote.ask, 5188.211);
    assert.equal(quote.last, 5188.211);
    assert.equal(quote.time, 1750177346);
  });

  test('rejects error envelopes and empty data', () => {
    assert.equal(normalizeRestQuote('X', { ret: 401, msg: 'unauthorized' }), null);
    // Live 401 body observed from data.infoway.io — a different envelope shape
    // from the success response, with no `ret` field.
    assert.equal(
      normalizeRestQuote('X', { code: 401, message: 'Token invalid', timestamp: 1786362139132 }),
      null
    );
    assert.equal(normalizeRestQuote('X', { ret: 200, data: [] }), null);
    assert.equal(normalizeRestQuote('X', { ret: 200 }), null);
    assert.equal(normalizeRestQuote('X', null), null);
    assert.equal(normalizeRestQuote('X', 'not-json'), null);
  });
});

describe('symbol and business routing', () => {
  test('routes asset classes to the documented business segments', () => {
    assert.equal(resolveBusiness('EURUSD'), 'common');
    assert.equal(resolveBusiness('XAUUSD'), 'common');
    assert.equal(resolveBusiness('BTCUSDT'), 'crypto');
    assert.equal(resolveBusiness('TSLA.US'), 'stock');
    assert.equal(resolveBusiness('000001.SZ'), 'stock');
  });

  test('honours an explicit business prefix', () => {
    assert.equal(resolveBusiness('crypto:BTCUSDT'), 'crypto');
    assert.equal(resolveBusiness('japan:7203'), 'japan');
  });

  test('passes symbols through unchanged by default', () => {
    const none = buildSymbolMap('');
    assert.equal(toInfowaySymbol('XAUUSD', none), 'XAUUSD');
    assert.equal(toInfowaySymbol('eurusd', none), 'EURUSD');
    assert.equal(toInfowaySymbol('crypto:BTCUSDT', none), 'BTCUSDT', 'business prefix is stripped');
  });

  test('applies INFOWAY_SYMBOL_MAP overrides', () => {
    const map = buildSymbolMap('XAUUSD=XAU/USD, EURUSD=EUR/USD');
    assert.equal(toInfowaySymbol('XAUUSD', map), 'XAU/USD');
    assert.equal(toInfowaySymbol('EURUSD', map), 'EUR/USD');
    assert.equal(toInfowaySymbol('GBPUSD', map), 'GBPUSD', 'unmapped symbols pass through');
  });
});

describe('provider lifecycle', () => {
  test('connect() throws when no API key is configured', () => {
    const provider = new InfowayProvider('');
    assert.throws(() => provider.connect(), /apiKey is required/);
  });

  test('connect() succeeds with a key and does not open a socket eagerly', () => {
    const provider = new InfowayProvider('test-key');
    provider.connect();
    assert.equal(provider.enabled, true);
    assert.equal(provider.sockets.size, 0, 'sockets open lazily on first subscribe');
    provider.disconnect();
  });

  test('getQuote returns null without an API key rather than throwing', async () => {
    const provider = new InfowayProvider('');
    assert.equal(await provider.getQuote('XAUUSD'), null);
  });

  test('getQuote serves a fresh cached quote without a network call', async () => {
    const provider = new InfowayProvider('test-key');
    const cached = {
      symbol: 'XAUUSD',
      bid: 4535.1,
      ask: 4535.3,
      mid: 4535.2,
      last: 4535.2,
      time: Math.floor(Date.now() / 1000),
    };
    provider.quotes.set('XAUUSD', cached);
    assert.deepEqual(await provider.getQuote('XAUUSD'), cached);
  });

  test('emits a normalized quote to the subscriber on a depth tick', () => {
    const provider = new InfowayProvider('test-key');
    const received = [];
    provider.callbacks.set('BTCUSDT', (q) => received.push(q));
    provider.routeFor('BTCUSDT');

    provider.emit('BTCUSDT', { bid: 100, ask: 102, time: 1747553102 });

    assert.equal(received.length, 1);
    assert.deepEqual(received[0], {
      symbol: 'BTCUSDT',
      bid: 100,
      ask: 102,
      mid: 101,
      last: 101,
      time: 1747553102,
    });
  });

  test('holds a trade-only tick until depth supplies both sides', () => {
    const provider = new InfowayProvider('test-key');
    const received = [];
    provider.callbacks.set('BTCUSDT', (q) => received.push(q));

    // Trade arrives first: no bid/ask yet, so nothing may be emitted.
    provider.emit('BTCUSDT', { last: 101.5, time: 1 });
    assert.equal(received.length, 0, 'a half quote must never reach the platform');

    // Depth completes the book; the held last price is carried through.
    provider.emit('BTCUSDT', { bid: 100, ask: 102, time: 2 });
    assert.equal(received.length, 1);
    assert.equal(received[0].last, 101.5);
    assert.equal(received[0].bid, 100);
  });

  test('unsubscribe stops delivery and clears all per-symbol state', () => {
    const provider = new InfowayProvider('test-key');
    let calls = 0;
    provider.callbacks.set('BTCUSDT', () => { calls += 1; });
    provider.routeFor('BTCUSDT');

    provider.emit('BTCUSDT', { bid: 100, ask: 102, time: 1 });
    assert.equal(calls, 1);

    provider.unsubscribe('BTCUSDT');
    assert.equal(provider.callbacks.has('BTCUSDT'), false);
    assert.equal(provider.quotes.has('BTCUSDT'), false);
    assert.equal(provider.routes.has('BTCUSDT'), false);

    provider.emit('BTCUSDT', { bid: 200, ask: 202, time: 2 });
    assert.equal(calls, 1, 'no further ticks are delivered after unsubscribe');
  });

  test('unsubscribe on an unknown symbol is a no-op', () => {
    const provider = new InfowayProvider('test-key');
    assert.doesNotThrow(() => provider.unsubscribe('NOSUCH'));
  });

  test('disconnect clears every socket and cached subscription', () => {
    const provider = new InfowayProvider('test-key');
    provider.connect();
    provider.callbacks.set('BTCUSDT', () => {});
    provider.routeFor('BTCUSDT');
    provider.quotes.set('BTCUSDT', { symbol: 'BTCUSDT' });

    provider.disconnect();

    assert.equal(provider.manualDisconnect, true);
    assert.equal(provider.sockets.size, 0);
    assert.equal(provider.callbacks.size, 0);
    assert.equal(provider.quotes.size, 0);
    assert.equal(provider.routes.size, 0);
  });

  test('a closed socket does not reconnect once no subscribers remain', () => {
    const provider = new InfowayProvider('test-key');
    provider.connect();
    // No callbacks registered, so scheduleReconnect must decline.
    provider.scheduleReconnect('common');
    assert.equal(provider.reconnectAttempts.get('common'), undefined);
    provider.disconnect();
  });

  test('reconnect escalates to onFailure after the attempt budget', () => {
    const failures = [];
    const provider = new InfowayProvider('test-key', { onFailure: (e) => failures.push(e) });
    provider.connect();
    provider.callbacks.set('EURUSD', () => {});
    provider.routeFor('EURUSD');

    provider.reconnectAttempts.set('common', provider.maxReconnectAttempts);
    provider.scheduleReconnect('common');

    assert.equal(failures.length, 1, 'exhausted reconnects must trigger provider failover');
    assert.match(failures[0].message, /infoway websocket unavailable/);
    provider.disconnect();
  });
});
