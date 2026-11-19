import type { ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { CalendarDays, MessageSquare, TrendingUp, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { Logo, LogoTile } from "@/components/logo";

// Rows in the inset grouped lists below, laid out like iOS Settings:
// a small icon square (one blue that deepens step by step, matching the
// logo tile), a title and a line of detail.
const steps = [
  {
    icon: CalendarDays,
    tint: "bg-[#0A84FF]",
    title: "Choose a time",
    body: "Pick an open slot from the calendar. Booking is instant, and the first lesson is free.",
  },
  {
    icon: MessageSquare,
    tint: "bg-[#0062D1]",
    title: "Meet one-on-one",
    body: "Private lessons, with messaging between sessions for quick questions.",
  },
  {
    icon: TrendingUp,
    tint: "bg-[#003E8A]",
    title: "Track progress",
    body: "Lesson notes, assignments, and progress in one place.",
  },
];

const pricing: [string, string][] = [
  ["First lesson", "Free"],
  ["Cancel 24h ahead", "Full refund"],
  ["Cancel within 24h", "50% refund"],
  ["Missed lesson", "Charged at 50%"],
];

export default function LandingPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl backdrop-saturate-150 pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
          <Logo className="text-foreground" style={{ fontSize: "1.0625rem" }} />
          <button
            onClick={login}
            type="button"
            className="text-[15px] font-medium text-brand px-3 -mr-3 h-11 rounded-full hover:bg-accent transition-colors"
          >
            Sign in
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <motion.section
          className="max-w-3xl mx-auto px-6 pt-16 pb-14 md:pt-24 md:pb-20 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <div className="flex justify-center">
            <LogoTile size="4.5rem" />
          </div>
          <p className="mt-6 text-[17px] font-semibold text-brand">For students and parents</p>
          <h1 className="mt-2 text-[2.5rem] leading-[1.08] sm:text-[3.25rem] md:text-[3.75rem] font-bold tracking-[-0.015em] text-balance">
            Private one&#8209;on&#8209;one math tutoring.
          </h1>
          <p className="mt-5 mx-auto max-w-xl text-[19px] leading-relaxed text-muted-foreground text-balance">
            Book lessons, message your tutor, and track progress, all in one private place.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button onClick={login} className="h-12 px-8 rounded-full text-[17px]">
              Enter the portal
            </Button>
            <span className="text-[15px] text-muted-foreground">Your first lesson is free.</span>
          </div>
        </motion.section>

        <div className="max-w-3xl mx-auto px-5 pb-20 space-y-10">
          <Group title="How it works">
            {steps.map((s) => (
              <Row key={s.title}>
                <span
                  className={`mt-0.5 h-8 w-8 shrink-0 rounded-[8px] flex items-center justify-center text-white ${s.tint}`}
                  aria-hidden
                >
                  <s.icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold">{s.title}</p>
                  <p className="mt-0.5 text-[15px] leading-snug text-muted-foreground">{s.body}</p>
                </div>
              </Row>
            ))}
          </Group>

          <div className="grid gap-10 md:grid-cols-2 md:gap-6">
            <Group title="Simple, fair pricing">
              {pricing.map(([term, value]) => (
                <Row key={term} center>
                  <span className="text-[17px]">{term}</span>
                  <span className="ml-auto text-[17px] text-muted-foreground">{value}</span>
                </Row>
              ))}
            </Group>

            <Group title="Paying is easy">
              <Row center>
                <span className="h-8 w-8 shrink-0 rounded-[8px] bg-[#008CFF] flex items-center justify-center" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.014 2.002c.394 1.18.569 2.398.569 3.95C19.583 11.2 14.72 18.3 10.8 22H3.985L1 3.23l6.02-.567 1.567 12.634c1.46-2.48 3.26-6.386 3.26-9.048 0-1.458-.25-2.449-.622-3.277l7.79-.97z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[17px]">Venmo</p>
                  <p className="text-[15px] text-muted-foreground truncate">@Chloe-Jenkins-46</p>
                </div>
              </Row>
              <Row center>
                <span className="h-8 w-8 shrink-0 rounded-[8px] bg-[#6D1ED4] flex items-center justify-center" aria-hidden>
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.25 16.5H9.362l5.513-8.25H8.75v-1.5h8.138L11.375 15H17.25v1.5z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-[17px]">Zelle</p>
                  <p className="text-[15px] text-muted-foreground truncate">chloejenkins@claritymathematics.com</p>
                  <p className="text-[15px] text-muted-foreground">(862) 357-1374</p>
                </div>
              </Row>
            </Group>
          </div>

          <Group>
            <button
              type="button"
              onClick={login}
              className="w-full flex items-center gap-3 px-4 min-h-11 py-3 text-left text-[17px] text-brand hover:bg-accent/60 transition-colors"
            >
              Sign in to your portal
              <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground/60" aria-hidden />
            </button>
          </Group>
        </div>
      </main>

      <footer className="border-t border-border pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="max-w-5xl mx-auto px-5 md:px-8 pt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[13px] text-muted-foreground">
          <p>© {new Date().getFullYear()} Clarity Mathematics</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="py-2 hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="py-2 hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** An iOS-style inset grouped section: optional header, white rounded group. */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="eyebrow px-4 mb-2">{title}</h2>}
      <div className="rounded-xl bg-card overflow-hidden divide-y divide-border">{children}</div>
    </section>
  );
}

function Row({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <div className={`flex gap-3.5 px-4 py-3 min-h-11 ${center ? "items-center" : "items-start"}`}>
      {children}
    </div>
  );
}
