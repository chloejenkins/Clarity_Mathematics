import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import {
  ArrowRight,
  MessageSquare,
  CalendarDays,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  CreditCard,
  Gift,
  Clock,
  RefreshCcw,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: CalendarDays,
    title: "Smart Scheduling",
    desc: "Pick from available time slots and book instantly — no back-and-forth needed.",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  {
    icon: MessageSquare,
    title: "Private Messaging",
    desc: "A secure, direct chat between student and tutor. No third-party apps needed.",
    bg: "bg-slate-100",
    text: "text-slate-700",
  },
  {
    icon: CreditCard,
    title: "Direct Payments",
    desc: "Pay simply via Venmo or Zelle. No third-party billing platforms or hidden fees.",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Private",
    desc: "Only enrolled students and the tutor have access. Fully private and logged.",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
];

const trustPoints = [
  "No social features or public profiles",
  "Parent-approved student access only",
  "All sessions tracked and recorded",
];

export default function LandingPage() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Nav */}
      <header className="px-6 md:px-10 py-4 flex items-center justify-between bg-white/95 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-200">
        <div className="flex flex-col leading-none select-none">
          <span className="font-display text-3xl font-bold tracking-tight text-[#c9a227]">CM</span>
          <span className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mt-0.5">Clarity Mathematics</span>
        </div>
        <Button
          onClick={login}
          className="bg-blue-900 hover:bg-blue-800 text-white text-sm h-9 px-5 rounded-lg"
        >
          Sign In
        </Button>
      </header>
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden" style={{ background: "radial-gradient(ellipse at center, #ffffff 0%, #ffffff 85%, #f5f8ff 100%)" }}>

          <div className="relative max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-14 items-center">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 mb-7">
                <Sparkles className="h-3.5 w-3.5" />
                Private Mathematics Tutoring
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.1] mb-5">
                Reach Your{" "}
                <span className="text-blue-900">
                  Math Goals
                </span>
              </h1>

              <p className="text-lg text-slate-500 leading-relaxed mb-9 max-w-md">
                Book sessions, message your tutor, and pay directly — all in one private space.
              </p>

              <Button
                onClick={login}
                size="lg"
                className="bg-blue-900 hover:bg-blue-800 text-white h-13 px-8 text-base font-semibold rounded-xl shadow-lg shadow-blue-900/20 hover:-translate-y-0.5 transition-all duration-200"
              >
                Access the Portal <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <ul className="mt-9 space-y-3">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-slate-500">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Portal card */}
            <motion.div
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.18 }}
            >
              <div className="bg-blue-900 rounded-3xl p-8 text-white shadow-2xl shadow-blue-900/30 flex flex-col gap-7">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col leading-none select-none">
                    <span className="font-display text-4xl font-bold tracking-tight text-[#c9a227]">CM</span>
                    <span className="text-[9px] font-semibold tracking-widest uppercase text-blue-300 mt-1">Clarity Mathematics</span>
                  </div>
                  <p className="text-blue-300 text-xs">Student &amp; Parent Portal</p>
                </div>

                <div className="space-y-3">
                  {[
                    { icon: CalendarDays, text: "View &amp; book upcoming sessions" },
                    { icon: MessageSquare, text: "Message your tutor directly" },
                  ].map(({ icon: Icon, text }, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                      <Icon className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-sm text-blue-100" dangerouslySetInnerHTML={{ __html: text }} />
                    </div>
                  ))}
                </div>

                <Button
                  onClick={login}
                  className="w-full bg-[#c9a227] text-blue-900 hover:bg-amber-300 font-bold rounded-xl h-11 text-sm shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                >
                  Sign in to your portal <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature section */}
        <section className="py-20 bg-slate-50 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="text-center mb-14">
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3">
                Everything in one place
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto text-base">
                Designed to keep students accountable and parents informed — without the noise of general-purpose apps.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-5">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i, duration: 0.5 }}
                >
                  <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                    <f.icon className={`h-5 w-5 ${f.text}`} />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Booking + Payment section */}
        <section className="py-20 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-6 md:px-10">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3">
                Book a Session
              </h2>
              <p className="text-slate-500 max-w-md mx-auto">
                Pick a time that works for you — sessions are confirmed instantly.
              </p>
            </div>

            {/* Policy + Payment row */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-10">
              {/* Policy */}
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Pricing &amp; Policy</p>
              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <Gift className="h-3.5 w-3.5 text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">First session free</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">No payment needed to get started.</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="bg-amber-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <Clock className="h-3.5 w-3.5 text-amber-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">50% refund</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">If cancelled within 24 hours of session.</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                  <div className="bg-blue-100 p-1.5 rounded-lg shrink-0 mt-0.5">
                    <RefreshCcw className="h-3.5 w-3.5 text-blue-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">100% refund</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">If cancelled more than 24 hours in advance.</p>
                  </div>
                </div>
              </div>

              {/* Payment methods */}
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Payment Methods</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#008CFF]/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#008CFF]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19.014 2.002c.394 1.18.569 2.398.569 3.95C19.583 11.2 14.72 18.3 10.8 22H3.985L1 3.23l6.02-.567 1.567 12.634c1.46-2.48 3.26-6.386 3.26-9.048 0-1.458-.25-2.449-.622-3.277l7.79-.97z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Venmo</p>
                    <p className="text-xs text-slate-400">Handle coming soon</p>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#6D1ED4]/10 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#6D1ED4]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.25 16.5H9.362l5.513-8.25H8.75v-1.5h8.138L11.375 15H17.25v1.5z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Zelle</p>
                    <p className="text-xs text-slate-400">chloejenkins@claritymathematics.com</p>
                    <p className="text-xs text-slate-400">(862) 357-1374</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* CTA strip */}
        <section className="bg-blue-900 py-16 px-6 md:px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-blue-300 mb-8 max-w-sm mx-auto">Sign in with your account — it takes under a minute.</p>
            <Button
              onClick={login}
              size="lg"
              className="bg-amber-400 text-blue-900 hover:bg-amber-300 font-bold px-10 h-13 rounded-xl shadow-xl hover:-translate-y-0.5 transition-all duration-200"
            >
              Access the Portal <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </section>
      </main>
      {/* Footer */}
      <footer className="border-t border-slate-200 py-5 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          Clarity Mathematics
        </div>
        <p className="text-xs text-slate-400">Private · Secure · Focused</p>
      </footer>
    </div>
  );
}
