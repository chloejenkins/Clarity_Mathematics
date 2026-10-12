// The AI explorer: Claude plays one persona in a real browser, pursues a goal
// the way that person would, and reports bugs and friction it runs into.
//
//   pnpm --filter @workspace/e2e run explore -- tutor-week
//   pnpm --filter @workspace/e2e run explore -- all
//
// Needs the stack running (scripts/start-stack.sh), the personas onboarded
// (run the Playwright specs once), and Anthropic credentials (ANTHROPIC_API_KEY
// or an `ant auth login` profile). Findings go to reports/agent-<mission>.md.
import Anthropic from "@anthropic-ai/sdk";
import { chromium, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { personas } from "../lib/personas";
import { pageAs, type PersonaPage } from "../lib/session";
import { missions, type Mission } from "./missions";

const here = path.dirname(fileURLToPath(import.meta.url));
const reportsDir = path.join(here, "..", "reports");
const fixturesDir = path.join(here, "..", "fixtures");
const MODEL = process.env.E2E_AGENT_MODEL ?? "claude-opus-5-5";
const MAX_STEPS = Number(process.env.E2E_AGENT_MAX_STEPS ?? 60);

interface Finding { severity: string; title: string; detail: string; url: string }

const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "look",
    description:
      "Return the current URL, an accessibility snapshot of the page (roles and names you can pass to click/fill), " +
      "and any API errors or console errors since the last look. Call this after every action that changes the page.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "click",
    description:
      "Click an element by its accessible role and name as shown in the snapshot (e.g. role 'button', name 'Book " +
      "This Time'). Use nth (0-based) when several match. For a dropdown, click the combobox, look, then click the option.",
    input_schema: {
      type: "object",
      properties: {
        role: { type: "string", description: "ARIA role, e.g. button, link, option, combobox, tab, checkbox" },
        name: { type: "string", description: "Accessible name, matched as a case-insensitive substring" },
        nth: { type: "integer", minimum: 0 },
      },
      required: ["role", "name"],
      additionalProperties: false,
    },
  },
  {
    name: "fill",
    description:
      "Type into a text field, replacing its contents. Find the field by its placeholder, its label, or (for date, " +
      "time and datetime-local inputs) its input type. Dates use YYYY-MM-DD, times HH:MM, datetime-local YYYY-MM-DDTHH:MM.",
    input_schema: {
      type: "object",
      properties: {
        placeholder: { type: "string" },
        label: { type: "string" },
        input_type: { type: "string", enum: ["date", "time", "datetime-local", "number", "email"] },
        nth: { type: "integer", minimum: 0 },
        value: { type: "string" },
      },
      required: ["value"],
      additionalProperties: false,
    },
  },
  {
    name: "press",
    description: "Press a key in the focused element, e.g. Enter or Escape.",
    input_schema: { type: "object", properties: { key: { type: "string" } }, required: ["key"], additionalProperties: false },
  },
  {
    name: "goto",
    description: "Navigate to a path on the site, e.g. /chat. Prefer the sidebar links, as a person would.",
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "attach_file",
    description: `Choose a file for the nth file input on the page. Available files: ${fs.readdirSync(fixturesDir).join(", ")}.`,
    input_schema: {
      type: "object",
      properties: { file: { type: "string" }, nth: { type: "integer", minimum: 0 } },
      required: ["file"],
      additionalProperties: false,
    },
  },
  {
    name: "report_finding",
    description:
      "Record something the site owner should fix or improve: a bug, a privacy problem, a missing feature this person " +
      "needed, or a confusing step. Be specific about what you did, what happened, and what you expected.",
    input_schema: {
      type: "object",
      properties: {
        severity: { type: "string", enum: ["security", "bug", "gap", "ux"] },
        title: { type: "string" },
        detail: { type: "string" },
      },
      required: ["severity", "title", "detail"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description: "Call once the goal is done or you are blocked, with a short summary of what you achieved.",
    input_schema: { type: "object", properties: { summary: { type: "string" } }, required: ["summary"], additionalProperties: false },
  },
];

class Browser {
  private seenFailures = 0;
  private seenErrors = 0;
  constructor(private page: PersonaPage) {}

  private get p(): Page { return this.page; }

  async run(name: string, input: Record<string, unknown>): Promise<string> {
    const p = this.p;
    switch (name) {
      case "look": {
        await p.waitForTimeout(500);
        const snapshot = await p.locator("body").ariaSnapshot();
        const failures = this.page.apiFailures.slice(this.seenFailures);
        const errors = this.page.errors.slice(this.seenErrors);
        this.seenFailures = this.page.apiFailures.length;
        this.seenErrors = this.page.errors.length;
        return [
          `URL: ${p.url()}`,
          failures.length ? `API errors: ${failures.join("; ")}` : "",
          errors.length ? `Console errors: ${errors.slice(0, 5).join("; ")}` : "",
          snapshot.length > 15000 ? snapshot.slice(0, 15000) + "\n…(truncated)" : snapshot,
        ].filter(Boolean).join("\n");
      }
      case "click": {
        const loc = p.getByRole(input.role as Parameters<Page["getByRole"]>[0], { name: new RegExp(escape(String(input.name)), "i") });
        await loc.nth(Number(input.nth ?? 0)).click({ timeout: 5000 });
        return "clicked";
      }
      case "fill": {
        const nth = Number(input.nth ?? 0);
        const loc = input.placeholder
          ? p.getByPlaceholder(String(input.placeholder))
          : input.label
            ? p.getByLabel(String(input.label))
            : input.input_type
              ? p.locator(`input[type="${input.input_type}"]`)
              : null;
        if (!loc) return "Give placeholder, label or input_type.";
        await loc.nth(nth).fill(String(input.value), { timeout: 5000 });
        return "filled";
      }
      case "press":
        await p.keyboard.press(String(input.key));
        return "pressed";
      case "goto":
        await p.goto(String(input.path));
        return "navigated";
      case "attach_file": {
        const file = path.join(fixturesDir, path.basename(String(input.file)));
        await p.locator('input[type="file"]').nth(Number(input.nth ?? 0)).setInputFiles(file);
        return "file chosen";
      }
      default:
        return `Unknown tool ${name}`;
    }
  }
}

function escape(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

async function explore(key: string, mission: Mission) {
  const persona = personas[mission.persona];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  const page = await pageAs(browser, persona);
  page.on("dialog", (d) => d.accept()); // confirm() prompts
  await page.goto("/");
  const driver = new Browser(page);
  const client = new Anthropic();
  const findings: Finding[] = [];
  let summary = "(no summary: step limit reached)";

  const system =
    `You are testing a tutoring website called Clarity Mathematics by using it as a real person would. ` +
    `You are ${persona.firstName} ${persona.lastName} (${persona.role}). Today is ${new Date().toDateString()}. ` +
    "Work through your goal using the browser tools: look at the page, act, look again. Stay in character: use the " +
    "menus and buttons a person would see rather than guessing URLs, except when the goal asks you to probe. When " +
    "something is broken, confusing, slow, missing, or exposes data it shouldn't, call report_finding right away with " +
    "concrete details, then carry on if you can. Don't report things that work as expected. Call finish when done.";

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: `Your goal: ${mission.goal}` }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system,
      tools,
      messages,
    });
    if (response.stop_reason === "refusal") { summary = "Stopped: the model declined to continue."; break; }
    messages.push({ role: "assistant", content: response.content });
    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason === "end_turn" || calls.length === 0) {
      messages.push({ role: "user", content: "Keep going with the tools, or call finish if you're done." });
      continue;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let finished = false;
    for (const call of calls) {
      const input = call.input as Record<string, unknown>;
      let content: string;
      let isError = false;
      if (call.name === "report_finding") {
        findings.push({ severity: String(input.severity), title: String(input.title), detail: String(input.detail), url: page.url() });
        console.log(`  [${input.severity}] ${input.title}`);
        content = "recorded";
      } else if (call.name === "finish") {
        summary = String(input.summary);
        finished = true;
        content = "ok";
      } else {
        try {
          content = await driver.run(call.name, input);
        } catch (e) {
          content = `Failed: ${(e as Error).message.split("\n")[0]}`;
          isError = true;
        }
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content, is_error: isError });
    }
    messages.push({ role: "user", content: results });
    if (finished) break;
  }

  await browser.close();
  fs.mkdirSync(reportsDir, { recursive: true });
  const md = [
    `# Explorer: ${key}`,
    "",
    `**Persona:** ${persona.firstName} ${persona.lastName} (${persona.role})  `,
    `**Goal:** ${mission.goal}`,
    "",
    `**Outcome:** ${summary}`,
    "",
    ...findings.flatMap((f) => [`## [${f.severity}] ${f.title}`, "", f.detail, "", `_At ${f.url}_`, ""]),
  ].join("\n");
  fs.writeFileSync(path.join(reportsDir, `agent-${key}.md`), md);
  fs.writeFileSync(path.join(reportsDir, `agent-${key}.json`), JSON.stringify({ key, mission, summary, findings }, null, 2));
  console.log(`${key}: ${findings.length} finding(s). ${summary}`);
}

const arg = process.argv[2] ?? "all";
const selected = arg === "all" ? Object.keys(missions) : [arg];
for (const key of selected) {
  const mission = missions[key];
  if (!mission) throw new Error(`Unknown mission "${key}". Choose one of: ${Object.keys(missions).join(", ")}, all`);
  console.log(`Exploring as ${mission.persona}: ${key}`);
  await explore(key, mission);
}
