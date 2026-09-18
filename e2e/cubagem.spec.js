import { test, expect } from "./fixtures.js";
import { gotoFresh, enterLocalMode, fillWoodForm, submitWoodForm } from "./helpers.js";

// Grupos D, E e F — Cubagem local (criação, edição e exclusão).
// localStorage é limpo antes de cada teste via gotoFresh().
test.describe("Cubagem local — criação", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
    await enterLocalMode(page);
  });

  test("cria registro e reflete na listagem, madeira, medidas, quantidade, volume e totais", async ({
    page,
  }) => {
    // 1,00 x 1,00 x 0,50 x qtd 2 = 1,00 m³ (contrato v1: officialVolumeM3 arredondado a 2 casas)
    await fillWoodForm(page, {
      woodType: "Prancha Ipê",
      length: 1,
      width: 1,
      thickness: 0.5,
      qty: 2,
    });
    await submitWoodForm(page);

    const row = page.locator("#tableBody tr").first();
    const cells = row.locator("td");

    await expect(cells.nth(0)).toContainText("Prancha Ipê");
    await expect(cells.nth(1)).toContainText("1,00 x 1,00 x 0,50");
    await expect(cells.nth(2)).toContainText("2");
    await expect(cells.nth(3)).toContainText("1,00");

    await expect(page.locator("#statCount")).toHaveText("2");
    await expect(page.locator("#statVolume")).toHaveText("1,00");
    await expect(page.locator("#navTotalVolume")).toHaveText("1,00 m³");
    await expect(page.locator("#tableTotalQtd")).toHaveText("2");
    await expect(page.locator("#tableTotalVol")).toHaveText("1,00 m³");
  });

  // Gate 12: digitação real, tecla por tecla (não fill() do valor pronto),
  // cobrindo o caso oficial do contrato (462/32/8 -> 4,62 x 0,32 x 0,08 =
  // 0,12 m³) e o comportamento de Backspace em pelo menos um campo.
  test("máscara decimal automática: digitação sequencial real e Backspace", async ({
    page,
  }) => {
    await page.locator("#woodType").selectOption("Prancha Ipê");

    const lengthInput = page.locator("#length");
    await lengthInput.pressSequentially("462");
    await expect(lengthInput).toHaveValue("4,62");

    // Backspace: 4,62 -> 0,46 -> 0,04 -> vazio
    await lengthInput.press("Backspace");
    await expect(lengthInput).toHaveValue("0,46");
    await lengthInput.press("Backspace");
    await expect(lengthInput).toHaveValue("0,04");
    await lengthInput.press("Backspace");
    await expect(lengthInput).toHaveValue("");

    // Redigita o comprimento oficial e completa largura/espessura.
    await lengthInput.pressSequentially("462");
    await expect(lengthInput).toHaveValue("4,62");

    const widthInput = page.locator("#width");
    await widthInput.pressSequentially("32");
    await expect(widthInput).toHaveValue("0,32");

    const thicknessInput = page.locator("#thickness");
    await thicknessInput.pressSequentially("8");
    await expect(thicknessInput).toHaveValue("0,08");

    await page.locator("#qty").fill("1");
    await submitWoodForm(page);

    const row = page.locator("#tableBody tr").first();
    const cells = row.locator("td");
    await expect(cells.nth(1)).toContainText("4,62 x 0,32 x 0,08");
    await expect(cells.nth(3)).toContainText("0,12");
    await expect(page.locator("#statVolume")).toHaveText("0,12");
  });

  test("não permite salvar sem selecionar uma madeira válida", async ({
    page,
  }) => {
    await page.locator("#length").fill("1");
    await page.locator("#width").fill("1");
    await page.locator("#thickness").fill("0,5");
    await page.locator("#qty").fill("1");
    await submitWoodForm(page);

    await expect(page.locator("#tableBody")).toContainText(
      "A lista está vazia.",
    );
  });

  // Gate 12: a máscara decimal automática torna estruturalmente impossível
  // digitar mais de 2 casas decimais no campo — digitar mais algarismos
  // apenas desloca a posição da vírgula (ex.: "4625" -> "46,25"), em vez de
  // produzir um valor com 3+ casas. A rejeição de valores com mais de 2
  // casas decimais continua coberta a nível de parseDimension em
  // js/schema.test.js; aqui validamos o comportamento observável da máscara.
  test("digitar mais algarismos desloca a vírgula em vez de gerar mais de 2 casas decimais", async ({
    page,
  }) => {
    await page.locator("#woodType").selectOption("Prancha Freijó");
    await page.locator("#length").fill("4625");
    await expect(page.locator("#length")).toHaveValue("46,25");
    await page.locator("#width").fill("100");
    await page.locator("#thickness").fill("100");
    await page.locator("#qty").fill("1");
    await submitWoodForm(page);

    const row = page.locator("#tableBody tr").first();
    await expect(row.locator("td").nth(1)).toContainText("46,25 x 1,00 x 1,00");
  });

  test("rejeita dimensão zero (campo vazio ao apagar todos os algarismos)", async ({
    page,
  }) => {
    await fillWoodForm(page, {
      woodType: "Prancha Freijó",
      length: 0,
      width: 1,
      thickness: 0.5,
      qty: 1,
    });
    await expect(page.locator("#length")).toHaveValue("");
    await submitWoodForm(page);
    await expect(page.locator("#tableBody")).toContainText(
      "A lista está vazia.",
    );
  });

  // Gate 12: a máscara sanitiza o sinal de menos, então não é mais possível
  // digitar um valor negativo no campo — "-1" é interpretado como os
  // algarismos "1", resultando em 0,01 (positivo), nunca em um número
  // negativo. Isso substitui a antiga verificação de rejeição no submit,
  // já que o valor negativo deixa de ser representável na UI.
  test("sinal de negativo digitado não produz valor negativo", async ({
    page,
  }) => {
    await page.locator("#woodType").selectOption("Prancha Freijó");
    await page.locator("#length").fill("-1");
    await expect(page.locator("#length")).toHaveValue("0,01");
    await expect(page.locator("#length")).not.toHaveValue(/-/);
  });

  test("rejeita quantidade fracionária ou menor que 1", async ({ page }) => {
    await page.locator("#woodType").selectOption("Prancha Freijó");
    await page.locator("#length").fill("1");
    await page.locator("#width").fill("1");
    await page.locator("#thickness").fill("0,5");
    await page.locator("#qty").fill("1.5");
    await submitWoodForm(page);

    await expect(page.locator("#tableBody")).toContainText(
      "A lista está vazia.",
    );
  });
});

