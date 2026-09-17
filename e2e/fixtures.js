import { test as base, expect } from "@playwright/test";

// Captura erros JS não tratados e erros de console em toda a suíte.
// Falha o teste apenas em exceções não tratadas (pageerror); erros de
// console são apenas registrados, pois podem ser ruído esperado (ex.:
// console.error usado intencionalmente em blocos de tratamento de erro).
export const test = base.extend({
  page: async ({ page }, use) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on("pageerror", (err) => pageErrors.push(err));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await use(page);

    if (consoleErrors.length > 0) {
      console.log(`[console.error observado]\n${consoleErrors.join("\n")}`);
    }

    if (pageErrors.length > 0) {
      throw new Error(
        `Exceção(ões) JavaScript não tratada(s):\n${pageErrors
          .map((e) => e.stack || e.message)
          .join("\n")}`,
      );
    }
  },
});

export { expect };
