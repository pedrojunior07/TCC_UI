import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://102.211.186.44:8080'
  const certProxyTarget = env.VITE_CERT_PROXY_TARGET || 'http://102.211.186.44:5002'

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: false,
        },
        '/ocr-api': {
          target: certProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
