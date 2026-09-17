import fs from "node:fs";
import XLSX from "xlsx-js-style";
import { test, expect } from "./fixtures.js";
import { gotoFresh, enterLocalMode, fillWoodForm, submitWoodForm } from "./helpers.js";

// Grupo H — Exportação Excel. Valida nome/extensão do download e a
// coerência do conteúdo da planilha com o contrato v1 (cabeçalhos, valores
// por registro e Volume Total Oficial), usando a mesma biblioteca
// (xlsx-js-style) já usada pela aplicação para gerar o arquivo.
test.describe("Exportação Excel", () => {
  test("gera arquivo .xlsx ao exportar registro local", async ({ page }) => {
    await gotoFresh(page);
    await enterLocalMode(page);
    await fillWoodForm(page, {
      woodType: "Prancha Ipê",
      length: 1,
      width: 1,
      thickness: 0.5,
      qty: 2,
    });
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

  test("conteúdo do Excel segue o contrato v1: cabeçalhos, valores por registro e Volume Total Oficial", async ({
    page,
  }) => {
    await gotoFresh(page);
    await enterLocalMode(page);

    // Registro 1: 1,00 x 1,00 x 0,50 x qtd 2 -> volume oficial 1,00 m³
    await fillWoodForm(page, {
      woodType: "Prancha Ipê",
      length: 1,
      width: 1,
      thickness: 0.5,
      qty: 2,
    });
    await submitWoodForm(page);

    // Registro 2: caso de referência do contrato -> gross 0,118272, oficial 0,12 m³
    await fillWoodForm(page, {
      woodType: "Prancha Freijó",
      length: 4.62,
      width: 0.32,
      thickness: 0.08,
      qty: 1,
    });
    await submitWoodForm(page);

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#exportExcelBtn").click();
    const download = await downloadPromise;
    const filePath = await download.path();

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    expect(rows.length).toBe(3); // 2 registros + linha TOTAL

    const expectedHeaders = [
      "Madeira",
      "Comprimento (m)",
      "Largura (m)",
      "Espessura (m)",
      "Quantidade",
      "Volume Bruto (m³)",
      "Volume Oficial (m³)",
      "Data de Criação",
      "Última Atualização",
    ];
    for (const header of expectedHeaders) {
      expect(Object.keys(rows[0])).toContain(header);
    }

    const registros = rows.filter((r) => r["Madeira"] !== "TOTAL");
    const total = rows.find((r) => r["Madeira"] === "TOTAL");

    const ipe = registros.find((r) => r["Madeira"] === "Prancha Ipê");
    expect(ipe["Comprimento (m)"]).toBe(1);
    expect(ipe["Largura (m)"]).toBe(1);
    expect(ipe["Espessura (m)"]).toBe(0.5);
    expect(ipe["Quantidade"]).toBe(2);
    expect(ipe["Volume Bruto (m³)"]).toBe(1);
    expect(ipe["Volume Oficial (m³)"]).toBe(1);
    expect(ipe["Data de Criação"]).toBeTruthy();
    expect(ipe["Última Atualização"]).toBeTruthy();

    const freijo = registros.find((r) => r["Madeira"] === "Prancha Freijó");
    expect(freijo["Comprimento (m)"]).toBe(4.62);
    expect(freijo["Largura (m)"]).toBe(0.32);
    expect(freijo["Espessura (m)"]).toBe(0.08);
    expect(freijo["Quantidade"]).toBe(1);
    // Volume Bruto preserva o valor exato (não arredondado para 2 casas) e
    // Volume Oficial é o HALF-UP em 2 casas — os dois precisam ficar
    // distintos na planilha, não ambos aparecendo como 0,12.
    expect(freijo["Volume Bruto (m³)"]).toBe(0.118272);
    expect(freijo["Volume Oficial (m³)"]).toBe(0.12);
    expect(freijo["Volume Bruto (m³)"]).not.toBe(freijo["Volume Oficial (m³)"]);

    // Volume Total Oficial = soma dos officialVolumeM3 (1,00 + 0,12 = 1,12), não dos brutos.
    expect(total["Volume Oficial (m³)"]).toBeCloseTo(1.12, 2);
    expect(total["Quantidade"]).toBe(3);
  });
});
