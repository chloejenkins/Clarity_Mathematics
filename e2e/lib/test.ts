import { test as base } from "@playwright/test";
import type { Persona } from "./personas";
import { pageAs, type PersonaPage } from "./session";

/**
 * `open(persona)` gives a page signed in as that persona. Every page opened in
 * a test is closed when the test ends, so pollers from earlier tests (chat,
 * schedule, payment banner) don't pile up and trip the API's rate limiter.
 */
export const test = base.extend<{ open: (persona: Persona) => Promise<PersonaPage> }>({
  open: async ({ browser }, use) => {
    const pages: PersonaPage[] = [];
    await use(async (persona) => {
      const page = await pageAs(browser, persona);
      pages.push(page);
      return page;
    });
    const failures = pages.flatMap((p) => p.apiFailures);
    if (failures.length) {
      await base.info().attach("api-failures.txt", { body: failures.join("\n"), contentType: "text/plain" });
      console.log(`[${base.info().title}] API failures:\n  ${failures.join("\n  ")}`);
    }
    await Promise.all(pages.map((p) => p.context().close()));
  },
});

export { expect } from "@playwright/test";
