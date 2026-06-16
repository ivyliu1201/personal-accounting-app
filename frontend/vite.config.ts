import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET ?? 'http://localhost:8787';

  return {
    envDir: '..',
    plugins: [vue()],
    server: {
      port: 5173,
      host: 'localhost',
      proxy: {
        '/api': apiProxyTarget
      }
    }
  };
});
