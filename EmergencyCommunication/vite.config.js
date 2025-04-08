import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/websocket': {
        target: 'ws://your-backend',//这里写入地址
        ws: true,
        changeOrigin: true
      }
    }
  }
})
