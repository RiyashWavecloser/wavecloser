import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for this mode
  const env = loadEnv(mode, process.cwd(), '');

  console.log('[Vite Build] VITE_CLAUDE_PROXY_URL:', env.VITE_CLAUDE_PROXY_URL || 'NOT SET');

  return {
    plugins: [react()],
    define: {
      // Explicitly define the variable so it is always available
      'import.meta.env.VITE_CLAUDE_PROXY_URL': JSON.stringify(
        env.VITE_CLAUDE_PROXY_URL || ''
      ),
    },
    build: {
      outDir: 'dist',
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
