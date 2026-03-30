export function getContractSize(symbol: string): number {
  const upper = String(symbol || "").toUpperCase();

  if (upper.startsWith("XAU")) {
    return 100;
  }

  if (upper.startsWith("XAG")) {
    return 5000;
  }

  return 100000;
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