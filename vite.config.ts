import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
// Plugin to serve /roleta/ as static pages (not handled by SPA)
function roletaStaticPlugin() {
  return {
    name: "roleta-static",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Redirect /roleta and /roleta/ to serve the static index.html
        if (req.url === "/roleta" || req.url === "/roleta/") {
          req.url = "/roleta/index.html";
        }
        // Redirect /roleta/admin and /roleta/admin/ to serve the static admin index.html
        else if (req.url === "/roleta/admin" || req.url === "/roleta/admin/") {
          req.url = "/roleta/admin/index.html";
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    fs: {
      allow: ["."],
    },
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [roletaStaticPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          charts: ["recharts"],
          ui: ["@tanstack/react-query", "framer-motion", "embla-carousel-react", "lucide-react"],
        },
      },
    },
  },
}));
