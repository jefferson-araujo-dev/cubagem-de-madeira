import { test, expect } from "./fixtures.js";
import { gotoFresh, enterLocalMode, fillWoodForm, submitWoodForm } from "./helpers.js";

// Grupo G — Persistência. Comportamento real observado: os dados ficam
// salvos em localStorage entre reloads, mas o "modo local" em si não é
// lembrado (estado em memória, não persistido) — após reload, o modal de
// autenticação reaparece e é necessário reentrar no modo offline para
// visualizar os dados novamente.
test.describe("Persistência local entre reloads", () => {
  test("dados criados localmente sobrevivem a um reload após reentrar no modo local", async ({
    page,
  }) => {
    await gotoFresh(page);
    await enterLocalMode(page);
    await fillWoodForm(page, { length: 1, width: 1, thickness: 0.5, qty: 2 });
    await submitWoodForm(page);

    await expect(page.locator("#tableBody tr").first()).toContainText(
      "Prancha de Madeira",
    );

    await page.reload();

    // Comportamento observado: o modal de autenticação volta a aparecer.
    await page.locator("#authModal").waitFor({ state: "visible" });
    await enterLocalMode(page);

    const row = page.locator("#tableBody tr").first();
    await expect(row).toContainText("Prancha de Madeira");
    await expect(row.locator("td").nth(3)).toContainText("1.00");
    await expect(page.locator("#statCount")).toHaveText("2");
  });
});
