import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { motion } from "framer-motion";

const INK = "#1b2740"; // deep navy ink
const GOLD = "#b8901f"; // brand gold, slightly deepened for text contrast
const CREAM = "#f7f3ea"; // warm paper

const steps = [
  {
    n: "01",
    title: "Choose a time",
    body: "Pick a slot from the live calendar. Confirmation is instant, and your first lesson is free, with no card and no commitment.",
  },
  {
    n: "02",
    title: "Meet, one to one",
    body: "Every lesson is private and undivided. Share the work you're stuck on, and message between sessions whenever a question comes up.",
  },
  {
    n: "03",
    title: "See it add up",
    body: "Lesson notes, assignments, and progress live in one place, so a parent can always see exactly where things stand.",
  },
];

export default function LandingPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM, color: INK }}>
      {/* Nav */}
      <header
        className="px-6 md:px-12 py-5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${INK}14` }}
      >
        <img src="/logo-header.png" alt="Clarity Mathematics" className="h-9 w-auto select-none" />
        <button
          onClick={login}
          className="text-sm font-medium tracking-wide hover:opacity-60 transition-opacity"
          style={{ color: INK }}
        >
          Sign in
        </button>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-20 md:pb-28">
          <div className="grid md:grid-cols-12 gap-x-12 gap-y-16 items-center">
            <motion.div
              className="md:col-span-7"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <p
                className="text-[11px] font-semibold uppercase mb-6"
                style={{ color: GOLD, letterSpacing: "0.22em" }}
              >
                For students and parents
              </p>

              <h1
                className="font-display font-semibold leading-[1.05] tracking-[-0.01em] text-[2.5rem] sm:text-5xl md:text-[3.7rem]"
                style={{ color: INK }}
              >
                Private one-on-one
                <br />
                math tutoring.
              </h1>

              <p className="mt-7 text-lg leading-relaxed max-w-md" style={{ color: `${INK}b3` }}>
                A private one-to-one tutoring practice. Book lessons, work through what's hard, and
                watch steady progress take shape, in one calm space made for you and your family.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Button
                  onClick={login}
                  className="h-12 px-7 text-[15px] font-semibold rounded-full text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: INK }}
                >
                  Enter the portal
                </Button>
                <span className="text-sm" style={{ color: `${INK}99` }}>
                  Your first lesson is free.
                </span>
              </div>

              <p className="mt-12 text-sm flex items-center gap-2.5" style={{ color: `${INK}80` }}>
                <span className="inline-block w-8 h-px" style={{ backgroundColor: `${INK}40` }} />
                Taught personally by Chloe Jenkins
              </p>
            </motion.div>

            {/* Portal calling-card */}
            <motion.div
              className="md:col-span-5"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            >
              <div
                className="rounded-2xl p-8 md:p-9"
                style={{ backgroundColor: INK, boxShadow: `0 30px 60px -25px ${INK}66` }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-4xl font-semibold" style={{ color: GOLD }}>
                    CM
                  </span>
                  <span
                    className="text-[10px] uppercase"
                    style={{ color: "#ffffff66", letterSpacing: "0.18em" }}
                  >
                    Est. Portal
                  </span>
                </div>

                <div className="mt-8 space-y-5">
                  <p className="text-white/90 text-[15px] leading-relaxed">
                    The student &amp; parent portal: your schedule, lessons, and messages, all in
                    one place.
                  </p>
                  <div className="h-px w-full" style={{ backgroundColor: "#ffffff1f" }} />
                  <ul className="space-y-3 text-sm" style={{ color: "#ffffffcc" }}>
                    {["Book and manage lessons", "Message your tutor directly", "Follow progress and notes"].map(
                      (t) => (
                        <li key={t} className="flex items-center gap-3">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                          {t}
                        </li>
                      ),
                    )}
                  </ul>
                </div>

                <Button
                  onClick={login}
                  className="mt-8 w-full h-11 rounded-full text-[15px] font-semibold hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: GOLD, color: INK }}
                >
                  Sign in
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How it works: editorial, numbered */}
        <section style={{ borderTop: `1px solid ${INK}14` }}>
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-24">
            <h2
              className="font-display text-2xl md:text-3xl font-semibold mb-14 max-w-md leading-snug"
              style={{ color: INK }}
            >
              A calm, unhurried way to get better at math.
            </h2>
            <div className="grid md:grid-cols-3 gap-x-12 gap-y-12">
              {steps.map((s) => (
                <div key={s.n}>
                  <p className="font-display text-3xl font-semibold mb-4" style={{ color: GOLD }}>
                    {s.n}
                  </p>
                  <h3 className="text-lg font-semibold mb-2.5" style={{ color: INK }}>
                    {s.title}
                  </h3>
                  <p className="text-[15px] leading-relaxed" style={{ color: `${INK}a6` }}>
                    {s.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing & payment */}
        <section style={{ borderTop: `1px solid ${INK}14` }}>
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-24 grid md:grid-cols-2 gap-x-16 gap-y-12">
            <div>
              <p
                className="text-[11px] font-semibold uppercase mb-6"
                style={{ color: GOLD, letterSpacing: "0.2em" }}
              >
                Simple, fair pricing
              </p>
              <dl className="space-y-6">
                {[
                  ["First lesson", "Free. A chance to see if we're a good fit."],
                  ["Cancel 24h ahead", "Full refund, no questions asked."],
                  ["Cancel within 24h", "Half the lesson is refunded."],
                ].map(([term, desc]) => (
                  <div key={term} className="flex gap-5">
                    <dt className="w-36 shrink-0 font-semibold text-[15px]" style={{ color: INK }}>
                      {term}
                    </dt>
                    <dd className="text-[15px] leading-relaxed" style={{ color: `${INK}a6` }}>
                      {desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <p
                className="text-[11px] font-semibold uppercase mb-6"
                style={{ color: GOLD, letterSpacing: "0.2em" }}
              >
                Paying is easy
              </p>
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <span
                    className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#008CFF14" }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#008CFF]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19.014 2.002c.394 1.18.569 2.398.569 3.95C19.583 11.2 14.72 18.3 10.8 22H3.985L1 3.23l6.02-.567 1.567 12.634c1.46-2.48 3.26-6.386 3.26-9.048 0-1.458-.25-2.449-.622-3.277l7.79-.97z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold text-[15px]" style={{ color: INK }}>Venmo</p>
                    <p className="text-sm" style={{ color: `${INK}99` }}>@Chloe-Jenkins-46</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#6D1ED414" }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#6D1ED4]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.25 16.5H9.362l5.513-8.25H8.75v-1.5h8.138L11.375 15H17.25v1.5z" />
                    </svg>
                  </span>
                  <div>
                    <p className="font-semibold text-[15px]" style={{ color: INK }}>Zelle</p>
                    <p className="text-sm" style={{ color: `${INK}99` }}>chloejenkins@claritymathematics.com</p>
                    <p className="text-sm" style={{ color: `${INK}99` }}>(862) 357-1374</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Closing */}
        <section style={{ backgroundColor: INK }}>
          <div className="max-w-6xl mx-auto px-6 md:px-12 py-20 md:py-24 text-center">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-white leading-tight">
              Let's make math make sense.
            </h2>
            <p className="mt-4 text-white/60 max-w-sm mx-auto">
              The first lesson is on me. Sign in whenever you're ready.
            </p>
            <Button
              onClick={login}
              className="mt-9 h-12 px-8 rounded-full text-[15px] font-semibold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: GOLD, color: INK }}
            >
              Enter the portal
            </Button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className="px-6 md:px-12 py-6 flex flex-col sm:flex-row items-center justify-between gap-3"
        style={{ borderTop: `1px solid ${INK}14` }}
      >
        <p className="text-sm" style={{ color: `${INK}80` }}>
          Clarity Mathematics
        </p>
        <div className="flex items-center gap-5 text-xs" style={{ color: `${INK}80` }}>
          <Link href="/privacy" className="hover:opacity-60 transition-opacity">
            Privacy
          </Link>
          <Link href="/terms" className="hover:opacity-60 transition-opacity">
            Terms
          </Link>
          <span>Private · one to one</span>
        </div>
      </footer>
    </div>
  );
}
