import type { Browser, Page, APIRequestContext } from "@playwright/test";
import { request } from "@playwright/test";
import { identityJson, tokenFor, type Persona } from "./personas";

export const WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:5173";
export const API_URL = process.env.E2E_API_URL ?? "http://localhost:3001";

// The API rate-limits per client IP (120 requests a minute) and trusts one
// proxy hop. The harness moves far faster than a person, so each browser
// context gets its own address, as if every page were a separate device;
// otherwise the polling pages of one persona exhaust a shared budget.
let nextIp = 0;
function freshIp(): string {
  nextIp += 1;
  return `10.${(nextIp >> 16) & 255}.${(nextIp >> 8) & 255}.${nextIp & 255}`;
}

export interface PersonaPage extends Page {
  /** Console errors and uncaught exceptions seen on this page so far. */
  errors: string[];
  /** API calls from this page that came back 4xx/5xx, as "METHOD /path -> status". */
  apiFailures: string[];
}

/** A page signed in as the persona (through the fake Clerk SDK). */
export async function pageAs(browser: Browser, persona: Persona): Promise<PersonaPage> {
  const context = await browser.newContext({
    baseURL: WEB_URL,
    viewport: { width: 1280, height: 900 },
    timezoneId: process.env.TZ,
    extraHTTPHeaders: { "X-Forwarded-For": freshIp() },
  });
  await context.addInitScript((json) => localStorage.setItem("e2e-identity", json), identityJson(persona));
  const page = (await context.newPage()) as PersonaPage;
  page.errors = [];
  page.apiFailures = [];
  page.on("response", (r) => {
    const url = new URL(r.url());
    if (url.pathname.startsWith("/api/") && r.status() >= 400) {
      page.apiFailures.push(`${r.request().method()} ${url.pathname} -> ${r.status()}`);
    }
  });
  page.on("console", (m) => { if (m.type() === "error") page.errors.push(m.text()); });
  page.on("pageerror", (e) => page.errors.push(String(e)));
  return page;
}

/** A raw API client authenticated as the persona, for setup and for probing the server directly. */
export async function apiAs(persona: Persona): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: {
      Authorization: `Bearer ${tokenFor(persona)}`,
      Origin: WEB_URL,
      "X-Forwarded-For": freshIp(),
    },
  });
}

/** Client-side navigation through the sidebar, the way a person moves around. */
export async function navigate(page: Page, linkName: string): Promise<void> {
  await page.getByRole("link", { name: linkName, exact: true }).first().click();
}

/** Waits for a toast whose title matches. */
export async function expectToast(page: Page, text: string | RegExp): Promise<void> {
  await page.getByRole("region", { name: /Notifications/ }).getByText(text).first().waitFor();
}
