import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRound, Users, GraduationCap, ArrowRight, CheckCircle, ChevronLeft } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { Logo } from "@/components/logo";

type Step = "role" | "profile-parent" | "profile-student";

export default function OnboardingPage() {
  const { user: clerkUser } = useUser();
  const [step, setStep] = useState<Step>("role");
  const [studentEmail, setStudentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || clerkUser?.username || "there";

  async function setRole(role: "parent" | "student" | "tutor") {
    await customFetch("/api/auth/set-role", {
      method: "POST",
      body: JSON.stringify({ role }),
    });
  }

  async function handleRoleSelect(role: "parent" | "student" | "tutor") {
    setError(null);

    if (role === "tutor") {
      const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
      if (!email.toLowerCase().endsWith("@claritymathematics.com")) {
        setError(
          "Tutor accounts require a @claritymathematics.com email. Please choose Student or Parent below."
        );
        return;
      }
      setLoading(true);
      try {
        await setRole("tutor");
        await clerkUser?.reload();
        window.location.href = "/";
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Student and parent go to a short profile step first
    setLoading(true);
    try {
      await setRole(role);
      if (role === "parent") {
        setStep("profile-parent");
      } else {
        setStep("profile-student");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleParentProfile(skip = false) {
    setLoading(true);
    setError(null);
    try {
      if (!skip && studentEmail.trim()) {
        await customFetch("/api/parent-links", {
          method: "POST",
          body: JSON.stringify({ studentEmail: studentEmail.trim() }),
        });
      }
      await clerkUser?.reload();
      window.location.href = "/";
    } catch (e) {
      const data = (e as { data?: { error?: string } })?.data;
      setError(data?.error ?? "Could not link. You can add your child later from the Feedback tab.");
      setLoading(false);
    }
  }

  async function handleStudentProfile() {
    setLoading(true);
    try {
      await clerkUser?.reload();
      window.location.href = "/";
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo style={{ color: "#1b2740", fontSize: "1.3rem" }} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Welcome</h1>
          <p className="text-slate-500 mt-1 text-sm">Let's get your account set up</p>
        </div>

        {/* Step: Role selection */}
        {step === "role" && (
          <div className="space-y-4">
            <p className="text-center text-sm font-semibold text-slate-600 mb-6">I am signing up as a…</p>

            <RoleCard
              icon={<GraduationCap className="h-6 w-6 text-[#c9a227]" />}
              bg="bg-amber-50 group-hover:bg-amber-100/60"
              title="Tutor"
              desc="I provide tutoring sessions and manage students"
              onClick={() => handleRoleSelect("tutor")}
              disabled={loading}
            />
            <RoleCard
              icon={<Users className="h-6 w-6 text-blue-900" />}
              bg="bg-blue-50 group-hover:bg-blue-900/10"
              title="Parent / Guardian"
              desc="I'm managing sessions and payments for my child"
              onClick={() => handleRoleSelect("parent")}
              disabled={loading}
            />
            <RoleCard
              icon={<UserRound className="h-6 w-6 text-slate-700" />}
              bg="bg-slate-50 group-hover:bg-blue-900/10"
              title="Student"
              desc="I'm accessing my own sessions and assignments"
              onClick={() => handleRoleSelect("student")}
              disabled={loading}
            />

            {error && <p className="text-sm text-red-500 text-center mt-2">{error}</p>}
          </div>
        )}

        {/* Step: Parent profile */}
        {step === "profile-parent" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Hi, {displayName}!</h2>
              <p className="text-sm text-slate-500 mt-1">
                Enter your child's email (the one they signed up with) to send a link request. Once your child
                or their tutor approves it, you'll see their feedback, schedule, and payments. You can also do this later.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5 block">
                Child's email
              </label>
              <Input
                type="email"
                placeholder="child@example.com"
                value={studentEmail}
                onChange={e => setStudentEmail(e.target.value)}
                className="rounded-xl"
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => handleParentProfile(false)}
                disabled={loading}
                className="flex-1 rounded-xl"
              >
                {loading ? "Saving…" : "Link & Continue"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => handleParentProfile(true)} disabled={loading} className="rounded-xl">
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* Step: Student profile */}
        {step === "profile-student" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-5">
            <CheckCircle className="h-14 w-14 text-emerald-500 mx-auto" />
            <div>
              <h2 className="font-bold text-slate-900 text-xl">You're all set, {displayName}!</h2>
              <p className="text-sm text-slate-500 mt-2">
                Browse available tutoring sessions from the calendar and book whenever you're ready.
              </p>
            </div>

            <Button
              onClick={handleStudentProfile}
              disabled={loading}
              className="w-full rounded-xl"
            >
              {loading ? "Loading…" : "Enter Portal"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleCard({
  icon, bg, title, desc, onClick, disabled,
}: {
  icon: React.ReactNode;
  bg: string;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-white border-2 border-slate-200 hover:border-blue-900 rounded-2xl p-5 text-left flex items-center gap-4 transition-all group shadow-sm hover:shadow-md disabled:opacity-50"
    >
      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 transition-colors ${bg}`}>
        {icon}
      </div>
      <div>
        <p className="font-bold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-blue-900 ml-auto transition-colors" />
    </button>
  );
}
