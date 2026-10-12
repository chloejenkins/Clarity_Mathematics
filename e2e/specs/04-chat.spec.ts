import { test, expect } from "../lib/test";
import { personas } from "../lib/personas";
import { apiAs, navigate } from "../lib/session";
import { finding, expectRule } from "../lib/findings";

test.describe("chat between the tutor and a family", () => {
  test("student starts a conversation with the tutor", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/");
    await navigate(page, "Chat");
    await page.getByRole("button", { name: "New" }).click();
    const dialog = page.getByRole("dialog", { name: "New conversation" });
    await expect(dialog.getByRole("button", { name: /Tess Tutor/ })).toBeVisible();
    await dialog.getByRole("button", { name: /Tess Tutor/ }).click();
    await dialog.getByRole("button", { name: "Start chat" }).click();
    const box = page.getByPlaceholder("Message Tess Tutor…");
    await box.fill("Hi! Can we go over #7 on Thursday?");
    await box.press("Enter");
    await expect(page.locator("main").getByText("Hi! Can we go over #7 on Thursday?").last()).toBeVisible();
  });

  test("tutor sees the message and replies", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/");
    await expectRule(
      "gap",
      "No unread-message indicator or notifications",
      "Nothing in the sidebar or elsewhere tells the tutor (or a family) that a new message, booking, cancellation " +
        "or submission has arrived; they have to open each page. Suggest an unread count on Chat and email or text " +
        "notifications for bookings, cancellations, new messages and reviewed work.",
      async () => (await page.getByRole("link", { name: /Chat/ }).first().innerText()).trim() !== "Chat",
    );
    await navigate(page, "Chat");
    await page.getByRole("button", { name: /Sam Student/ }).first().click();
    await expect(page.getByText("Hi! Can we go over #7 on Thursday?").last()).toBeVisible();
    const box = page.getByPlaceholder("Message Sam Student…");
    await box.fill("Of course, bring your working.");
    await box.press("Enter");
    await expect(page.locator("main").getByText("Of course, bring your working.").last()).toBeVisible();
  });

  test("the student receives the reply without reloading", async ({ open }) => {
    const page = await open(personas.student);
    await page.goto("/chat");
    await page.getByRole("button", { name: /Tess Tutor/ }).first().click();
    await expect(page.getByText("Of course, bring your working.").last()).toBeVisible();
  });

  test("tutor starts a group chat with the student and parent", async ({ open }) => {
    const page = await open(personas.tutor);
    await page.goto("/chat");
    await page.getByRole("button", { name: "New" }).click();
    const dialog = page.getByRole("dialog", { name: "New conversation" });
    await dialog.getByRole("button", { name: /Sam Student/ }).click();
    await dialog.getByRole("button", { name: /Pat Parent/ }).click();
    await dialog.getByPlaceholder("Group name (optional)").fill("Sam's progress");
    await dialog.getByRole("button", { name: "Create group (2)" }).click();
    const box = page.getByPlaceholder("Message Sam's progress…");
    await box.fill("Sam did really well this week.");
    await box.press("Enter");

    const parent = await open(personas.parent);
    await parent.goto("/chat");
    await parent.getByRole("button", { name: /Sam's progress/ }).click();
    await expect(parent.getByText("Sam did really well this week.").last()).toBeVisible();
  });

  test("an unrelated student can't find this family to message", async ({ open }) => {
    const page = await open(personas.otherStudent);
    await page.goto("/chat");
    await page.getByRole("button", { name: "New" }).click();
    const dialog = page.getByRole("dialog", { name: "New conversation" });
    await expect(dialog.getByRole("button", { name: /Tess Tutor/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Sam Student/ })).toHaveCount(0);

    // The picker hides other families, but the server should refuse too.
    const api = await apiAs(personas.otherStudent);
    const res = await api.post("/api/conversations", { data: { participantIds: [personas.student.id] } });
    await expectRule(
      "security",
      "Anyone can open a chat with any user id",
      "POST /api/conversations (and the older POST /api/messages) accept any existing user id, so a student who " +
        "learns another student's id can message them directly. Limit participants to the people GET /api/users " +
        "returns for the caller (their tutor, their linked family).",
      () => res.status() === 403,
    );
  });
});
