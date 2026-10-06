import { defineConfig } from 'vite';

// Tauri 使用固定端口 5173，dev 模式下 WebView 加载该地址
export default defineConfig({
  root: 'src',
  base: './',
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    watch: {
      // 编辑器保存文件时会生成 .xxx.tmpdir 临时目录，chokidar 若监听到
      // 其中被独占锁定的临时文件会抛 EBUSY 并让整个 dev server 退出。
      // 这些目录与构建无关，直接忽略。
      ignored: ['**/.*tmpdir*/**', '**/*.tmp']
    }
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2021',
    sourcemap: false,
    chunkSizeWarningLimit: 1600
  },
  // Phaser 与 Tauri API 均以全局 window 使用，无需 optimizeDeps 预打包
  optimizeDeps: {
    exclude: ['@tauri-apps/api']
  }
});