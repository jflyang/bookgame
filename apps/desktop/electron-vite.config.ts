import { defineConfig } from "electron-vite";

export default defineConfig({
  main: {
    build: {
      outDir: "dist/main",
      rollupOptions: {
        external: ["electron", "electron-store", "get-port", "node:child_process", "node:path", "node:fs", "node:url"]
      }
    }
  },
  preload: {
    build: {
      outDir: "dist/preload"
    }
  },
  renderer: {
    build: {
      outDir: "dist/renderer"
    }
  }
});
