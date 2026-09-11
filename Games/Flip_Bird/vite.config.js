import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: false,
    host: true
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision']
  }
});
