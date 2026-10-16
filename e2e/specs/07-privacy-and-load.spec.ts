import { test, expect } from "../lib/test";
import { personas } from "../lib/personas";
import { apiAs } from "../lib/session";
import { query } from "../lib/db";
import { expectRule } from "../lib/findings";

// Cross-family checks made straight against the API, the way someone poking
// at the site with their browser's dev tools would.
test.describe("one family can't see another's data", () => {
  test("an unrelated student sees only themselves and the tutor", async () => {
    const api = await apiAs(personas.otherStudent);
    const users = (await (await api.get("/api/users")).json()) as { id: string }[];
    expect(users.map((u) => u.id).sort()).toEqual([personas.otherStudent.id, personas.tutor.id].sort());

    const sessions = (await (await api.get("/api/sessions")).json()) as { studentId: string }[];
    expect(sessions.every((s) => s.studentId === personas.otherStudent.id)).toBe(true);

    const payments = (await (await api.get("/api/payments")).json()) as { studentId: string }[];
    expect(payments.every((p) => p.studentId === personas.otherStudent.id)).toBe(true);

    const assignments = (await (await api.get("/api/assignments")).json()) as unknown[];
    expect(assignments).toEqual([]);
  });

  test("another family's session, files and reports are refused", async () => {
    const api = await apiAs(personas.otherStudent);
    const [session] = await query<{ id: number }>("select id from tutoring_sessions where student_id = $1 limit 1", [personas.student.id]);
    expect((await api.get(`/api/sessions/${session.id}`)).status()).toBe(403);
    expect((await api.patch(`/api/sessions/${session.id}`, { data: { status: "cancelled" } })).status()).toBe(403);

    const [upload] = await query<{ id: number }>("select id from attachments where uploaded_by = $1 limit 1", [personas.student.id]);
    expect((await api.get(`/api/uploads/${upload.id}/download`)).status()).toBe(403);
    expect((await api.delete(`/api/uploads/${upload.id}`)).status()).toBe(403);

    expect((await api.get(`/api/parent-feedback/${personas.student.id}`)).status()).toBe(403);

    const [payment] = await query<{ id: number }>("select id from payments where student_id = $1 limit 1", [personas.student.id]);
    expect((await api.post(`/api/payments/${payment.id}/mark-sent`)).status()).toBe(403);
  });

  test("a parent can open their child's session details", async () => {
    const api = await apiAs(personas.parent);
    const [session] = await query<{ id: number }>("select id from tutoring_sessions where student_id = $1 limit 1", [personas.student.id]);
    const res = await api.get(`/api/sessions/${session.id}`);
    await expectRule(
      "bug",
      "Parents are refused their own child's session details",
      "GET/PATCH /api/sessions/:id only allow the tutor or the student, so a linked parent gets 403 for their " +
        "child's session even though the list endpoint shows it to them. That blocks a parent from cancelling or " +
        "rescheduling on the child's behalf.",
      () => res.ok(),
    );
  });

  test("students can't post or delete videos", async () => {
    const api = await apiAs(personas.student);
    const res = await api.post("/api/videos", { data: { title: "x", url: "https://example.com" } });
    expect(res.status()).toBe(403);
  });
});

test.describe("video library", () => {
  test("a video the tutor adds is open to every student, grouped by topic", async ({ open }) => {
    const tutor = await apiAs(personas.tutor);
    const title = `Adding fractions ${Date.now()}`;
    const created = await tutor.post("/api/videos", {
      data: { title, url: "https://youtu.be/dQw4w9WgXcQ", subject: "Fractions & decimals" },
    });
    expect(created.status()).toBe(201);
    const { id } = (await created.json()) as { id: number };

    // A student from another family sees it too: the library is shared.
    const page = await open(personas.otherStudent);
    await page.goto("/");
    await page.getByRole("link", { name: "Video Library" }).click();
    await expect(page.getByRole("heading", { name: "Video Library" })).toBeVisible();
    const section = page.getByRole("region", { name: "Fractions & decimals" });
    await expect(section.getByText(title)).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Video" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Edit ${title}` })).toHaveCount(0);

    await page.getByLabel("Search videos").fill("no such video");
    await expect(page.getByText("No videos match your search.")).toBeVisible();

    // The tutor can retitle it and remove it; another student can't.
    const student = await apiAs(personas.otherStudent);
    expect((await student.delete(`/api/videos/${id}`)).status()).toBe(403);
    expect((await tutor.patch(`/api/videos/${id}`, { data: { subject: "Fractions" } })).status()).toBe(200);
    expect((await tutor.delete(`/api/videos/${id}`)).status()).toBe(200);
  });
});

test.describe("load from background polling", () => {
  test("an open chat tab stays inside the rate limit", async ({ open }) => {
    const page = await open(personas.student);
    let calls = 0;
    page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) calls += 1; });
    await page.goto("/chat");
    await page.getByRole("button", { name: /Tess Tutor/ }).first().click();
    calls = 0;
    await page.waitForTimeout(30_000);
    const perMinute = calls * 2;
    await expectRule(
      "bug",
      "Background polling can push a household over the rate limit",
      `One idle chat tab makes about ${perMinute} API requests a minute (chat list every 5s, open conversation every ` +
        "4s, payment banner every 15s, session reminder every 60s). The API allows 120 requests a minute per IP, so " +
        "a family with a few devices on the same home network, or a school network, starts getting 429 errors and " +
        "blank pages. Poll less often, pause " +
        "polling in background tabs (refetchIntervalInBackground is off by default, but visible tabs still poll), " +
        "or push updates, and raise the limit for reads.",
      () => perMinute * 4 <= 120,
    );
  });
});
