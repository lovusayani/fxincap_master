/**
 * API + uploaded-asset base resolution for the admin panel.
 *
 * API calls must stay RELATIVE ("/api/admin/..."): the admin server proxies
 * them to the real API. Pages that hardcoded an absolute host instead sent the
 * admin's bearer token to that host — which, when the fallback domain was
 * stale, meant leaking admin credentials to a third party.
 *
 * Uploaded files are the exception: /uploads is not proxied by the admin
 * server, so those URLs need the API host, derived from the current domain
 * (admin.ncapfx.com -> api.ncapfx.com) rather than hardcoded.
 */

const API_SUBDOMAIN = 'api'

export function assetBase() {
  const configured = import.meta.env.VITE_API_BASE_URL
  // Ignore stale suimfx defaults left over from the previous branding.
  if (configured && !/suimfx/i.test(configured)) return configured.replace(/\/$/, '')

  if (typeof window === 'undefined') return ''

  const { hostname, protocol } = window.location
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:7000'
  }

  const bare = hostname.replace(/^(admin|www)\./i, '')
  return `${protocol}//${API_SUBDOMAIN}.${bare}`
}

/** Absolute URL for a file path returned by the API (KYC docs, screenshots). */
export function fileUrl(path) {
  if (!path) return null
  if (/^https?:\/\//i.test(path)) return path
  const base = assetBase()
  return path.startsWith('/') ? `${base}${path}` : `${base}/uploads/${path}`
}
