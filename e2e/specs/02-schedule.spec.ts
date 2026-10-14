import { test, expect } from "../lib/test";
import { personas } from "../lib/personas";
import { apiAs, expectToast } from "../lib/session";
import { query } from "../lib/db";
import { finding, expectRule } from "../lib/findings";
import { daysFromNow, hoursFromNow, dateInput, timeInput, clock } from "../lib/time";

const firstDay = daysFromNow(3, 15, 0);
const secondTime = daysFromNow(3, 16, 30);

test.describe("scheduling: tutor posts times, families book them", () => {
  test("tutor adds two weekly-repeating times", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await page.getByRole("button", { name: "Add Available Times" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Availability" });
    await dialog.locator('input[type="date"]').fill(dateInput(firstDay));
    await dialog.locator('input[type="time"]').first().fill(timeInput(firstDay));
    await dialog.getByRole("button", { name: "Add another time" }).click();
    await dialog.locator('input[type="time"]').nth(1).fill(timeInput(secondTime));
    await dialog.getByPlaceholder("e.g. Algebra").fill("Algebra");
    await dialog.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Weekly · 2 weeks" }).click();
    await dialog.getByRole("button", { name: "Save Availability" }).click();
    await expectToast(page, "4 slots added!");
    await expect(page.getByRole("heading", { name: "Open Slots (4)" })).toBeVisible();

    await expectRule(
      "ux",
      "Deleting an open slot needs a mouse hover",
      "The delete button on each open slot is invisible until hovered (opacity-0 group-hover:opacity-100), so on a " +
        "phone or tablet the tutor can't see it. The same pattern hides the delete button on assignments.",
      async () => (await page.getByRole("heading", { name: "Open Slots (4)" }).locator("xpath=../..").locator("button.opacity-0").count()) === 0,
    );
  });

  test("student books a time and sees it confirmed", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    const cards = page.locator("main").getByRole("button", { name: "Book This Time" });
    await expect(cards).toHaveCount(4);
    await cards.first().click();
    const dialog = page.getByRole("dialog", { name: "Confirm Your Booking" });
    await dialog.getByPlaceholder(/Homework problem/).fill("Quadratics homework");
    await dialog.getByRole("button", { name: "Confirm Booking" }).click();
    await expectToast(page, "Session booked! It's confirmed.");
    await expect(page.getByRole("button", { name: "Book This Time" })).toHaveCount(3);
    const mySessions = page.getByRole("heading", { name: "My Sessions" }).locator("xpath=..");
    await expect(mySessions.getByText("Quadratics homework")).toBeVisible();
    await expect(mySessions.getByText("Approved")).toBeVisible();
  });

  test("another family no longer sees the booked time", async ({ open }) => {
    const page = await open(personas.otherStudent);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Book This Time" })).toHaveCount(3);
  });

  test("tutor sees the booking with the student's name", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Open Slots (3)" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Booked Sessions (1)" })).toBeVisible();
    await expect(page.getByText("Sam Student", { exact: true })).toBeVisible();
    await expect(page.getByText("Quadratics homework")).toBeVisible();

    const labels = await page.getByRole("heading", { name: /Open Slots/ }).locator("xpath=../..").locator("p.font-semibold").allInnerTexts();
    const doubled = labels.find((l) => /(\w{3} \d{1,2}), \1$/.test(l));
    await expectRule(
      "bug",
      "Open slots more than a week out show the date twice",
      `The tutor's open-slot cards read "${doubled}". formatDay() already returns "EEE, MMM d" for dates beyond this ` +
        'week and the card appends ", MMM d" again (artifacts/tutor-hub/src/pages/sessions.tsx:501 and :559).',
      () => !doubled,
    );
  });

  test("student reschedules the session", async ({ open }) => {
    // Off-slot times are refused for families; the tutor can still pick any time.
    const [{ id: sessionId }] = await query<{ id: number }>(
      "select id from tutoring_sessions where student_id = $1 order by id desc limit 1",
      [personas.student.id],
    );
    const offSlot = await (await apiAs(personas.student)).patch(`/api/sessions/${sessionId}`, {
      data: { scheduledAt: daysFromNow(4, 10, 0).toISOString() },
    });
    await expectRule(
      "gap",
      "Rescheduling ignores the tutor's availability",
      "Either side can move a booked session to any date and time, including outside the tutor's open slots or on top " +
        "of another booking, and the tutor is not asked to accept it. Suggest rescheduling by picking another open slot " +
        "(which frees the old one), or sending a request the other side confirms.",
      () => offSlot.status() === 400,
    );

    const page = await open(personas.student);
    await page.goto("/");
    await page.getByRole("button", { name: "Reschedule" }).click();
    const dialog = page.getByRole("dialog", { name: "Reschedule session" });
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: new RegExp(clock(secondTime)) }).first().click();
    await dialog.getByRole("button", { name: "Confirm new time" }).click();
    await expectToast(page, "Session rescheduled");
    await expect(page.getByRole("heading", { name: "My Sessions" }).locator("xpath=..").getByText(clock(secondTime))).toBeVisible();
    await expectRule(
      "bug",
      "Rescheduling leaves the original slot marked as booked",
      "After a reschedule the availability slot at the old time stays booked, so nobody can take that time any more.",
      async () => {
        const [slot] = await query<{ is_booked: string }>(
          "select is_booked from availability_slots where starts_at = $1",
          [firstDay.toISOString()],
        );
        return slot?.is_booked === "false";
      },
    );
  });

  test("student cancels more than 24 hours ahead at no charge", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel Session" }).click();
    await expectToast(page, "Session cancelled");
    await expect(page.getByText("Cancelled more than 24h ahead, no charge.").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Past Sessions" })).toBeVisible();

    await expectRule(
      "bug",
      "Cancelled sessions don't free up their time slot",
      "Cancelling a booked session (by the student or the tutor) leaves its availability slot booked, so the time " +
        "can't be offered to anyone else. The tutor has to post the time again by hand.",
      async () => {
        const rows = await query<{ is_booked: string }>("select is_booked from availability_slots where booked_by_student_id = $1", [personas.student.id]);
        return rows.every((r) => r.is_booked === "false");
      },
    );
  });

  test("a late cancellation applies the 50% fee", async ({ open }) => {
    // A slot five hours out, posted through the API (the dialog only takes whole dates).
    const tutor = await apiAs(personas.tutor);
    const soon = hoursFromNow(5);
    const created = await tutor.post("/api/availability", { data: [{ startsAt: soon.toISOString(), durationMinutes: 60 }] });
    expect(created.status()).toBe(201);

    const page = await open(personas.student);
    await page.goto("/");
    await page.getByText(clock(soon)).first().locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]").getByRole("button", { name: "Book This Time" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm Booking" }).click();
    await expectToast(page, "Session booked! It's confirmed.");
    page.on("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancel Session" }).click();
    await expectToast(page, "Session cancelled");
    const description = await page.getByRole("region", { name: /Notifications/ }).innerText();

    if (!/\$\d+/.test(description)) {
      finding(
        "bug",
        "A late cancellation can be free because a cancelled booking counts as the 'first session'",
        "The 'first session free' rule picks the student's earliest scheduled session, including cancelled ones. Here the " +
          "student's earliest session was this late-cancelled one, so the 50% fee came out as $0 and the toast said " +
          `"${description.replace(/\s+/g, " ").trim()}". Count only completed sessions when deciding which one is free ` +
          "(artifacts/api-server/src/lib/billing.ts:33 and routes/payments.ts:52).",
      );
    }
  });

  test("tutor confirms a past session happened and writes lesson notes the student can read", async ({ open }) => {
    // Two sessions that already happened: booked earlier, never marked.
    const past = daysFromNow(-2, 17, 0);
    await query(
      "insert into tutoring_sessions (tutor_id, student_id, scheduled_at, duration_minutes, topic, status) values ($1, $2, $3, 60, 'Fractions review', 'approved'), ($1, $2, $4, 60, 'Missed session', 'approved')",
      // The missed one comes after the first, so the first stays the student's free session.
      [personas.tutor.id, personas.student.id, past.toISOString(), daysFromNow(-1, 10, 0).toISOString()],
    );

    const tutor = await open(personas.tutor);
    await tutor.goto("/assignments");
    await expect(tutor.getByText("2 past sessions need checking: did they happen?")).toBeVisible();
    await tutor.getByText("2 past sessions need checking").click();

    // Past-due sessions leave Booked Sessions for the "Did these happen?" list.
    const toCheck = tutor.getByRole("heading", { name: /Did these happen\?/ }).locator("xpath=..");
    const booked = tutor.getByRole("heading", { name: /Booked Sessions/ }).locator("xpath=..");
    await expect(booked.getByText("Fractions review")).toHaveCount(0);

    await toCheck.getByText("Missed session").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")
      .getByRole("button", { name: "It didn't happen" }).click();
    await expectToast(tutor, "Session cancelled");

    await toCheck.getByText("Fractions review").locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")
      .getByRole("button", { name: "It happened" }).click();
    await expectToast(tutor, "Session marked as completed");
    await tutor.getByRole("button", { name: "Add lesson notes" }).first().click();
    await tutor.getByPlaceholder(/What we covered/).fill("Worked through equivalent fractions. Homework: p. 42 #1-10.");
    await tutor.getByRole("button", { name: "Save notes" }).click();
    await expectToast(tutor, "Lesson notes saved");

    const student = await open(personas.student);
    await student.goto("/");
    await expect(student.getByText("Worked through equivalent fractions.")).toBeVisible();
    await student.getByRole("link", { name: "Progress", exact: true }).click();
    await expect(student.getByText("Worked through equivalent fractions.")).toBeVisible();
  });

  test("parent books a time for their child", async ({ open }) => {
    const page = await open(personas.parent);
    await page.goto("/");
    await page.getByRole("button", { name: "Book This Time" }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm Booking" }).click();
    await expectToast(page, "Session booked! It's confirmed.");
    const [session] = await query<{ student_id: string }>(
      "select student_id from tutoring_sessions order by id desc limit 1",
    );
    await expectRule(
      "bug",
      "A parent's booking is filed under the parent, not the child",
      "When a parent books a slot the session's student is the parent account. The linked child doesn't see it on " +
        "their schedule, and charges and lesson notes go to the parent. Ask 'Who is this for?' when a parent with " +
        "linked children books.",
      () => session.student_id === personas.student.id,
    );
  });
});

