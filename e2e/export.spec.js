import fs from "node:fs";
import { test, expect } from "./fixtures.js";
import { gotoFresh, enterLocalMode, fillWoodForm, submitWoodForm } from "./helpers.js";

// Grupo H — Exportação Excel. Verifica apenas que o download é disparado
// com nome/extensão corretos e conteúdo não vazio; não faz parsing do XLSX.
test.describe("Exportação Excel", () => {
  test("gera arquivo .xlsx ao exportar registro local", async ({ page }) => {
    await gotoFresh(page);
    await enterLocalMode(page);
    await fillWoodForm(page, { length: 1, width: 1, thickness: 0.5, qty: 2 });
    await submitWoodForm(page);

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportExcelBtn").click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^relatorio_cubagem_\d{8}\.xlsx$/,
    );

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(0);
  });
});
