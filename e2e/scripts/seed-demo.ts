// Fills the local test database with a small, realistic tutoring practice so
// every page of the site has something on it: a tutor, three students, a
// parent, past and upcoming lessons, open times, homework (set, handed in and
// marked), chats, videos, parent reports and payments in every state.
//
// Everything goes through the real API as each person (via the fake Clerk
// token), so the data is exactly what the app itself would create.
//
// Run with the stack up (e2e/scripts/demo.sh does all of this for you):
//   DATABASE_URL=... pnpm --filter @workspace/e2e exec tsx scripts/seed-demo.ts
//
// The people here match the picker in
// artifacts/tutor-hub/src/testing/demo-switcher.tsx.
import { readFileSync } from "node:fs";
import { resetDatabase } from "../lib/db";

const API = process.env.E2E_API_URL ?? "http://localhost:3001";
const WEB = process.env.E2E_WEB_URL ?? "http://localhost:5173";

interface Person { id: string; email: string; firstName: string; lastName: string; ip: string }

const people = {
  tutor: { id: "user_e2e_tutor", email: "tutor@claritymathematics.com", firstName: "Chloé", lastName: "Jenkins", ip: "10.9.0.1" },
  sam: { id: "user_e2e_student", email: "sam.student@e2e.test", firstName: "Sam", lastName: "Carter", ip: "10.9.0.2" },
  maya: { id: "user_demo_maya", email: "maya.patel@e2e.test", firstName: "Maya", lastName: "Patel", ip: "10.9.0.3" },
  leo: { id: "user_demo_leo", email: "leo.garcia@e2e.test", firstName: "Leo", lastName: "Garcia", ip: "10.9.0.4" },
  parent: { id: "user_e2e_parent", email: "pat.parent@e2e.test", firstName: "Pat", lastName: "Carter", ip: "10.9.0.5" },
} satisfies Record<string, Person>;

function token(p: Person): string {
  const { id, email, firstName, lastName } = p;
  return "e2e." + Buffer.from(JSON.stringify({ id, email, firstName, lastName })).toString("base64url");
}

