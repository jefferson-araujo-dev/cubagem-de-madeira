import { test, expect } from "./fixtures.js";

// Cobertura de baseline PWA/Service Worker/offline (Gate 20.1).
//
// Roda exclusivamente contra o build de produção servido por `vite preview`
// (ver playwright.pwa.config.js), pois o Service Worker só é gerado pelo
// vite-plugin-pwa no `vite build` (mode generateSW) — não existe no `vite dev`.
//
// Objetivo: provar que o app shell atual (nav/main/footer/formulário/tabela)
// continua acessível após reload com o navegador totalmente offline, graças
// ao precache do Service Worker — não apenas que `navigator.serviceWorker`
// existe.
test.describe("PWA offline baseline", () => {
  test("registra o Service Worker, controla a página e sobrevive a reload offline", async ({
    page,
    context,
  }) => {
    // A. Carrega a aplicação online.
    await page.goto("/");

    // B/C. Aguarda o registro real do Service Worker via API do navegador.
    await page.waitForFunction(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const registration = await navigator.serviceWorker.ready;
      return !!registration.active;
    });

    // D. Garante que a página está efetivamente controlada pelo SW ativo.
    // Se o primeiro load registrou o SW mas ainda não assumiu o controle
    // (comum na primeira visita, antes do "claim"), um único reload online
    // é suficiente para que o SW já ativo passe a controlar a página.
    let controlled = await page.evaluate(
      () => !!navigator.serviceWorker.controller,
    );
    if (!controlled) {
      await page.reload();
      await page.waitForFunction(
        () => !!navigator.serviceWorker.controller,
      );
      controlled = true;
    }
    expect(controlled).toBe(true);

    // E. Confirma que a aplicação está funcional online (app shell real).
    await expect(page).toHaveTitle("CubagemPro | Gestão de Madeira");
    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator("#woodForm")).toBeAttached();
    await expect(page.locator("#tableBody")).toBeAttached();

    // F/G. Coloca o contexto offline e recarrega a página.
    await context.setOffline(true);
    try {
      await page.reload();

      // H. O documento deve continuar carregando (sem falha de navegação).
      await page.waitForLoadState("domcontentloaded");

      // I. UI principal continua visível/funcional — sem tela branca.
      // (Requests externos como Firebase são esperados falhar offline; o
      // que importa aqui é que o app shell, servido pelo cache do SW,
      // renderiza normalmente.)
      await expect(page).toHaveTitle("CubagemPro | Gestão de Madeira");
      await expect(page.locator("nav")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("footer")).toBeVisible();
      await expect(page.locator("#woodForm")).toBeAttached();
      await expect(page.locator("#tableBody")).toBeAttached();

      const bodyText = await page.locator("body").innerText();
      expect(bodyText.trim().length).toBeGreaterThan(0);
    } finally {
      // J. Restaura o contexto para online.
      await context.setOffline(false);
    }
  });
});
