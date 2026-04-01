/**
 * REST API base URL (no trailing slash). Set `VITE_API_URL` at build/dev time to your
 * fxincapapi origin, e.g. `http://localhost:7000` or `https://api.fxincap.com`.
 * When unset, requests stay same-origin and rely on the Vite dev proxy or reverse proxy.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (raw == null || String(raw).trim() === "") return "";
  return String(raw).replace(/\/+$/, "");
}

/** Prefix an API path (`/api/...`) with the configured API base. */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${p}` : p;
}
