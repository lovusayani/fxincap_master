import { describe, it, expect } from "vitest";
import { parseQuoteEnvelope, executablePrice } from "./market-price.js";

/**
 * Regression tests for the defect that stopped server-side SL/TP executing.
 *
 * fxincapws responds `{ success, quote: { bid, ask, ... }, provider }`. Callers
 * read `data.bid`, which is undefined — Number(undefined) is NaN, so every
 * symbol was skipped and no stop loss or take profit ever fired.
 * See docs/TRADING_ENGINE.md §9.
 */
describe("parseQuoteEnvelope", () => {
  it("reads bid/ask from the nested fxincapws envelope", () => {
    const payload = {
      success: true,
      quote: { symbol: "XAUUSD", bid: 4535.12, ask: 4537.39, mid: 4536.25, last: 4536.25, time: 1770000000 },
      provider: "twelvedata",
    };

    const quote = parseQuoteEnvelope("XAUUSD", payload);

    expect(quote).not.toBeNull();
    expect(quote!.bid).toBe(4535.12);
    expect(quote!.ask).toBe(4537.39);
    expect(quote!.mid).toBeCloseTo(4536.255, 3);
  });

  it("also accepts a bare quote object", () => {
    const quote = parseQuoteEnvelope("EURUSD", { bid: 1.085, ask: 1.0852 });
    expect(quote!.bid).toBe(1.085);
    expect(quote!.ask).toBe(1.0852);
  });

  it("falls back to last when only a single price is published", () => {
    const quote = parseQuoteEnvelope("BTCUSDT", { quote: { last: 97500 } });
    expect(quote!.bid).toBe(97500);
    expect(quote!.ask).toBe(97500);
  });

  it("returns null when no usable price is present", () => {
    expect(parseQuoteEnvelope("XAUUSD", { success: false, error: "unavailable" })).toBeNull();
    expect(parseQuoteEnvelope("XAUUSD", { quote: { bid: 0, ask: 0 } })).toBeNull();
    expect(parseQuoteEnvelope("XAUUSD", null)).toBeNull();
  });

  it("rejects non-positive and non-numeric prices", () => {
    expect(parseQuoteEnvelope("X", { quote: { bid: -1 } })).toBeNull();
    expect(parseQuoteEnvelope("X", { quote: { bid: "abc" } })).toBeNull();
  });
});

describe("executablePrice", () => {
  const quote = { symbol: "XAUUSD", bid: 100, ask: 102, mid: 101, receivedAt: Date.now() };

  it("opens BUY at ask and SELL at bid", () => {
    expect(executablePrice(quote, "BUY", "OPEN")).toBe(102);
    expect(executablePrice(quote, "SELL", "OPEN")).toBe(100);
  });

  // Matches the pre-existing SL/TP convention in trading-engine.ts.
  it("closes BUY at bid and SELL at ask", () => {
    expect(executablePrice(quote, "BUY", "CLOSE")).toBe(100);
    expect(executablePrice(quote, "SELL", "CLOSE")).toBe(102);
  });
});
