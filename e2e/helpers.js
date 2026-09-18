// Helpers para o fluxo real de acesso ao modo local/offline da aplicação.
// A chave de localStorage ("cubagempro_local_v1") e o comportamento de
// modo local são definidos em js/store.js e main.js.

export async function gotoFresh(page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

export async function enterLocalMode(page) {
  const modal = page.locator("#authModal");
  await modal.waitFor({ state: "visible" });
  await page.locator("#forceLocalAuthBtn").click();
  await modal.waitFor({ state: "hidden" });
}

// Os campos de dimensão (length/width/thickness) usam máscara decimal
// automática (contrato v1 + Gate 12): o campo só aceita algarismos e
// posiciona os 2 últimos como casas decimais (ex.: "462" -> "4,62"). Por
// isso o valor em metros recebido aqui é convertido para a sequência de
// algarismos equivalente (metros * 100) antes de preencher o campo, para
// que o significado do argumento (ex.: length: 1 -> 1 metro) permaneça
// o mesmo de antes da máscara.
function toMaskedDigits(valueInMeters) {
  return String(Math.round(Number(valueInMeters) * 100));
}

export async function fillWoodForm(
  page,
  { woodType = "Prancha Ipê", length, width, thickness, qty },
) {
  await page.locator("#woodType").selectOption(woodType);
  await page.locator("#length").fill(toMaskedDigits(length));
  await page.locator("#width").fill(toMaskedDigits(width));
  await page.locator("#thickness").fill(toMaskedDigits(thickness));
  await page.locator("#qty").fill(String(qty));
}

export async function submitWoodForm(page) {
  await page.locator("#submitBtn").click();
}
