import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const sharedHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  };
  const policy = "default-src 'self'; script-src 'self'; img-src 'self' blob:; media-src 'self' blob:; "
    + "font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; ";
  return {
    server: {
      host: '127.0.0.1',
      port: 5178,
      strictPort: true,
      headers: {
        ...sharedHeaders,
        'Content-Security-Policy': policy + "style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:* ws://localhost:*;",
      },
      proxy: {
        '/api': {
          target: env.VITE_PROXY_TARGET || 'http://127.0.0.1:7861',
          changeOrigin: false,
        },
      },
    },
    preview: {
      host: '127.0.0.1', port: 5178, strictPort: true,
      headers: {
        ...sharedHeaders,
        'Content-Security-Policy': policy + "style-src 'self'; connect-src 'self';",
      },
    },
    build: { target: 'es2022', sourcemap: false },
  };
});
