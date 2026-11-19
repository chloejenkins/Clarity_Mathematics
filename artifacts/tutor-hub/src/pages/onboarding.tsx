import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserRound, Users, GraduationCap, ArrowRight, CheckCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { setRole as postSetRole, createParentLink } from "@workspace/api-client-react";
import { Logo } from "@/components/logo";

type Step = "role" | "profile-parent" | "profile-student";

export default function OnboardingPage() {
  const { user: clerkUser } = useUser();
  const { user: appUser } = useAuth();
  const [step, setStep] = useState<Step>("role");

  // The role is chosen once. Someone who already finished sign-up and lands
  // here again goes back to the app instead of seeing the role choice.
  useEffect(() => {
    if (step === "role" && appUser && appUser.role !== "pending") {
      window.location.href = "/";
    }
  }, [step, appUser]);
  const [studentEmail, setStudentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || clerkUser?.username || "there";

  async function setRole(role: "parent" | "student" | "tutor") {
    await postSetRole({ role });
  }

  async function handleRoleSelect(role: "parent" | "student" | "tutor") {
    setError(null);

    if (role === "tutor") {
      // Whether this email may be a tutor is decided by the server's
      // TUTOR_EMAILS list, so ask it rather than guessing from the domain.
      setLoading(true);
      try {
        await setRole("tutor");
        await clerkUser?.reload();
        window.location.href = "/";
      } catch (e) {
        const code = (e as { data?: { code?: string } })?.data?.code;
        setError(
          code === "INVALID_TUTOR_EMAIL"
            ? "This email isn't set up for a tutor account. Please choose Student or Parent below."
            : "Something went wrong. Please try again.",
        );
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
        await createParentLink({ studentEmail: studentEmail.trim() });
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
    <div className="min-h-dvh bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo className="text-foreground" style={{ fontSize: "1.3rem" }} />
          </div>
          <h1 className="page-title">Welcome</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">Let's get your account set up.</p>
        </div>

        {/* Step: Role selection */}
        {step === "role" && (
          <div className="space-y-4">
            <p className="eyebrow px-4 mb-2">I am signing up as a…</p>
            <div className="rounded-xl bg-card overflow-hidden divide-y divide-border">

            <RoleCard
              icon={<UserRound className="h-6 w-6" />}
              title="Student"
              desc="I'm accessing my own sessions and assignments"
              onClick={() => handleRoleSelect("student")}
              disabled={loading}
            />
            <RoleCard
              icon={<Users className="h-6 w-6" />}
              title="Parent / Guardian"
              desc="I'm managing sessions and payments for my child"
              onClick={() => handleRoleSelect("parent")}
              disabled={loading}
            />
            <RoleCard
              icon={<GraduationCap className="h-6 w-6" />}
              title="Tutor"
              desc="I provide tutoring sessions and manage students"
              onClick={() => handleRoleSelect("tutor")}
              disabled={loading}
            />
            </div>

            {error && <p className="text-sm text-destructive text-center mt-2">{error}</p>}
          </div>
        )}

        {/* Step: Parent profile */}
        {step === "profile-parent" && (
          <div className="bg-card text-card-foreground rounded-xl p-5 space-y-5">
            <div>
              <h2 className="font-semibold text-foreground text-xl">Hi, {displayName}!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your child's email (the one they signed up with) to send a link request. Once your child
                or their tutor approves it, you'll see their feedback, schedule, and payments. You can also do this later.
              </p>
            </div>

            <div>
              <label htmlFor="child-email" className="text-sm font-medium text-foreground mb-1.5 block">
                Child's email
              </label>
              <Input
                id="child-email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="child@example.com"
                value={studentEmail}
                onChange={e => setStudentEmail(e.target.value)}
                className="rounded-xl"
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

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
          <div className="bg-card text-card-foreground rounded-xl p-6 text-center space-y-5">
            <CheckCircle className="h-14 w-14 text-success mx-auto" />
            <div>
              <h2 className="font-bold text-foreground text-2xl">You're all set, {displayName}!</h2>
              <p className="text-sm text-muted-foreground mt-2">
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
  icon, title, desc, onClick, disabled,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className="w-full bg-card text-card-foreground px-4 py-3.5 text-left flex items-center gap-3.5 hover:bg-accent/60 transition-colors group disabled:opacity-50"
    >
      <div className="h-9 w-9 rounded-[9px] flex items-center justify-center shrink-0 bg-primary text-primary-foreground [&_svg]:h-5 [&_svg]:w-5" aria-hidden>
        {icon}
      </div>
      <div>
        <p className="text-[17px] text-foreground">{title}</p>
        <p className="text-[15px] leading-snug text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground/60 ml-auto shrink-0" aria-hidden />
    </button>
  );
}
