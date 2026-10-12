import { test, expect } from "../lib/test";
import path from "node:path";
import { personas } from "../lib/personas";
import { apiAs, expectToast, navigate } from "../lib/session";
import { query } from "../lib/db";
import { finding, expectRule } from "../lib/findings";
import { daysFromNow, dateInput } from "../lib/time";

const fixture = (name: string) => path.join(import.meta.dirname, "..", "fixtures", name);
const dueDate = daysFromNow(7, 12, 0);

test.describe("assignments: post, submit, review", () => {
  test("tutor posts an assignment for the student", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await navigate(page, "Assignments");
    await page.getByRole("button", { name: "New Assignment" }).click();
    const dialog = page.getByRole("dialog", { name: "Post New Assignment" });
    await dialog.getByRole("combobox").click();
    const options = page.getByRole("option");
    const optionNames = await options.allInnerTexts();
    await page.getByRole("option", { name: /Sam Student/ }).click();
    await dialog.getByPlaceholder("e.g. Chapter 4 Practice Problems").fill("Quadratics practice set");
    await dialog.getByPlaceholder("e.g. Algebra").fill("Algebra");
    await dialog.locator('input[type="date"]').fill(dateInput(dueDate));
    await dialog.getByPlaceholder(/Describe what students should do/).fill("Solve problems 1-10 and show your working.");
    await dialog.getByRole("button", { name: /Post Assignment/ }).click();
    await expectToast(page, "Assignment posted!");
    const card = page.locator("main").getByText("Quadratics practice set").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]");
    await expect(card.getByText("For Sam Student")).toBeVisible();

    if (optionNames.some((n) => /Pat Parent/.test(n))) {
      finding(
        "ux",
        "Assignment recipients mix students and parents with no label",
        `The 'Assign to' list offered: ${optionNames.join(", ")}. Parents appear alongside students without a role ` +
          "label, which makes it easy to assign homework to a parent by mistake.",
      );
    }
    finding(
      "gap",
      "Tutors can't attach a worksheet to an assignment",
      "The New Assignment form has no file upload, and files the tutor uploads are not listed for the student " +
        "(GET /api/uploads only returns a student's own uploads). Worksheets have to go through chat or email. " +
        "Suggest attachments on the assignment that its recipient (and their parent) can download.",
    );
    finding(
      "gap",
      "Assignments can't be edited after posting",
      "There is no edit action on an assignment card, although the API supports PATCH /api/assignments/:id. A typo " +
        "or a moved due date means deleting and re-posting, which also loses any submission.",
    );
  });

  test("student sees the assignment with the right due date", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    await navigate(page, "Assignments");
    await expect(page.getByText("Quadratics practice set")).toBeVisible();
    const expected = dueDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const shown = await page.getByText(/^Due:/).first().innerText();
    await expectRule(
      "bug",
      "Due dates show one day early in US time zones",
      `The tutor picked ${dateInput(dueDate)} but the student sees "${shown.trim()}" (expected ${expected}). The date ` +
        "input's value is sent as midnight UTC and then shown in local time, which is the previous evening anywhere " +
        "west of London. Store due dates as plain dates, or send local end-of-day.",
      () => shown.includes(expected),
    );
  });

  test("student submits written work and a file", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    await navigate(page, "Assignments");
    await page.getByRole("button", { name: /Submit your work/ }).click();
    await page.getByPlaceholder(/Add a note for your tutor/).fill("Done! I got stuck on #7.");
    await page.locator('input[type="file"]').last().setInputFiles(fixture("homework.txt"));
    await expectToast(page, "File uploaded");
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await expectToast(page, "Work submitted!");
    await expect(page.getByText(/^Submitted ·/)).toBeVisible();
  });

  test("student sends a file to the tutor outside any assignment", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    await navigate(page, "Assignments");
    await page.locator('input[type="file"]').first().setInputFiles(fixture("worksheet.txt"));
    await expectToast(page, "File uploaded");
  });

  test("tutor sees the submission and file, downloads it, and leaves a review", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await navigate(page, "Assignments");
    await expect(page.getByText("Done! I got stuck on #7.")).toBeVisible();
    await expect(page.getByText("homework.txt")).toBeVisible();
    await expect(page.getByText("worksheet.txt")).toBeVisible(); // under "Files sent to you"

    const download = page.waitForEvent("download");
    await page.getByText("homework.txt").locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]").getByTitle("Download").click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("homework.txt");

    await page.getByPlaceholder(/Leave feedback for the student/).fill("Great work. For #7, factor before you divide.");
    await page.getByRole("button", { name: /Save review|Mark reviewed|Save/ }).first().click();
    await expectToast(page, "Review saved");
  });

  test("student reads the tutor's review", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    await navigate(page, "Assignments");
    await expect(page.getByText("Reviewed by your tutor")).toBeVisible();
    await expect(page.getByText("Great work. For #7, factor before you divide.")).toBeVisible();
    await navigate(page, "Progress");
    await expect(page.getByText("1/1")).toBeVisible();
  });

  test("parent sees their child's assignment and its status", async ({ open }) => {
    const page = await open(personas.parent);
    await page.goto("/");
    await navigate(page, "Assignments");
    await expect(page.getByText("Quadratics practice set")).toBeVisible();
    await expect(page.getByText("For Sam Student")).toBeVisible();
    const parentSeesChildSubmission = await page.getByText(/^Submitted ·/).isVisible();
    await expectRule(
      "bug",
      "Parents see a blank 'Submit your work' box on their child's assignments",
      "On a linked child's assignment the parent gets the student's submission panel, which loads the parent's own " +
        "(empty) submission instead of the child's. The child's work and the tutor's review are invisible to the " +
        "parent, and anything the parent submits is saved under the parent and not counted as the child's.",
      () => parentSeesChildSubmission,
    );
  });

  test("an unrelated student cannot see or submit to the assignment", async ({ open }) => {
    const page = await open(personas.otherStudent);
    await page.goto("/");
    await navigate(page, "Assignments");
    await expect(page.getByText("Quadratics practice set")).toHaveCount(0);

    const [{ id }] = await query<{ id: number }>("select id from assignments where title = 'Quadratics practice set'");
    const api = await apiAs(personas.otherStudent);
    const res = await api.post(`/api/assignments/${id}/submit`, { data: { content: "not my homework" } });
    await expectRule(
      "security",
      "Anyone can submit work to any assignment by id",
      "POST /api/assignments/:id/submit doesn't check that the assignment is addressed to the caller, so a student " +
        "can attach submissions to other families' assignments, and the tutor sees them in the review list. " +
        "Uploads accept any assignmentId the same way.",
      () => res.status() === 403 || res.status() === 404,
    );
  });

  test("deleting an assignment cleans up its submissions and files", async () => {
    const tutor = await apiAs(personas.tutor);
    const created = await (await tutor.post("/api/assignments", { data: { assignedTo: personas.student.id, title: "Throwaway" } })).json();
    const student = await apiAs(personas.student);
    await student.post(`/api/assignments/${created.id}/submit`, { data: { content: "x" } });
    await tutor.delete(`/api/assignments/${created.id}`);
    const [orphans] = await query<{ n: string }>("select count(*) as n from submissions where assignment_id = $1", [created.id]);
    await expectRule(
      "bug",
      "Deleting an assignment leaves its submissions and files behind",
      "Submissions and uploaded files keep pointing at the deleted assignment id, invisible in the app but still " +
        "stored. Delete (or archive) them with the assignment, and confirm in the UI what will be lost.",
      () => Number(orphans.n) === 0,
    );
  });
});
