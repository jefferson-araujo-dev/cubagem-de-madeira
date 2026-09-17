import { test, expect } from "./fixtures.js";

// Grupo A — Inicialização. Executa em Desktop e Mobile (ver playwright.config.js)
// para detectar quebras estruturais básicas em ambos os viewports.
test.describe("Inicialização", () => {
  test("abre a página, exibe o título esperado e a estrutura principal", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("CubagemPro | Gestão de Madeira");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator("#woodForm")).toBeAttached();
    await expect(page.locator("#tableBody")).toBeAttached();
  });
});
