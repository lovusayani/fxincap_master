import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const srcPath = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const apiBaseTarget = env.ADMIN_LOCAL_API_URL || 'http://127.0.0.1:7000'
  const adminApiTarget = env.ADMIN_API_URL || apiBaseTarget
  const wsTarget = env.WS_SERVICE_URL || 'http://127.0.0.1:4040'
  const adminApiToken = env.ADMIN_API_TOKEN || ''
  const wsAdminToken = env.WS_ADMIN_TOKEN || 'changeme-admin-token'

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      assetsDir: 'assets'
    },
    resolve: {
      alias: {
        '@': srcPath
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api/ws-admin': {
          target: wsTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api\/ws-admin/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('x-admin-token', String(wsAdminToken).trim())
            })
            proxy.on('error', (err, _req, res) => {
              if (!res || res.headersSent) return
              const msg = err?.code === 'ECONNREFUSED'
                ? `Nothing listening at ${wsTarget}. Start fxincap-ws: cd fxincapws && pnpm dev`
                : (err?.message || String(err))
              res.writeHead(503, { 'Content-Type': 'application/json' })
              res.end(
                JSON.stringify({
                  success: false,
                  error: msg,
                  providers: [],
                })
              )
            })
          }
        },
        '/api/admin/server-settings': {
          target: apiBaseTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (adminApiToken) {
                proxyReq.setHeader('authorization', `Bearer ${adminApiToken}`)
              }
            })
          }
        },
        '/api/admin': {
          target: adminApiTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (adminApiToken) {
                proxyReq.setHeader('authorization', `Bearer ${adminApiToken}`)
              }
            })
          }
        },
        '/api/admin-auth': {
          target: apiBaseTarget,
          changeOrigin: true
        }
      }
    }
  }
})
