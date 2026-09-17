import { test, expect } from "./fixtures.js";
import { gotoFresh, enterLocalMode, fillWoodForm, submitWoodForm } from "./helpers.js";

// Grupo H — Registros legados (pré-v1) no localStorage. Reproduz o cenário
// do GATE 10.1: um registro salvo antes do contrato v1 (sem woodType, sem
// schemaVersion/formulaVersion) não pode derrubar a renderização da tabela.
// O registro legado deve ser ignorado pelo fluxo operacional, sem crash e
// sem migração/exclusão automática do localStorage.
test.describe("Registros legados no localStorage", () => {
  test("registro legado sem woodType não derruba renderTable e é ignorado", async ({
    page,
  }) => {
    await gotoFresh(page);

    await page.evaluate(() => {
      const legacyRecord = {
        desc: "Peroba antiga",
        length: 4,
        width: 0.3,
        thickness: 0.05,
        qty: 10,
        volume: 0.6,
      };
      localStorage.setItem(
        "cubagempro_local_v1",
        JSON.stringify([legacyRecord]),
      );
    });

    await page.reload();
    await enterLocalMode(page);

    // Sem crash: a tabela renderiza vazia (registro legado ignorado), não
    // trava a aplicação.
    await expect(page.locator("#tableBody")).toContainText(
      "A lista está vazia.",
    );
    await expect(page.locator("#statCount")).toHaveText("0");
  });

  test("registros v1 continuam aparecendo e total ignora o registro legado misturado", async ({
    page,
  }) => {
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

    await expect(page.locator("#tableBody tr").first()).toContainText(
      "Prancha Ipê",
    );

    // Injeta um registro legado diretamente no localStorage, ao lado do
    // registro v1 já criado pela UI.
    await page.evaluate(() => {
      const raw = localStorage.getItem("cubagempro_local_v1");
      const items = JSON.parse(raw);
      items.push({
        desc: "Registro legado misturado",
        length: 3,
        width: 0.2,
        thickness: 0.04,
        qty: 5,
        volume: 0.12,
      });
      localStorage.setItem("cubagempro_local_v1", JSON.stringify(items));
    });

    await page.reload();
    await page.locator("#authModal").waitFor({ state: "visible" });
    await enterLocalMode(page);

    // Apenas o registro v1 aparece; o total reflete somente ele.
    const rows = page.locator("#tableBody tr");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Prancha Ipê");
    await expect(page.locator("#statCount")).toHaveText("2");
  });
});
