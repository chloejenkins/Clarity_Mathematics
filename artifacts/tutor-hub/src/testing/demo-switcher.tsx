// Preview only: a "who am I" picker for the fake Clerk SDK.
//
// Shown when the site runs with VITE_E2E_AUTH=1 and VITE_DEMO=1 (see
// e2e/scripts/demo.sh and the hosted preview in preview/Dockerfile). The Sign in button opens it, and a small pill at the
// top of the page lets you switch between the tutor, students and parent at any time.
// The people listed here are the ones e2e/scripts/seed-demo.ts creates; keep
// the two lists in step.
import { useEffect, useState } from "react";

export interface DemoPerson {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  label: string;
  hint: string;
}

export const demoPeople: DemoPerson[] = [
  { id: "user_e2e_tutor", email: "tutor@claritymathematics.com", firstName: "Chloé", lastName: "Jenkins", label: "Tutor", hint: "Chloé Jenkins: runs the lessons" },
  { id: "user_e2e_student", email: "sam.student@e2e.test", firstName: "Sam", lastName: "Carter", label: "Student", hint: "Sam Carter: GCSE, has a parent linked" },
  { id: "user_demo_maya", email: "maya.patel@e2e.test", firstName: "Maya", lastName: "Patel", label: "Student", hint: "Maya Patel: A-level" },
  { id: "user_demo_leo", email: "leo.garcia@e2e.test", firstName: "Leo", lastName: "Garcia", label: "Student", hint: "Leo Garcia: just started" },
  { id: "user_e2e_parent", email: "pat.parent@e2e.test", firstName: "Pat", lastName: "Carter", label: "Parent", hint: "Pat Carter: Sam's parent" },
  { id: "user_demo_new", email: "new.family@e2e.test", firstName: "Nina", lastName: "Newman", label: "New visitor", hint: "Nina Newman: hasn't picked a role yet, so you see onboarding" },
];

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");

function currentId(): string | null {
  try {
    const raw = localStorage.getItem("e2e-identity");
    return raw ? (JSON.parse(raw) as { id?: string }).id ?? null : null;
  } catch {
    return null;
  }
}

function becomePerson(p: DemoPerson | null) {
  if (p) {
    const { id, email, firstName, lastName } = p;
    localStorage.setItem("e2e-identity", JSON.stringify({ id, email, firstName, lastName }));
  } else {
    localStorage.removeItem("e2e-identity");
  }
  window.location.assign(`${BASE}/`);
}

const font = "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

export function DemoSwitcher() {
  const [open, setOpen] = useState(false);
  const me = currentId();
  const mePerson = demoPeople.find((p) => p.id === me);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("e2e:open-sign-in", show);
    return () => window.removeEventListener("e2e:open-sign-in", show);
  }, []);

  return (
    <>
      <button
        type="button"
        data-demo-switcher
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 2147483000, whiteSpace: "nowrap",
          padding: "8px 14px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)",
          background: "rgba(255,255,255,0.92)", color: "#1d1d1f", font: `500 13px ${font}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", cursor: "pointer", backdropFilter: "blur(10px)",
        }}
      >
        Preview as: {mePerson ? `${mePerson.firstName} (${mePerson.label})` : "signed out"} · Switch
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose who to preview as"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 2147483001, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420, maxHeight: "90vh", overflowY: "auto",
              background: "#fff", color: "#1d1d1f", borderRadius: 16, padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)", font: `14px ${font}`,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>Preview the app as…</div>
            <div style={{ color: "#6e6e73", marginBottom: 14 }}>
              Preview with made-up people. No password needed; pick a person to see the site as they would.
            </div>
            {demoPeople.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => becomePerson(p)}
                style={{
                  display: "block", width: "100%", textAlign: "left", marginBottom: 8,
                  padding: "10px 12px", borderRadius: 10, cursor: "pointer", font: `14px ${font}`,
                  border: p.id === me ? "2px solid #0071e3" : "1px solid #d2d2d7",
                  background: p.id === me ? "#f0f6ff" : "#fff", color: "#1d1d1f",
                }}
              >
                <div style={{ fontWeight: 600 }}>{p.label}</div>
                <div style={{ color: "#6e6e73", fontSize: 13 }}>{p.hint}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => becomePerson(null)}
              style={{
                display: "block", width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 10,
                border: "none", background: "transparent", color: "#0071e3", cursor: "pointer", font: `14px ${font}`,
              }}
            >
              Sign out (see the public landing page)
            </button>
          </div>
        </div>
      )}
    </>
  );
}
