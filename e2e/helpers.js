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

// Os campos de dimensão (length/width/thickness) aceitam o valor digitado
// diretamente, com vírgula ou ponto como separador decimal (contrato v1).
export async function fillWoodForm(
  page,
  { woodType = "Prancha Ipê", length, width, thickness, qty },
) {
  await page.locator("#woodType").selectOption(woodType);
  await page.locator("#length").fill(String(length).replace(".", ","));
  await page.locator("#width").fill(String(width).replace(".", ","));
  await page.locator("#thickness").fill(String(thickness).replace(".", ","));
  await page.locator("#qty").fill(String(qty));
}

export async function submitWoodForm(page) {
  await page.locator("#submitBtn").click();
}