test.describe("Cubagem local — edição", () => {
  test.beforeEach(async ({ page }) => {
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
  });

  test("edita registro, salva e atualiza conteúdo e total", async ({
    page,
  }) => {
    await page.locator('[data-action="edit"]').first().click();

    await expect(page.locator("#formTitle")).toHaveText("Editar Entrada");
    await expect(page.locator("#woodType")).toHaveValue("Prancha Ipê");
    await expect(page.locator("#length")).toHaveValue("1,00");
    await expect(page.locator("#width")).toHaveValue("1,00");
    await expect(page.locator("#thickness")).toHaveValue("0,50");
    await expect(page.locator("#qty")).toHaveValue("2");

    await page.locator("#qty").fill("3");
    await submitWoodForm(page);

    const row = page.locator("#tableBody tr").first();
    const cells = row.locator("td");
    await expect(cells.nth(2)).toContainText("3");
    await expect(cells.nth(3)).toContainText("1,50");

    await expect(page.locator("#statVolume")).toHaveText("1,50");
    await expect(page.locator("#tableTotalVol")).toHaveText("1,50 m³");
  });

  test("editar apenas a madeira preserva o volume", async ({ page }) => {
    await page.locator('[data-action="edit"]').first().click();
    await page.locator("#woodType").selectOption("Prancha Cedrinho");
    await submitWoodForm(page);

    const row = page.locator("#tableBody tr").first();
    const cells = row.locator("td");
    await expect(cells.nth(0)).toContainText("Prancha Cedrinho");
    await expect(cells.nth(3)).toContainText("1,00");
    await expect(page.locator("#statVolume")).toHaveText("1,00");
  });
});

test.describe("Cubagem local — exclusão", () => {
  test.beforeEach(async ({ page }) => {
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
    await expect(page.locator("#statVolume")).toHaveText("0,00");
    await expect(page.locator("#tableTotalVol")).toHaveText("0,00 m³");
  });

  test("cancelar a confirmação mantém o registro", async ({ page }) => {
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator('[data-action="delete"]').first().click();

    await expect(page.locator("#tableBody")).toContainText("Prancha Ipê");
    await expect(page.locator("#statCount")).toHaveText("2");
  });
});
