import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend dev server proxies /api requests to the Express backend
// (default http://localhost:3000, override with VITE_API_PROXY_TARGET).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 (IPv4 + IPv6) so localhost always resolves
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
