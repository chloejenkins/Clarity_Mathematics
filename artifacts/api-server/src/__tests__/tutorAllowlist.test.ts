import { describe, it, expect, vi, afterEach } from "vitest";

// Mutable per test: the email addresses Clerk reports for the signed-in user.
const clerkUser = vi.hoisted(() => ({ emails: [] as string[] }));

vi.mock("@clerk/express", () => ({
  getAuth: () => ({ userId: "user_1" }),
  clerkClient: {
    users: {
      getUser: async () => ({
        username: null,
        firstName: "Pat",
        lastName: null,
        imageUrl: null,
        emailAddresses: clerkUser.emails.map((emailAddress) => ({ emailAddress })),
      }),
      updateUserMetadata: async () => ({}),
    },
  },
}));

vi.mock("@workspace/db", async () => {
  const schema = await import("@workspace/db/schema");
  const { fakeDb } = await import("./helpers/fakeDb");
  return { ...schema, db: fakeDb.db };
});

// The allowlist is parsed once at import time, so each case re-imports it.
async function loadAllowlist(tutorEmails: string | undefined) {
  vi.resetModules();
  if (tutorEmails === undefined) vi.stubEnv("TUTOR_EMAILS", undefined);
  else vi.stubEnv("TUTOR_EMAILS", tutorEmails);
  return import("../lib/tutorAllowlist");
}

afterEach(() => vi.unstubAllEnvs());

describe("tutor allowlist", () => {
  it("matches listed addresses case-insensitively and ignores whitespace", async () => {
    const { isAllowedTutorEmail } = await loadAllowlist(" Tutor@Example.com , second@example.com,,");
    expect(isAllowedTutorEmail("tutor@example.com")).toBe(true);
    expect(isAllowedTutorEmail("  TUTOR@EXAMPLE.COM ")).toBe(true);
    expect(isAllowedTutorEmail("second@example.com")).toBe(true);
  });

  it("rejects unlisted, partial and empty addresses", async () => {
    const { isAllowedTutorEmail } = await loadAllowlist("tutor@example.com");
    expect(isAllowedTutorEmail("student@example.com")).toBe(false);
    expect(isAllowedTutorEmail("tutor@example.co")).toBe(false);
    expect(isAllowedTutorEmail("example.com")).toBe(false);
    expect(isAllowedTutorEmail("")).toBe(false);
    expect(isAllowedTutorEmail(null)).toBe(false);
    expect(isAllowedTutorEmail(undefined)).toBe(false);
  });

  it.each([undefined, "", " , "])("fails closed when TUTOR_EMAILS is %j", async (value) => {
    const { isAllowedTutorEmail, anyAllowedTutorEmail } = await loadAllowlist(value);
    expect(isAllowedTutorEmail("tutor@example.com")).toBe(false);
    expect(anyAllowedTutorEmail(["tutor@example.com", ""])).toBe(false);
  });

  it("allows an account if any of its addresses is listed", async () => {
    const { anyAllowedTutorEmail } = await loadAllowlist("tutor@example.com");
    expect(anyAllowedTutorEmail(["personal@gmail.com", "Tutor@example.com"])).toBe(true);
    expect(anyAllowedTutorEmail(["personal@gmail.com", null])).toBe(false);
    expect(anyAllowedTutorEmail([])).toBe(false);
  });
});

describe("POST /auth/set-role", () => {
  async function setRole(role: string, tutorEmails: string) {
    await loadAllowlist(tutorEmails);
    const { fakeDb } = await import("./helpers/fakeDb");
    fakeDb.reset();
    const { testApp } = await import("./helpers/testApp");
    const { default: router } = await import("../routes/parentLinks");
    const { default: request } = await import("supertest");
    const res = await request(testApp(router, null)).post("/api/auth/set-role").send({ role });
    return { res, writes: fakeDb.writes() };
  }

  it("refuses the tutor role for an email not on the allowlist", async () => {
    clerkUser.emails = ["student@example.com"];
    const { res, writes } = await setRole("tutor", "tutor@example.com");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("INVALID_TUTOR_EMAIL");
    expect(writes).toEqual([]);
  });

  it("refuses the tutor role when no allowlist is configured", async () => {
    clerkUser.emails = ["tutor@example.com"];
    const { res, writes } = await setRole("tutor", "");
    expect(res.status).toBe(403);
    expect(writes).toEqual([]);
  });

  it("grants the tutor role to an allowlisted email", async () => {
    clerkUser.emails = ["Tutor@Example.com"];
    const { res, writes } = await setRole("tutor", "tutor@example.com");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, role: "tutor", tutorId: null });
    expect(writes).toEqual(["insert"]);
  });

  it("does not consult the allowlist for the student role", async () => {
    clerkUser.emails = ["student@example.com"];
    const { res } = await setRole("student", "");
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("student");
  });
});
