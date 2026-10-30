import { defineConfig, type UserConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// In development the frontend runs on http://localhost:5173 and proxies /api
// to the FastAPI backend on http://localhost:8000. This keeps the browser on a
// single origin (localhost:5173 is a "secure context" so the webcam works) and
// avoids CORS issues during local development.
const viteConfig: UserConfig = {
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "AgroDoc — Your AI Farming Assistant",
        short_name: "AgroDoc",
        description: "AI-powered farming assistant for Indian farmers",
        theme_color: "#15803d",
        background_color: "#f8faf9",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // Do not aggressively cache API responses; keep network-first for /api.
        navigateFallbackDenylist: [/^\/api/],
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/docs": { target: "http://localhost:8000", changeOrigin: true },
      "/openapi.json": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
};

// Vitest reads its options from the `test` field, which it adds to Vite's
// config via a runtime augmentation. We attach it separately so the Vite parts
// stay fully type-checked.
const testConfig = {
  globals: true,
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
  css: true,
};

export default defineConfig({
  ...viteConfig,
  test: testConfig,
} as UserConfig & { test: typeof testConfig });
