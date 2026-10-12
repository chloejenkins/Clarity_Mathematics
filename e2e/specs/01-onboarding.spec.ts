import { test, expect } from "../lib/test";
import { personas } from "../lib/personas";
import { apiAs } from "../lib/session";
import { query } from "../lib/db";
import { finding } from "../lib/findings";

// Every later spec relies on these accounts, created the way real people
// create them: by signing in for the first time and picking a role.
test.describe("first sign-in and onboarding", () => {
  test("tutor with an allowlisted email becomes the tutor", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: /^Tutor/ }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Available Times" })).toBeVisible();
    const [row] = await query("select role from users where id = $1", [personas.tutor.id]);
    expect(row.role).toBe("tutor");
  });

  test("someone without an allowlisted email cannot become a tutor", async ({ open }) => {
    const page = await open(personas.impostor);
    await page.goto("/");
    await page.getByRole("button", { name: /^Tutor/ }).click();
    await expect(page.getByText(/Tutor accounts require/)).toBeVisible();

    // The browser check is cosmetic; the server must refuse too.
    const api = await apiAs(personas.impostor);
    const res = await api.post("/api/auth/set-role", { data: { role: "tutor" } });
    expect(res.status()).toBe(403);
  });

  test("student signs up and lands on the booking page", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    await page.getByRole("button", { name: /^Student/ }).click();
    await page.getByRole("button", { name: /Enter Portal/ }).click();
    await expect(page.getByRole("heading", { name: "Available Times" })).toBeVisible();
    const [row] = await query("select role, tutor_id from users where id = $1", [personas.student.id]);
    expect(row).toMatchObject({ role: "student", tutor_id: personas.tutor.id });
  });

  test("a second, unrelated student signs up", async ({ open }) => {
    const page = await open(personas.otherStudent);
    await page.goto("/");
    await page.getByRole("button", { name: /^Student/ }).click();
    await page.getByRole("button", { name: /Enter Portal/ }).click();
    await expect(page.getByRole("heading", { name: "Available Times" })).toBeVisible();
  });

  test("parent signs up and links their child by email", async ({ open }) => {
    const page = await open(personas.parent);
    await page.goto("/");
    await page.getByRole("button", { name: /^Parent/ }).click();
    await page.getByPlaceholder("child@example.com").fill(personas.student.email);
    await page.getByRole("button", { name: /Link & Continue/ }).click();
    await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
    const links = await query("select student_id from parent_student_links where parent_id = $1", [personas.parent.id]);
    expect(links.map((l) => l.student_id)).toEqual([personas.student.id]);

    finding(
      "security",
      "Any parent can link to any student just by knowing their email",
      "POST /api/parent-links only checks that the email belongs to a student account. Nobody (the student, the tutor) " +
        "confirms the relationship, and once linked the parent sees that student's schedule, assignments, payments " +
        "and tutor feedback. Suggest a confirmation step: the tutor approves links, or the student accepts an invite.",
    );
  });

  test("a signed-up user can return to onboarding and switch role", async ({ open }) => {
    // Use the impostor (currently pending) so the main personas are untouched.
    const api = await apiAs(personas.impostor);
    expect((await api.post("/api/auth/set-role", { data: { role: "student" } })).ok()).toBe(true);
    const res = await api.post("/api/auth/set-role", { data: { role: "parent" } });
    if (res.ok()) {
      finding(
        "security",
        "Users can change their own role at any time",
        "POST /api/auth/set-role accepts a new student/parent role from someone who already has one. A student can turn " +
          "themselves into a parent and then link to any other student (see the parent-link finding). Lock the role " +
          "after onboarding, or let only the tutor change it.",
      );
    }
    const page = await open(personas.impostor);
    await page.goto("/onboarding");
    if (await page.getByRole("button", { name: /^Student/ }).isVisible()) {
      finding(
        "ux",
        "The onboarding page stays reachable after sign-up",
        "Visiting /onboarding as an existing user shows the role picker again instead of sending them home.",
      );
    }
  });

  test("tutor onboarding rule is duplicated between browser and server", async () => {
    finding(
      "bug",
      "Tutor sign-up rules disagree between the page and the server",
      "The onboarding page only allows tutor sign-up for emails ending in @claritymathematics.com, while the server " +
        "uses the TUTOR_EMAILS allowlist. An allowlisted address on another domain is blocked by the page, and a " +
        "@claritymathematics.com address missing from TUTOR_EMAILS gets a generic 'Something went wrong'. Let the " +
        "server decide and show its error message (artifacts/tutor-hub/src/pages/onboarding.tsx:29).",
    );
  });
});
