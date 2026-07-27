import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"


export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Route-level lazy loading keeps the entry chunk below Vite's default
    // budget. Two self-contained feature routes are slightly larger while
    // remaining under 200 kB gzip, so retain a meaningful higher ceiling.
    chunkSizeWarningLimit: 650,
  },
  optimizeDeps: {
    include: [
      "recharts > @reduxjs/toolkit",
      "motion > framer-motion",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Same-origin /api in dev avoids CORS coupling to a specific dev port.
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
        configure: (proxy) => {
          // The backend CORS allowlist only contains the default dev origin;
          // present that origin so proxied requests pass its CORS filter.
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("origin", "http://localhost:5173")
          })
        },
      },
    },
  },
})