async function call<T = any>(p: Person, method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token(p)}`,
      Origin: WEB,
      "X-Forwarded-For": p.ip,
      ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${p.firstName}: ${method} ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A whole hour `days` from now at `hour`:00 local time. */
function at(days: number, hour: number): string {
  const d = new Date(Date.now() + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  console.log("Clearing the test database…");
  await resetDatabase();
  const reset = await fetch(`${API}/api/__e2e/reset`, { method: "POST" });
  if (!reset.ok) throw new Error("Could not reach the local API. Is the stack running (e2e/scripts/start-stack.sh)?");

  const { tutor, sam, maya, leo, parent } = people;

  console.log("Creating people…");
  await call(tutor, "POST", "/api/auth/set-role", { role: "tutor" });
  for (const s of [sam, maya, leo]) await call(s, "POST", "/api/auth/set-role", { role: "student", tutorId: tutor.id });
  await call(parent, "POST", "/api/auth/set-role", { role: "parent", tutorId: tutor.id });
  await call(tutor, "PUT", "/api/payments/settings", { hourlyRate: 45 });

  console.log("Linking Pat to Sam…");
  const link = await call(parent, "POST", "/api/parent-links", { studentEmail: sam.email });
  await call(sam, "POST", `/api/parent-links/${link.id}/approve`);

  console.log("Adding lessons…");
  type Plan = { who: Person; when: string; topic: string; status: "approved" | "completed" | "pending" | "cancelled"; notes?: string };
  const plan: Plan[] = [
    { who: sam, when: at(-28, 16), topic: "Algebra: solving linear equations", status: "completed", notes: "Great start. Confident with one-step equations; practise brackets." },
    { who: sam, when: at(-21, 16), topic: "Algebra: expanding brackets", status: "completed", notes: "Much better with brackets. Watch the signs when multiplying negatives." },
    { who: sam, when: at(-14, 16), topic: "Simultaneous equations", status: "completed", notes: "Elimination method clicked. Substitution needs another go." },
    { who: sam, when: at(-7, 16), topic: "Quadratics: factorising", status: "completed", notes: "Factorised 8/10 correctly. Homework set on the quadratic formula." },
    { who: sam, when: at(2, 16), topic: "Quadratic formula", status: "approved" },
    { who: sam, when: at(9, 16), topic: "Exam practice paper", status: "pending" },
    { who: maya, when: at(-20, 18), topic: "Differentiation from first principles", status: "completed", notes: "Strong grasp of limits. Moving on to the chain rule." },
    { who: maya, when: at(-13, 18), topic: "Chain rule", status: "completed", notes: "Chain rule solid; product rule next." },
    { who: maya, when: at(-6, 18), topic: "Product and quotient rules", status: "completed", notes: "Quotient rule still a bit slow. Extra practice set." },
    { who: maya, when: at(1, 18), topic: "Integration by substitution", status: "approved" },
    { who: maya, when: at(5, 18), topic: "Mock exam review", status: "cancelled" },
    { who: leo, when: at(-3, 15), topic: "Fractions and percentages", status: "completed", notes: "First session. Friendly and keen; percentages need work." },
    { who: leo, when: at(3, 15), topic: "Ratio and proportion", status: "pending" },
  ];
  for (const p of plan) {
    const s = await call(p.who, "POST", "/api/sessions", { scheduledAt: p.when, durationMinutes: 60, topic: p.topic });
    if (p.status === "cancelled") {
      await call(tutor, "PATCH", `/api/sessions/${s.id}`, { status: "approved" });
      await call(p.who, "PATCH", `/api/sessions/${s.id}`, { status: "cancelled" });
    } else if (p.status !== "pending") {
      await call(tutor, "PATCH", `/api/sessions/${s.id}`, { status: p.status, ...(p.notes ? { notes: p.notes } : {}) });
    }
  }

  console.log("Posting open times…");
  const slots = await call(tutor, "POST", "/api/availability", [
    { startsAt: at(2, 10), durationMinutes: 60 },
    { startsAt: at(4, 17), durationMinutes: 60 },
    { startsAt: at(6, 11), durationMinutes: 60 },
    { startsAt: at(8, 17), durationMinutes: 90 },
    { startsAt: at(10, 16), durationMinutes: 60 },
    { startsAt: at(11, 10), durationMinutes: 60 },
  ]);
  await call(leo, "POST", `/api/availability/${slots[1].id}/book`, { topic: "Algebra basics" });

  console.log("Setting homework…");
  const hw = async (who: Person, title: string, description: string, subject: string, dueDays: number) =>
    call(tutor, "POST", "/api/assignments", { assignedTo: who.id, title, description, subject, dueDate: at(dueDays, 20) });
  const a1 = await hw(sam, "Expanding brackets worksheet", "Questions 1 to 20. Show every step.", "Algebra", -15);
  const a2 = await hw(sam, "Simultaneous equations practice", "Solve each pair by elimination, then check by substitution.", "Algebra", -8);
  const a3 = await hw(sam, "Quadratic formula", "Use the formula on questions 1 to 12. Leave answers as surds where needed.", "Algebra", 4);
  const a4 = await hw(maya, "Chain rule drill", "Exercise 4B, all questions.", "Calculus", -10);
  const a5 = await hw(maya, "Quotient rule practice", "Exercise 5C, questions 1 to 15.", "Calculus", 3);
  await hw(leo, "Percentages warm-up", "Ten short questions on percentage change.", "Number", 5);

  await call(sam, "POST", `/api/assignments/${a1.id}/submit`, { content: "All 20 done. I wasn't sure about question 17, I think the answer is 6x² − 5x − 4." });
  await call(sam, "POST", `/api/assignments/${a2.id}/submit`, { content: "Finished! Q4 and Q7 took a couple of tries." });
  await call(maya, "POST", `/api/assignments/${a4.id}/submit`, { content: "Done, photos of my working are attached." });
  const subs1 = await call(tutor, "GET", `/api/assignments/${a1.id}/submissions`);
  await call(tutor, "POST", `/api/submissions/${subs1[0].id}/review`, { comment: "Excellent work, Sam. Q17 is right! Just watch the minus signs in Q9." });
  const subs4 = await call(tutor, "GET", `/api/assignments/${a4.id}/submissions`);
  await call(tutor, "POST", `/api/submissions/${subs4[0].id}/review`, { comment: "Lovely, Maya. All correct apart from 4B Q11 (missing a factor of 2)." });

  console.log("Attaching files…");
  const fixtures = new URL("../fixtures/", import.meta.url);
  const upload = async (who: Person, file: string, name: string, assignmentId: number, note: string) => {
    const form = new FormData();
    form.append("file", new Blob([readFileSync(new URL(file, fixtures))], { type: "text/plain" }), name);
    form.append("assignmentId", String(assignmentId));
    form.append("note", note);
    await call(who, "POST", "/api/uploads", form);
  };
  await upload(tutor, "worksheet.txt", "quadratic-formula-worksheet.txt", a3.id, "Worksheet for this week");
  await upload(tutor, "practice-sheet.txt", "quotient-rule-practice.txt", a5.id, "Practice questions");
  await upload(maya, "homework.txt", "chain-rule-working.txt", a4.id, "My working");

  console.log("Sharing videos…");
  for (const v of [
    { title: "Expanding double brackets", url: "https://www.youtube.com/watch?v=9zMn3rAnd3Y", subject: "Algebra", description: "A quick refresher before your worksheet." },
    { title: "The quadratic formula", url: "https://www.youtube.com/watch?v=i7idZfS8t8w", subject: "Algebra", description: "Where the formula comes from, and how to use it." },
    { title: "The chain rule", url: "https://www.youtube.com/watch?v=H-ybCx8gt-8", subject: "Calculus", description: "Worked examples, from simple to tricky." },
  ]) await call(tutor, "POST", "/api/videos", v);

  console.log("Starting conversations…");
  const chat = async (from: Person, to: Person, lines: [Person, string][]) => {
    const convo = await call(from, "POST", "/api/conversations", { participantIds: [to.id] });
    for (const [who, content] of lines) await call(who, "POST", `/api/conversations/${convo.id}/messages`, { content });
  };
  await chat(tutor, sam, [
    [tutor, "Hi Sam, great session today! The quadratic formula homework is up now."],
    [sam, "Thanks! Is it fine if I hand it in on Saturday?"],
    [tutor, "Of course, Saturday is fine. Shout if you get stuck on the surds."],
  ]);
  await chat(maya, tutor, [
    [maya, "Hi Chloé, could we spend some time on integration next lesson?"],
    [tutor, "Definitely, I'll bring some substitution questions."],
  ]);
  await chat(parent, tutor, [
    [parent, "Hello! Sam says the lessons are really helping. Is the Thursday slot still okay?"],
    [tutor, "Hi Pat, yes, Thursday at 4pm is booked in. Sam is doing really well."],
  ]);

  console.log("Writing parent reports…");
  await call(tutor, "POST", `/api/parent-feedback/${sam.id}`, {
    period: "October",
    content: "Sam has settled in well and is now confident with linear equations and expanding brackets. Homework is always handed in on time. Next we'll focus on quadratics ahead of the mock exams.",
  });
  await call(tutor, "POST", `/api/parent-feedback/${sam.id}`, {
    period: "November",
    content: "Real progress this month: simultaneous equations by elimination are now secure and factorising is much quicker. The main thing to keep practising is careful sign work with negatives.",
  });

  console.log("Settling some payments…");
  const pays = await call(tutor, "GET", "/api/payments");
  const due = (who: Person) => pays.filter((p: any) => p.studentId === who.id && p.status === "due");
  const samDue = due(sam);
  if (samDue[0]) await call(tutor, "POST", `/api/payments/${samDue[0].id}/mark-received`);
  if (samDue[1]) await call(parent, "POST", `/api/payments/${samDue[1].id}/mark-sent`);
  const mayaDue = due(maya);
  if (mayaDue[0]) await call(maya, "POST", `/api/payments/${mayaDue[0].id}/mark-sent`);

  console.log("\nDemo data is ready. Open " + WEB + " and use the \"Preview as\" button to pick who you are.");
}

main().catch((err) => {
  console.error("\nCould not add the demo data:\n" + (err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
