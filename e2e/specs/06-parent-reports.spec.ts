import { test, expect } from "../lib/test";
import { personas } from "../lib/personas";
import { apiAs, expectToast, navigate } from "../lib/session";
import { finding, expectRule } from "../lib/findings";

test.describe("parent reports: tutor writes, parent reads", () => {
  test("tutor writes a report for the student", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await navigate(page, "Parent Reports");
    const list = page.locator("main").getByRole("button");
    const names = await list.allInnerTexts();
    await expectRule(
      "ux",
      "The Parent Reports student list includes parents",
      `The 'Students' list shows everyone the tutor is connected to: ${names.map((n) => n.trim()).filter(Boolean).join(", ")}. ` +
        "Parents appear as if they were students and can be given a report.",
      () => !names.some((n) => /Pat Parent/.test(n)),
    );
    await page.locator("main").getByRole("button", { name: /Sam Student/ }).click();
    const editor = page.getByPlaceholder(/Write your feedback for the parent here/);
    const placeholder = await editor.getAttribute("placeholder");
    await expectRule(
      "ux",
      "The report editor says only the tutor can see it",
      "The placeholder reads 'This is private, only you can see it', but saved reports are shown to the student's " +
        "linked parents on their Feedback page.",
      () => !placeholder?.includes("only you can see it"),
    );
    await page.getByPlaceholder(/Fall 2025/).fill("October, week 2");
    await editor.fill("Sam is confident with factoring now. Next: completing the square.");
    await page.getByRole("button", { name: "Save Report" }).click();
    await expectToast(page, "Report saved");
    finding(
      "gap",
      "Only one parent report per student is kept",
      "Saving a report overwrites the previous one (PUT /api/parent-feedback/:studentId upserts a single row), so " +
        "there's no history of past periods for the parent to look back on. Keep each report as its own entry.",
    );
  });

  test("parent reads the report on their Feedback page", async ({ open }) => {
    const page = await open(personas.parent);
    await page.goto("/");
    await page.getByRole("link", { name: /Feedback/ }).first().click();
    await expect(page.getByText("Sam is confident with factoring now.")).toBeVisible();
    await expect(page.getByText("October, week 2")).toBeVisible();
  });

  test("students can't read the parent report", async ({ open }) => {
    const api = await apiAs(personas.student);
    const res = await api.get(`/api/parent-feedback/${personas.student.id}`);
    expect(res.status()).toBe(403);
    const page = await open(personas.student);
    await page.goto("/parent-feedback");
    await expectRule(
      "ux",
      "Students can open the parent-only Feedback page",
      "/parent-feedback isn't in the student's menu, but visiting it shows the parent 'Link a child' screen instead " +
        "of a not-allowed message. Gate the route by role the way Parent Reports is.",
      async () => !(await page.getByRole("button", { name: "Link a child" }).isVisible()),
    );
  });

  test("a parent can link a second child from the Feedback page", async ({ open }) => {
    const page = await open(personas.parent);
    await page.goto("/parent-feedback");
    await page.getByRole("button", { name: /Link a child/ }).click();
    await page.getByRole("dialog").getByPlaceholder("child@example.com").fill("nobody@e2e.test");
    await page.getByRole("dialog").getByRole("button", { name: /Link/ }).click();
    await expect(page.getByText(/No student found with that email/).first()).toBeVisible();
  });
});
