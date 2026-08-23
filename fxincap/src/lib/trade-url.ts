/**
 * Resolves the trading platform URL from whatever domain the marketing site is
 * being served on, so ncapfx.com links to trade.ncapfx.com without any
 * hardcoded host. NEXT_PUBLIC_DASHBOARD_URL still wins when explicitly set.
 */

const TRADE_SUBDOMAIN = "trade";

/** Hosts that already point at the platform itself. */
const PLATFORM_PREFIXES = ["trade.", "terminal.", "user.", "dashboard.", "app."];

export function deriveTradeUrl(hostname: string, protocol = "https:"): string {
  const host = (hostname || "").toLowerCase().trim();

  if (!host || host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
    return "http://localhost:3000";
  }

  // Already on a platform host — keep it.
  if (PLATFORM_PREFIXES.some((p) => host.startsWith(p))) {
    return `${protocol}//${host}`;
  }

  const bare = host.startsWith("www.") ? host.slice(4) : host;
  return `${protocol}//${TRADE_SUBDOMAIN}.${bare}`;
}

/** SSR-safe default used before the browser hostname is known. */
export function defaultTradeUrl(): string {
  const configured = process.env.NEXT_PUBLIC_DASHBOARD_URL?.replace(/\/$/, "");
  if (configured && !/suimfx/i.test(configured)) return configured;
  return process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://trade.ncapfx.com";
}
