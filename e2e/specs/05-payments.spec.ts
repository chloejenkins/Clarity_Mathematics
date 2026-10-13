import { test, expect } from "../lib/test";
import { personas } from "../lib/personas";
import { apiAs, expectToast, navigate } from "../lib/session";
import { query } from "../lib/db";
import { finding, expectRule } from "../lib/findings";
import { daysFromNow } from "../lib/time";

test.describe("payments: charges, marking paid, confirming", () => {
  test("tutor changes their hourly rate", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await navigate(page, "Payments");
    await expect(page.getByText("$40/hr", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Edit rate" }).click();
    await page.locator('input[type="number"]').fill("50");
    await page.getByRole("button", { name: "Save" }).click();
    await expectToast(page, "Hourly rate updated");
    await expect(page.getByText("$50/hr", { exact: true })).toBeVisible();
  });

  test("student is charged for a past session at the new rate; the first one is free", async ({ open }) => {
    // A 90-minute session that happened yesterday (the earlier, completed
    // 'Fractions review' session is the student's first, so it's free). The
    // student also owes $20 from the late cancellation in the schedule spec
    // (half of an hour at the $40 rate in force then).
    await query(
      "insert into tutoring_sessions (tutor_id, student_id, scheduled_at, duration_minutes, topic, status) values ($1, $2, $3, 90, 'Exam prep', 'completed')",
      [personas.tutor.id, personas.student.id, daysFromNow(-1, 16, 0).toISOString()],
    );
    const page = await open(personas.student);
    await page.goto("/");
    const banner = page.getByRole("link", { name: /unpaid session/ });
    await expect(banner).toContainText("$95 due");
    await expectRule(
      "ux",
      "Students are told they owe money but have no Payments page in their menu",
      "The student menu has no Payments entry, yet students are billed for their own sessions and see a " +
        "'You have 1 unpaid session, $75 due' banner. Students who pay for themselves (older students, adult " +
        "learners) can only reach Payments through that banner. Either add Payments to the student menu or bill " +
        "the linked parent and hide the banner from students who have one.",
      async () => (await page.getByRole("link", { name: "Payments", exact: true }).count()) > 0,
    );
    await banner.click();
    await expect(page.getByText("First session, free")).toBeVisible();
    const row = page.getByText("Exam prep").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
    await expect(row.getByText("$75")).toBeVisible();
    await expect(page.getByText("$95 due")).toBeVisible();

    await row.getByRole("button", { name: "Mark as paid" }).click();
    await expectToast(page, "Marked as paid");
  });

  test("tutor confirms the payment and a receipt is available", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/payments");
    await expect(page.getByText("$75 awaiting confirmation")).toBeVisible();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expectToast(page, "Payment confirmed");

    const student = await open(personas.student);
    await student.goto("/payments");
    const popup = student.waitForEvent("popup");
    await student.getByText("Exam prep").locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]").getByTitle("Receipt").click();
    const receipt = await popup;
    await expect(receipt.getByText("Payment Receipt")).toBeVisible();
    await expect(receipt.getByText("$75.00")).toBeVisible();
  });

  test("parent sees and can pay their child's charges", async ({ open }) => {
    const page = await open(personas.parent);
    await page.goto("/payments");
    await expect(page.getByText("Exam prep")).toBeVisible();
    await expectRule(
      "ux",
      "Parents can't tell which child a charge is for",
      "The parent's charge list shows the description and date but not the child's name (the student name is only " +
        "shown to the tutor), which gets confusing with more than one child.",
      async () => await page.getByText(/Sam Student/).first().isVisible(),
    );
  });

  test("charges move only forward through their states", async () => {
    const [{ id }] = await query<{ id: number }>(
      "select id from payments where student_id = $1 and status = 'received' order by id desc limit 1",
      [personas.student.id],
    );
    const student = await apiAs(personas.student);
    await student.post(`/api/payments/${id}/mark-sent`);
    const [after] = await query<{ status: string }>("select status from payments where id = $1", [id]);
    await expectRule(
      "bug",
      "A confirmed payment can be flipped back to 'awaiting confirmation'",
      "POST /api/payments/:id/mark-sent works on any charge the family can see, including ones already received, " +
        "void or refunded, which resets them to 'sent' and asks the tutor to confirm again. Only allow it from 'due'.",
      () => after.status === "received",
    );
  });

  test("billing details are hard-coded", async () => {
    finding(
      "gap",
      "Payment details and policy text live in the page code",
      "The Zelle email and phone, the Venmo handle and the pricing/refund policy are written into payments.tsx, so " +
        "changing them means a code change and deploy. They also show to the tutor's own view. Suggest a tutor " +
        "settings page (payment methods, rate, cancellation window and fee) that the policy text and the billing " +
        "code both read from.",
    );
    finding(
      "gap",
      "Charges only appear when someone opens the Payments page",
      "Charges for past sessions are created as a side effect of GET /api/payments, and the tutor's call bills every " +
        "session in the database, using the first tutor's rate. Nothing creates a charge at the moment a session is " +
        "completed, so totals depend on who last opened the page. Suggest creating the charge when the tutor marks a " +
        "session completed, with an optional per-session price override and monthly statements for parents.",
    );
  });
});
