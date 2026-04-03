export function getContractSize(symbol: string): number {
  const upper = String(symbol || "").toUpperCase();

  if (upper.includes("BTC")) {
    return 1;
  }

  if (upper.includes("ETH")) {
    return 1;
  }

  if (upper.startsWith("XAU")) {
    return 100;
  }

  if (upper.startsWith("XAG")) {
    return 5000;
  }

  return 100000;
}

/** Pip size for display (approximate, broker-style). */
export function getPipSize(symbol: string): number {
  const upper = String(symbol || "").toUpperCase();
  if (upper.includes("BTC") || upper.includes("ETH")) return 0.01;
  if (upper.includes("JPY") && !upper.includes("DJPY")) return 0.01;
  if (upper.startsWith("XAU")) return 0.1;
  if (upper.startsWith("XAG")) return 0.001;
  return 0.0001;
}

export function getNotional(symbol: string, volume: number, price: number): number {
  if (!Number.isFinite(volume) || !Number.isFinite(price) || volume <= 0 || price <= 0) return 0;
  return getContractSize(symbol) * volume * price;
}

export function calculateRequiredMargin(
  symbol: string,
  volume: number,
  price: number,
  leverage: number
): number {
  if (!Number.isFinite(volume) || !Number.isFinite(price) || !Number.isFinite(leverage) || volume <= 0 || price <= 0 || leverage <= 0) {
    return 0;
  }

  return Number(((getContractSize(symbol) * volume * price) / leverage).toFixed(2));
}

export function calculateLotFromAllocatedMargin(
  symbol: string,
  allocatedMargin: number,
  price: number,
  leverage: number
): number {
  const contractSize = getContractSize(symbol);

  if (!Number.isFinite(allocatedMargin) || !Number.isFinite(price) || !Number.isFinite(leverage) || allocatedMargin <= 0 || price <= 0 || leverage <= 0 || contractSize <= 0) {
    return 0.01;
  }

  return Math.max(0.01, Number(((allocatedMargin * leverage) / (contractSize * price)).toFixed(2)));
}

/** SL distance in pips (or points for metals/crypto). */
export function slDistancePips(symbol: string, entryPrice: number, stopLoss: number): number | null {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(stopLoss) || entryPrice <= 0) return null;
  const pip = getPipSize(symbol);
  if (pip <= 0) return null;
  return Math.abs(entryPrice - stopLoss) / pip;
}

export function validateStopLossForSide(
  side: "BUY" | "SELL",
  entryPrice: number,
  stopLoss: number | null
): { ok: boolean; message: string } {
  if (stopLoss == null || !Number.isFinite(stopLoss) || stopLoss <= 0) {
    return { ok: true, message: "" };
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { ok: false, message: "Entry price required to validate stop loss" };
  }
  if (side === "BUY") {
    if (stopLoss >= entryPrice) {
      return { ok: false, message: "For BUY, stop loss must be below entry price" };
    }
  } else {
    if (stopLoss <= entryPrice) {
      return { ok: false, message: "For SELL, stop loss must be above entry price" };
    }
  }
  return { ok: true, message: "" };
}

export function validateTakeProfitForSide(
  side: "BUY" | "SELL",
  entryPrice: number,
  takeProfit: number | null
): { ok: boolean; message: string } {
  if (takeProfit == null || !Number.isFinite(takeProfit) || takeProfit <= 0) {
    return { ok: true, message: "" };
  }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    return { ok: false, message: "Entry price required to validate take profit" };
  }
  if (side === "BUY") {
    if (takeProfit <= entryPrice) {
      return { ok: false, message: "For BUY, take profit must be above entry price" };
    }
  } else {
    if (takeProfit >= entryPrice) {
      return { ok: false, message: "For SELL, take profit must be below entry price" };
    }
  }
  return { ok: true, message: "" };
}
