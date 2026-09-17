import { test, expect } from "./fixtures.js";

// Grupo B — Autenticação visual. Nenhuma autenticação real é realizada:
// não há envio de reset de senha nem criação de usuário Firebase.
test.describe("Autenticação visual", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#authModal").waitFor({ state: "visible" });
  });

  test("modal de autenticação aparece com campos de email e senha", async ({
    page,
  }) => {
    await expect(page.locator("#authModal")).toBeVisible();
    await expect(page.locator("#emailInput")).toBeVisible();
    await expect(page.locator("#passwordInput")).toBeVisible();
    await expect(page.locator("#authTitle")).toHaveText("Bem-vindo de volta");
  });

  test("alterna entre Login e Cadastro", async ({ page }) => {
    await page.locator("#toggleAuthBtn").click();
    await expect(page.locator("#authTitle")).toHaveText("Criar Conta");
    await expect(page.locator("#forgotPasswordBtn")).toBeHidden();

    await page.locator("#toggleAuthBtn").click();
    await expect(page.locator("#authTitle")).toHaveText("Bem-vindo de volta");
    await expect(page.locator("#forgotPasswordBtn")).toBeVisible();
  });

  test("recuperação de senha está acessível (sem envio real)", async ({
    page,
  }) => {
    await expect(page.locator("#forgotPasswordBtn")).toBeVisible();
    await expect(page.locator("#forgotPasswordBtn")).toBeEnabled();
  });
});
