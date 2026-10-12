import fs from "node:fs";
import path from "node:path";
import type { Reporter, TestCase, TestResult, FullResult } from "@playwright/test/reporter";

interface Entry { severity: string; title: string; detail: string; test: string; file: string }

const ORDER = ["security", "bug", "gap", "ux"];
const HEADINGS: Record<string, string> = {
  security: "Security and privacy",
  bug: "Bugs",
  gap: "Missing functionality",
  ux: "Usability",
};

/** Writes every `finding()` recorded during the run to a Markdown file. */
export default class FindingsReporter implements Reporter {
  private entries: Entry[] = [];
  private failures: string[] = [];
  private outputFile: string;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile ?? "reports/findings.md";
  }

  onTestEnd(test: TestCase, result: TestResult) {
    for (const a of result.annotations) {
      if (!a.type.startsWith("finding:") || !a.description) continue;
      const [title, ...rest] = a.description.split("\n");
      this.entries.push({
        severity: a.type.slice("finding:".length),
        title,
        detail: rest.join("\n"),
        test: test.titlePath().slice(2).join(" › "),
        file: path.basename(test.location.file),
      });
    }
    if (result.status !== "passed" && result.status !== "skipped" && result.status !== test.expectedStatus) {
      this.failures.push(`${test.titlePath().slice(2).join(" › ")}: ${result.error?.message?.split("\n")[0] ?? result.status}`);
    }
  }

  onEnd(result: FullResult) {
    const seen = new Set<string>();
    const unique = this.entries.filter((e) => (seen.has(e.title) ? false : (seen.add(e.title), true)));
    const lines = [
      "# Clarity e2e findings",
      "",
      `Run finished ${new Date().toISOString()} with status **${result.status}**.`,
      `${unique.length} finding(s), ${this.failures.length} failing test(s).`,
      "",
    ];
    if (this.failures.length) {
      lines.push("## Failing tests", "", ...this.failures.map((f) => `- ${f}`), "");
    }
    for (const sev of ORDER) {
      const group = unique.filter((e) => e.severity === sev);
      if (!group.length) continue;
      lines.push(`## ${HEADINGS[sev]}`, "");
      for (const e of group) {
        lines.push(`### ${e.title}`, "", e.detail, "", `_Seen in ${e.file}: ${e.test}_`, "");
      }
    }
    fs.mkdirSync(path.dirname(this.outputFile), { recursive: true });
    fs.writeFileSync(this.outputFile, lines.join("\n"));
    fs.writeFileSync(this.outputFile.replace(/\.md$/, ".json"), JSON.stringify({ findings: unique, failures: this.failures }, null, 2));
  }
}
