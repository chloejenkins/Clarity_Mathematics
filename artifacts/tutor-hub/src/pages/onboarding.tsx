import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRound, Users, GraduationCap, ArrowRight, CheckCircle, ChevronLeft } from "lucide-react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";

type Step = "role" | "choose-tutor" | "link-student" | "done";

interface TutorSummary {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  profileImageUrl: string | null;
}

export default function OnboardingPage() {
  const { user: clerkUser } = useUser();
  const [step, setStep] = useState<Step>("role");
  const [selectedRole, setSelectedRole] = useState<"parent" | "student" | "tutor" | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: tutors = [] } = useQuery<TutorSummary[]>({
    queryKey: ["/api/users/tutors"],
    queryFn: () => customFetch("/api/users/tutors"),
    enabled: step === "choose-tutor",
  });

  async function handleRoleSelect(role: "parent" | "student" | "tutor") {
    setSelectedRole(role);
    setError(null);

    if (role === "tutor") {
      // Check email domain client-side first for instant feedback
      const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
      if (!email.toLowerCase().endsWith("@claritymathematics.com")) {
        setError(
          "Tutor accounts require a @claritymathematics.com email address. If you're a student or parent, please choose the correct role below."
        );
        setSelectedRole(null);
        return;
      }
      setLoading(true);
      try {
        await customFetch("/api/auth/set-role", {
          method: "POST",
          body: JSON.stringify({ role }),
        });
        await clerkUser?.reload();
        window.location.href = "/";
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // Students and parents choose a tutor next
    setStep("choose-tutor");
  }

  async function handleTutorSelect(tutorId: string) {
    setSelectedTutorId(tutorId);
    setError(null);
    setLoading(true);
    try {
      await customFetch("/api/auth/set-role", {
        method: "POST",
        body: JSON.stringify({ role: selectedRole, tutorId }),
      });
      if (selectedRole === "parent") {
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
        body: JSON.stringify({ studentName: studentName.trim() }),
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
              icon={<UserRound className="h-6 w-6 text-slate-700 group-hover:text-blue-900" />}
              bg="bg-slate-50 group-hover:bg-blue-900/10"
              title="Student"
              desc="I'm accessing my own sessions and assignments"
              onClick={() => handleRoleSelect("student")}
              disabled={loading}
            />

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>
        )}

        {step === "choose-tutor" && (
          <div className="space-y-4">
            <button
              onClick={() => { setStep("role"); setSelectedRole(null); }}
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-2 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            <p className="text-sm font-semibold text-slate-700 mb-4">
              Choose your tutor
            </p>

            {tutors.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-500 text-sm shadow-sm">
                No tutors found. Ask your tutor to sign up first.
              </div>
            ) : (
              <div className="space-y-3">
                {tutors.map(tutor => {
                  const name = [tutor.firstName, tutor.lastName].filter(Boolean).join(" ") || tutor.username || "Tutor";
                  return (
                    <button
                      key={tutor.id}
                      onClick={() => handleTutorSelect(tutor.id)}
                      disabled={loading}
                      className="w-full bg-white border-2 border-slate-200 hover:border-blue-900 rounded-2xl p-4 text-left flex items-center gap-4 transition-all group shadow-sm hover:shadow-md"
                    >
                      {tutor.profileImageUrl ? (
                        <img src={tutor.profileImageUrl} alt={name} className="h-10 w-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-sm font-bold text-slate-600">
                          {name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{name}</p>
                        <p className="text-xs text-slate-500">Mathematics Tutor</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-900 ml-auto transition-colors" />
                    </button>
                  );
                })}
              </div>
            )}

            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>
        )}

        {step === "link-student" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Link your student</h2>
              <p className="text-sm text-slate-500 mt-1">
                Add your child's name so the tutor can associate your account with their sessions.
              </p>
            </div>

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
