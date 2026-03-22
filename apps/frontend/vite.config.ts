import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiBase = env.VITE_API_URL || "http://localhost:3001";
  // Escapa caracteres especiais de regex e exclui rotas de auth
  const apiPattern = new RegExp(
    `^${apiBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(?!api/auth)`
  );

  return {
    plugins: [
      TanStackRouterVite({ routesDirectory: "./src/routes" }),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        // Inclui assets no precache
        includeAssets: ["favicon.svg", "icon.svg", "apple-touch-icon.svg"],
        manifest: {
          name: "Gankyo — Gerenciador de Relatórios",
          short_name: "Gankyo",
          description: "Gerencie relatórios de campo com facilidade",
          theme_color: "#2d6a4f",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait",
          start_url: "/",
          scope: "/",
          icons: [
            {
              src: "/icon-192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
            },
            {
              src: "/icon-512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          // Arquivos precacheados (app shell)
          globPatterns: ["**/*.{js,css,html,svg,woff2,ico}"],
          // iOS: fallback para SPA — nunca interceptar rotas de API
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/api/],
          // Cache de chamadas GET à API — NetworkFirst com timeout
          // Se offline, serve do cache (relatórios, fazendas, etc.)
          runtimeCaching: [
            {
              urlPattern: apiPattern,
              handler: "NetworkFirst",
              options: {
                cacheName: "gankyo-api-cache",
                // iOS: timeout curto para não travar a UI
                networkTimeoutSeconds: 4,
                cacheableResponse: { statuses: [200] },
                expiration: {
                  maxEntries: 200,
                  // 7 dias
                  maxAgeSeconds: 7 * 24 * 60 * 60,
                },
              },
            },
          ],
        },
        // Não registrar SW em dev por padrão (evita conflitos de cache durante dev)
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
    },
  };
});
