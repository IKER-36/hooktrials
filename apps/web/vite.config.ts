import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Local UI development proxies same-origin `/api` and `/i` to a running local
// stack, so the dev server needs no CORS exception and keeps session cookies.
// Set HOOKTRIALS_LOCAL_ORIGIN to the stack's own APP_ORIGIN: the forwarded
// Origin header is rewritten to it so the API's cross-origin write guard, which
// rejects unknown origins on POST/PUT/PATCH/DELETE, accepts proxied requests.
const localOrigin = process.env.HOOKTRIALS_LOCAL_ORIGIN ?? 'http://localhost:3100';

const proxyToLocalStack = {
  target: localOrigin,
  changeOrigin: true,
  configure(proxy: { on(event: 'proxyReq', handler: (request: ProxyRequest) => void): void }) {
    proxy.on('proxyReq', (request) => request.setHeader('origin', localOrigin));
  },
};

interface ProxyRequest {
  setHeader(name: string, value: string): void;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': proxyToLocalStack,
      '/i': proxyToLocalStack,
    },
  },
  preview: {
    port: 4173,
  },
});
