import { defineConfig, devices } from "@playwright/test";

// Configuração dedicada para testes de PWA/Service Worker/offline.
// Roda contra o build de produção servido por `vite preview` (não `vite dev`),
// pois o Service Worker só é gerado no build (mode generateSW do vite-plugin-pwa).
// Usa uma porta separada da suíte funcional (playwright.config.js, porta 5183)
// para permitir execução independente e evitar conflito caso ambas rodem juntas.
const PORT = 4183;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /pwa-offline\.spec\.js/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-pwa" }]],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "Desktop Chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
