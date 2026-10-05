import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      // 启动时预打包主要依赖，避免首次打开页面时“边发现依赖边优化”导致的二次加载/整页刷新
      include: ['react', 'react-dom', 'react-dom/client', 'lucide-react'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // 服务启动后立即在后台预热转换入口文件，浏览器打开时模块已就绪
      warmup: {
        clientFiles: ['./index.html', './src/**/*'],
      },
    },
  };
});
