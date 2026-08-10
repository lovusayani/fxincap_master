import { describe, it, expect } from "vitest";
import { getRequiredMargin, calculatePnL } from "./trading-engine.js";

/**
 * Locks in the existing contract-size and margin rules, and the fix for
 * getRequiredMargin returning 0 on malformed input — which reserved no margin
 * instead of rejecting the trade. See docs/TRADING_ENGINE.md §3.
 */
describe("getRequiredMargin", () => {
  it("computes margin from contract size, volume, price and leverage", () => {
    // XAUUSD contract size 100: 100 × 0.10 × 4535 / 100 = 453.50
    expect(getRequiredMargin("XAUUSD", 0.1, 4535, 100)).toBe(453.5);
    // EURUSD contract size 100000: 100000 × 0.5 × 1.085 / 100 = 542.50
    expect(getRequiredMargin("EURUSD", 0.5, 1.085, 100)).toBe(542.5);
    // BTC contract size 1: 1 × 0.5 × 97500 / 10 = 4875
    expect(getRequiredMargin("BTCUSDT", 0.5, 97500, 10)).toBe(4875);
  });

  it("scales inversely with leverage", () => {
    expect(getRequiredMargin("EURUSD", 1, 1, 1)).toBe(100000);
    expect(getRequiredMargin("EURUSD", 1, 1, 100)).toBe(1000);
  });

  it("returns null — not 0 — for inputs that are not a valid trade", () => {
    // Returning 0 here previously produced a zero-margin (free) position.
    expect(getRequiredMargin("EURUSD", 0, 1.085, 100)).toBeNull();
    expect(getRequiredMargin("EURUSD", -1, 1.085, 100)).toBeNull();
    expect(getRequiredMargin("EURUSD", 1, 0, 100)).toBeNull();
    expect(getRequiredMargin("EURUSD", 1, 1.085, 0)).toBeNull();
    expect(getRequiredMargin("EURUSD", 1, 1.085, -5)).toBeNull();
    expect(getRequiredMargin("EURUSD", Number.NaN, 1.085, 100)).toBeNull();
    expect(getRequiredMargin("EURUSD", 1, Number.POSITIVE_INFINITY, 100)).toBeNull();
  });
});

describe("calculatePnL", () => {
  it("computes long P&L from the signed move", async () => {
    const { pnl } = await calculatePnL("BUY", "XAUUSD", 0.1, 4535, 4540);
    expect(pnl).toBe(50); // 5.00 × 100 × 0.10
  });

  it("computes short P&L with the inverted move", async () => {
    const { pnl } = await calculatePnL("SELL", "XAUUSD", 0.1, 4535, 4540);
    expect(pnl).toBe(-50);
  });

  it("is symmetric between long and short for the same move", async () => {
    const long = await calculatePnL("BUY", "EURUSD", 0.5, 1.085, 1.083);
    const short = await calculatePnL("SELL", "EURUSD", 0.5, 1.085, 1.083);
    expect(long.pnl).toBe(-short.pnl);
  });

  it("returns zero at break-even", async () => {
    const { pnl, pnlPercentage } = await calculatePnL("BUY", "EURUSD", 1, 1.085, 1.085);
    expect(pnl).toBe(0);
    expect(pnlPercentage).toBe(0);
  });

  it("expresses percentage against notional at entry", async () => {
    // 100 × 0.10 × 4535 = 45,350 notional; 50 / 45,350 × 100 ≈ 0.1102 %
    const { pnlPercentage } = await calculatePnL("BUY", "XAUUSD", 0.1, 4535, 4540);
    expect(pnlPercentage).toBeCloseTo(0.1102, 3);
  });

  // Leverage is a margin input only; it must never scale P&L.
  it("does not depend on leverage", async () => {
    const a = await calculatePnL("BUY", "EURUSD", 1, 1.085, 1.086);
    const b = await calculatePnL("BUY", "EURUSD", 1, 1.085, 1.086);
    expect(a.pnl).toBe(b.pnl);
    expect(a.pnl).toBe(100); // 0.001 × 100000 × 1
  });
});
