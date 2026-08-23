/**
 * Admin-managed branding (app name + logos) shared with the Trade and Admin
 * apps via GET /api/admin/style-settings.
 *
 * Requests go through the /platform-api rewrite declared in next.config.ts so
 * no API host is hardcoded here. Every failure path falls back to the defaults
 * below — the marketing site must never fail to render because the API is down.
 */

export type PlatformBranding = {
  appName: string;
  logoLightUrl: string;
  logoDarkUrl: string;
  logoSquareUrl: string;
};

export const BRANDING_DEFAULTS: PlatformBranding = {
  appName: "Suimfx",
  logoLightUrl: "",
  logoDarkUrl: "",
  logoSquareUrl: "",
};

/** Uploaded logos come back as API-relative paths; make them absolute. */
const resolveAssetUrl = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
  return `/platform-api${raw.startsWith("/") ? "" : "/"}${raw}`.replace("/platform-api/api/", "/platform-api/");
};

const normalize = (data: any): PlatformBranding => ({
  appName: String(data?.platformName || "").trim() || BRANDING_DEFAULTS.appName,
  logoLightUrl: resolveAssetUrl(data?.logoLightUrl),
  logoDarkUrl: resolveAssetUrl(data?.logoDarkUrl),
  logoSquareUrl: resolveAssetUrl(data?.logoSquareUrl),
});

/** Server-side fetch, used for page metadata (browser tab title). */
export async function fetchPlatformBranding(): Promise<PlatformBranding> {
  const apiBase = (
    process.env.PLATFORM_API_URL ||
    (process.env.NODE_ENV === "development" ? "http://localhost:7000" : process.env.NEXT_PUBLIC_API_URL) ||
    "http://localhost:7000"
  ).replace(/\/$/, "");

  try {
    const res = await fetch(`${apiBase}/api/admin/style-settings`, {
      // Branding changes rarely; revalidate periodically rather than per request.
      next: { revalidate: 60 },
    });
    if (!res.ok) return BRANDING_DEFAULTS;
    const json = await res.json();
    if (!json?.success || !json?.data) return BRANDING_DEFAULTS;
    const b = normalize(json.data);
    // Server-side logo URLs must be absolute — the rewrite only exists browser-side.
    const abs = (u: string) => (u.startsWith("/platform-api") ? `${apiBase}${u.replace("/platform-api", "/api")}` : u);
    return { ...b, logoLightUrl: abs(b.logoLightUrl), logoDarkUrl: abs(b.logoDarkUrl), logoSquareUrl: abs(b.logoSquareUrl) };
  } catch {
    return BRANDING_DEFAULTS;
  }
}

/** Client-side fetch used by the BrandProvider. */
export async function fetchPlatformBrandingClient(): Promise<PlatformBranding> {
  try {
    const res = await fetch("/platform-api/admin/style-settings");
    if (!res.ok) return BRANDING_DEFAULTS;
    const json = await res.json();
    if (!json?.success || !json?.data) return BRANDING_DEFAULTS;
    return normalize(json.data);
  } catch {
    return BRANDING_DEFAULTS;
  }
}
