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

// Os campos de dimensão (length/width/thickness) reformatam a entrada:
// os dígitos digitados são interpretados como centésimos (ex.: "150" -> "1.50").
export async function fillWoodForm(page, { length, width, thickness, qty }) {
  await page.locator("#length").fill(String(Math.round(length * 100)));
  await page.locator("#width").fill(String(Math.round(width * 100)));
  await page.locator("#thickness").fill(String(Math.round(thickness * 100)));
  await page.locator("#qty").fill(String(qty));
}

export async function submitWoodForm(page) {
  await page.locator("#submitBtn").click();
}