test.describe("scheduling rules enforced by the server", () => {
  test("students cannot approve or complete their own sessions", async () => {
    const student = await apiAs(personas.student);
    const created = await student.post("/api/sessions", {
      data: { scheduledAt: daysFromNow(10).toISOString(), durationMinutes: 60, topic: "Request" },
    });
    if (created.status() === 400) {
      finding(
        "bug",
        "Requesting a session through POST /api/sessions always fails",
        "The generated CreateSessionBody schema expects scheduledAt to be a Date object, but JSON can only carry a " +
          "string, so every request is rejected with 400. The page doesn't use this endpoint today (booking goes " +
          "through availability slots), so either make the OpenAPI field a date-time string that the server converts, " +
          "or remove the endpoint. The same zod.date() pattern appears in other generated request schemas.",
      );
    }
    // Make a pending request directly so the status rule can still be checked.
    const [{ id }] = await query<{ id: number }>(
      "insert into tutoring_sessions (tutor_id, student_id, scheduled_at, duration_minutes, topic, status) values ($1, $2, $3, 60, 'Request', 'pending') returning id",
      [personas.tutor.id, personas.student.id, daysFromNow(10).toISOString()],
    );
    const res = await student.patch(`/api/sessions/${id}`, { data: { status: "completed" } });
    await expectRule(
      "security",
      "Students can mark their own sessions approved or completed",
      "PATCH /api/sessions/:id lets the student on a session set any status, so a pending request can be self-approved " +
        "and an upcoming session marked completed. Only the tutor should approve or complete; students should only " +
        "be able to cancel (artifacts/api-server/src/routes/sessions.ts:121).",
      () => res.status() === 403,
    );
  });

  test("deleting a session skips the cancellation policy", async () => {
    const tutor = await apiAs(personas.tutor);
    const slot = await (await tutor.post("/api/availability", { data: [{ startsAt: hoursFromNow(3).toISOString(), durationMinutes: 60 }] })).json();
    const other = await apiAs(personas.otherStudent);
    const booked = await (await other.post(`/api/availability/${slot[0].id}/book`, { data: {} })).json();
    const del = await other.delete(`/api/sessions/${booked.session.id}`);
    await expectRule(
      "bug",
      "Deleting a session bypasses the late-cancellation fee and strands the slot",
      "DELETE /api/sessions/:id is open to the student and removes the session outright: no 50% fee for a late " +
        "cancellation, no record for the tutor, and the availability slot stays 'booked' pointing at a session that no " +
        "longer exists. Students should only be able to cancel; deletion (if kept at all) should be tutor-only.",
      () => del.status() === 403,
    );
    // The tutor can still delete it, and the time goes back on the open list.
    expect((await tutor.delete(`/api/sessions/${booked.session.id}`)).ok()).toBe(true);
    const [freed] = await query<{ is_booked: string }>("select is_booked from availability_slots where id = $1", [slot[0].id]);
    expect(freed.is_booked).toBe("false");
  });
});
