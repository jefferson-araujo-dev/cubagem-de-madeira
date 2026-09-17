import { test, expect } from "./fixtures.js";
import { gotoFresh, enterLocalMode, fillWoodForm, submitWoodForm } from "./helpers.js";

// Grupos D, E e F — Cubagem local (criação, edição e exclusão).
// localStorage é limpo antes de cada teste via gotoFresh().
test.describe("Cubagem local — criação", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await enterLocalMode(page);
  });

  test("cria registro e reflete na listagem, descrição, medidas, quantidade, volume e totais", async ({
    page,
  }) => {
    // 1.00 x 1.00 x 0.50 x qtd 2 = 1.00 m³ (comportamento atual de arredondamento: toFixed(4) no cálculo, toFixed(2) na exibição)
    await fillWoodForm(page, { length: 1, width: 1, thickness: 0.5, qty: 2 });
    await submitWoodForm(page);

    const row = page.locator("#tableBody tr").first();
    const cells = row.locator("td");

    await expect(cells.nth(0)).toContainText("Prancha de Madeira");
    await expect(cells.nth(1)).toContainText("1.00 x 1.00 x 0.50");
    await expect(cells.nth(2)).toContainText("2");
    await expect(cells.nth(3)).toContainText("1.00");

    await expect(page.locator("#statCount")).toHaveText("2");
    await expect(page.locator("#statVolume")).toHaveText("1.00");
    await expect(page.locator("#navTotalVolume")).toHaveText("1.00 m³");
    await expect(page.locator("#tableTotalQtd")).toHaveText("2");
    await expect(page.locator("#tableTotalVol")).toHaveText("1.00 m³");
  });
});

test.describe("Cubagem local — edição", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await enterLocalMode(page);
    await fillWoodForm(page, { length: 1, width: 1, thickness: 0.5, qty: 2 });
    await submitWoodForm(page);
  });

  test("edita registro, salva e atualiza conteúdo e total", async ({
    page,
  }) => {
    await page.locator('[data-action="edit"]').first().click();

    await expect(page.locator("#formTitle")).toHaveText("Editar Entrada");
    await expect(page.locator("#length")).toHaveValue("1.00");
    await expect(page.locator("#width")).toHaveValue("1.00");
    await expect(page.locator("#thickness")).toHaveValue("0.50");
    await expect(page.locator("#qty")).toHaveValue("2");

    await page.locator("#qty").fill("3");
    await submitWoodForm(page);

    const row = page.locator("#tableBody tr").first();
    const cells = row.locator("td");
    await expect(cells.nth(2)).toContainText("3");
    await expect(cells.nth(3)).toContainText("1.50");

    await expect(page.locator("#statVolume")).toHaveText("1.50");
    await expect(page.locator("#tableTotalVol")).toHaveText("1.50 m³");
  });
});

test.describe("Cubagem local — exclusão", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await enterLocalMode(page);
    await fillWoodForm(page, { length: 1, width: 1, thickness: 0.5, qty: 2 });
    await submitWoodForm(page);
  });

  test("exclui registro após confirmação e atualiza o total", async ({
    page,
  }) => {
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator('[data-action="delete"]').first().click();

    await expect(page.locator("#tableBody")).toContainText(
      "A lista está vazia.",
    );
    await expect(page.locator("#statCount")).toHaveText("0");
    await expect(page.locator("#statVolume")).toHaveText("0.00");
    await expect(page.locator("#tableTotalVol")).toHaveText("0.00 m³");
  });
});
