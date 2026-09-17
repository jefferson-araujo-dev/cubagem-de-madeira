import { test, expect } from "./fixtures.js";
import { enterLocalMode } from "./helpers.js";

// Grupo C — Modo local/offline, ativado pelo fluxo real da aplicação
// (botão "Continuar Offline"). Nenhuma escrita no Firestore ocorre.
test.describe("Modo local/offline", () => {
  test("ativa modo local e permite acesso à aplicação", async ({ page }) => {
    await page.goto("/");
    await enterLocalMode(page);

    await expect(page.locator("#authModal")).toBeHidden();
    await expect(page.locator("#userEmailLabel")).toHaveText("Offline");
    await expect(page.locator("#loginBtn")).toBeVisible();
    await expect(page.locator("#logoutBtn")).toBeHidden();
    await expect(page.locator("#woodForm")).toBeVisible();
  });
});
