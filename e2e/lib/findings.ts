import { test } from "@playwright/test";

export type Severity = "bug" | "security" | "ux" | "gap";

/**
 * Records something a human should look at, without failing the test. The
 * findings reporter collects these into reports/findings.md, grouped by
 * severity, so a run doubles as an audit of the site.
 */
export function finding(severity: Severity, title: string, detail: string): void {
  test.info().annotations.push({ type: `finding:${severity}`, description: `${title}\n${detail}` });
}

/**
 * Checks a rule the app should follow but currently does not. While the bug
 * is present the check records a finding and the test passes; once the bug is
 * fixed it records nothing, and the matching `knownBug` note in the spec can
 * be removed.
 */
export async function expectRule(
  severity: Severity,
  title: string,
  detail: string,
  holds: () => Promise<boolean> | boolean,
): Promise<boolean> {
  const ok = await holds();
  if (!ok) finding(severity, title, detail);
  return ok;
}
