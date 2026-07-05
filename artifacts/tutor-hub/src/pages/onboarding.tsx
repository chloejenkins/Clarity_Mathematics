import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRound, Users, ArrowRight, CheckCircle } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";

type Step = "role" | "link-student" | "done";

export default function OnboardingPage() {
  const { user: clerkUser } = useUser();
  const [step, setStep] = useState<Step>("role");
  const [selectedRole, setSelectedRole] = useState<"parent" | "student" | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRoleSelect(role: "parent" | "student") {
    setSelectedRole(role);
    setLoading(true);
    setError(null);
    try {
      await customFetch("/api/auth/set-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      if (role === "parent") {
        setStep("link-student");
      } else {
        await clerkUser?.reload();
        window.location.href = "/";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkStudent() {
    if (!studentName.trim()) { setError("Please enter your student's name."); return; }
    setLoading(true);
    setError(null);
    try {
      await customFetch("/api/parent-links", {
        method: "POST",
        body: JSON.stringify({
          studentName: studentName.trim(),
          studentEmail: studentEmail.trim() || undefined,
        }),
      });
      await clerkUser?.reload();
      window.location.href = "/";
    } catch {
      setError("Could not link student. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkipLink() {
    await clerkUser?.reload();
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex flex-col leading-none select-none items-center mb-4">
            <span className="font-serif text-4xl font-bold tracking-tight text-[#c9a227]">CM</span>
            <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mt-1">Clarity Mathematics</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Welcome</h1>
          <p className="text-slate-500 mt-1 text-sm">Let's set up your account</p>
        </div>

        {step === "role" && (
          <div className="space-y-4">
            <p className="text-center text-sm font-semibold text-slate-600 mb-6">I am signing up as a…</p>
            <button
              onClick={() => handleRoleSelect("parent")}
              disabled={loading}
              className="w-full bg-white border-2 border-slate-200 hover:border-blue-900 rounded-2xl p-5 text-left flex items-center gap-4 transition-all group shadow-sm hover:shadow-md"
            >
              <div className="h-12 w-12 rounded-xl bg-blue-50 group-hover:bg-blue-900/10 flex items-center justify-center shrink-0 transition-colors">
                <Users className="h-6 w-6 text-blue-900" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Parent / Guardian</p>
                <p className="text-sm text-slate-500 mt-0.5">I'm managing sessions and payments for my child</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-900 ml-auto transition-colors" />
            </button>

            <button
              onClick={() => handleRoleSelect("student")}
              disabled={loading}
              className="w-full bg-white border-2 border-slate-200 hover:border-blue-900 rounded-2xl p-5 text-left flex items-center gap-4 transition-all group shadow-sm hover:shadow-md"
            >
              <div className="h-12 w-12 rounded-xl bg-slate-50 group-hover:bg-blue-900/10 flex items-center justify-center shrink-0 transition-colors">
                <UserRound className="h-6 w-6 text-slate-700 group-hover:text-blue-900" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Student</p>
                <p className="text-sm text-slate-500 mt-0.5">I'm accessing my own sessions and assignments</p>
              </div>
              <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-900 ml-auto transition-colors" />
            </button>

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>
        )}

        {step === "link-student" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Link your student</h2>
              <p className="text-sm text-slate-500 mt-1">
                Add your child's details so the tutor can associate your account with their sessions.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1 block">
                  Student's full name <span className="text-red-400">*</span>
                </label>
                <Input
                  placeholder="e.g. Jamie Smith"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1 block">
                  Student's email (optional — if they have an account)
                </label>
                <Input
                  type="email"
                  placeholder="student@example.com"
                  value={studentEmail}
                  onChange={e => setStudentEmail(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2">
              <Button
                onClick={handleLinkStudent}
                disabled={loading || !studentName.trim()}
                className="flex-1 rounded-xl"
              >
                {loading ? "Saving…" : "Continue"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="outline" onClick={handleSkipLink} disabled={loading} className="rounded-xl">
                Skip
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-lg font-bold text-slate-900">You're all set!</p>
            <p className="text-slate-500 text-sm mt-1">Redirecting to your portal…</p>
          </div>
        )}
      </div>
    </div>
  );
}
