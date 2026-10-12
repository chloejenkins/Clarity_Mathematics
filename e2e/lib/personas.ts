// The people the harness plays. Ids are fixed so tests and the database line up
// across runs; emails decide what onboarding allows (the tutor address must be
// in the API's TUTOR_EMAILS and end in @claritymathematics.com).
export interface Persona {
  key: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "tutor" | "student" | "parent";
}

export const personas = {
  tutor: { key: "tutor", id: "user_e2e_tutor", email: "tutor@claritymathematics.com", firstName: "Tess", lastName: "Tutor", role: "tutor" },
  student: { key: "student", id: "user_e2e_student", email: "sam.student@e2e.test", firstName: "Sam", lastName: "Student", role: "student" },
  parent: { key: "parent", id: "user_e2e_parent", email: "pat.parent@e2e.test", firstName: "Pat", lastName: "Parent", role: "parent" },
  // A second, unrelated family, used to check that data does not leak between families.
  otherStudent: { key: "otherStudent", id: "user_e2e_other", email: "olly.other@e2e.test", firstName: "Olly", lastName: "Other", role: "student" },
  // Someone with a non-allowlisted address who tries to become a tutor.
  impostor: { key: "impostor", id: "user_e2e_impostor", email: "mallory@e2e.test", firstName: "Mallory", lastName: "Impostor", role: "student" },
} satisfies Record<string, Persona>;

export type PersonaKey = keyof typeof personas;

/** Same token format the fake Clerk SDKs use: `e2e.<base64url identity>`. */
export function tokenFor(p: Persona): string {
  const identity = { id: p.id, email: p.email, firstName: p.firstName, lastName: p.lastName };
  return "e2e." + Buffer.from(JSON.stringify(identity)).toString("base64url");
}

export function identityJson(p: Persona): string {
  return JSON.stringify({ id: p.id, email: p.email, firstName: p.firstName, lastName: p.lastName });
}
