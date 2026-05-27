import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/media": {
        target: "http://localhost:4000",
        changeOrigin: true,
      }
    },
    headers: {
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:* ws://localhost:*; font-src 'self' data: http://localhost:*; img-src 'self' data: http://localhost:*; media-src 'self' http://localhost:*;"
    }
  },
  worker: {
    format: "es"
  }
});
