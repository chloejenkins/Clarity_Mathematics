import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import {
  GraduationCap,
  ArrowRight,
  BookOpen,
  MessageSquare,
  CalendarDays,
  ShieldCheck,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: CalendarDays,
    title: "Smart Scheduling",
    desc: "Pick from available time slots and book instantly — no back-and-forth needed.",
    color: "from-violet-500 to-indigo-500",
    bg: "bg-violet-50",
    text: "text-violet-600",
  },
  {
    icon: MessageSquare,
    title: "Private Messaging",
    desc: "A secure, direct chat between student and tutor. No third-party apps needed.",
    color: "from-blue-500 to-cyan-500",
    bg: "bg-blue-50",
    text: "text-blue-600",
  },
  {
    icon: BookOpen,
    title: "Assignment Tracking",
    desc: "Post homework with due dates. Students submit their work directly in the portal.",
    color: "from-emerald-500 to-teal-500",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Private",
    desc: "Only enrolled students and the tutor have access. Fully private and logged.",
    color: "from-rose-500 to-pink-500",
    bg: "bg-rose-50",
    text: "text-rose-600",
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
      <header className="px-6 md:px-10 py-4 flex items-center justify-between bg-white/80 backdrop-blur-sm sticky top-0 z-50 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white p-1.5 rounded-xl shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-800 tracking-tight">
            Tutoring for Understanding
          </span>
        </div>
        <Button
          onClick={login}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm h-9 px-5 rounded-lg shadow-sm shadow-indigo-200"
        >
          Sign In
        </Button>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900" />
          {/* Subtle grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Glow blobs */}
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-violet-500 rounded-full blur-[120px] opacity-20" />
          <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-indigo-400 rounded-full blur-[100px] opacity-20" />

          <div className="relative max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-14 items-center">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-indigo-200 border border-white/20 mb-7">
                <Sparkles className="h-3.5 w-3.5" />
                Private One-on-One Tutoring
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-[1.1] mb-5">
                Reach Your{" "}
                <span className="bg-gradient-to-r from-violet-300 to-indigo-300 bg-clip-text text-transparent">
                  Math Goals
                </span>
              </h1>

              <p className="text-lg text-indigo-200 leading-relaxed mb-9 max-w-md">
                Book sessions, message your tutor, and track assignments — all in one private space.
              </p>

              <Button
                onClick={login}
                size="lg"
                className="bg-white text-indigo-700 hover:bg-indigo-50 h-13 px-8 text-base font-semibold rounded-xl shadow-xl hover:-translate-y-0.5 transition-all duration-200"
              >
                Access the Portal <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <ul className="mt-9 space-y-3">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-indigo-200">
                    <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Preview cards — floating on dark */}
            <motion.div
              className="space-y-3.5"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.18 }}
            >
              {/* Session card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-indigo-200">
                    <CalendarDays className="h-4 w-4 text-violet-300" />
                    Upcoming Session
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-400/30">
                    Confirmed
                  </span>
                </div>
                <p className="text-xl font-bold text-white">Tomorrow · 4:00 PM</p>
                <p className="text-sm text-indigo-300 mt-0.5">Linear Equations — 60 minutes</p>
                <div className="mt-4 h-px bg-white/10" />
                <p className="text-xs text-indigo-400 mt-3 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" /> With your tutor
                </p>
              </div>

              {/* Chat card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-2xl">
                <p className="text-sm font-medium text-indigo-200 mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-300" /> Private Message
                </p>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    T
                  </div>
                  <div className="bg-white/15 border border-white/20 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-indigo-100 leading-relaxed">
                    Great work today — you really understood the concept. I've posted a few practice problems for you.
                  </div>
                </div>
              </div>

              {/* Assignment card */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-200 mb-1 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-violet-300" /> New Assignment
                    </p>
                    <p className="font-semibold text-white">Chapter 5 Practice Problems</p>
                    <p className="text-sm text-indigo-300 mt-0.5">Due Friday · Algebra</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
                    Due Soon
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature section */}
        <section className="py-20 bg-slate-50">
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
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
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

        {/* CTA strip */}
        <section className="bg-gradient-to-br from-indigo-950 to-violet-900 py-16 px-6 md:px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-indigo-300 mb-8 max-w-sm mx-auto">
              Sign in with your Replit account — takes under a minute.
            </p>
            <Button
              onClick={login}
              size="lg"
              className="bg-white text-indigo-700 hover:bg-indigo-50 font-semibold px-10 h-13 rounded-xl shadow-xl hover:-translate-y-0.5 transition-all duration-200"
            >
              Access the Portal <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-5 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <GraduationCap className="h-4 w-4" />
          Tutoring for Understanding
        </div>
        <p className="text-xs text-slate-400">Private · Secure · Focused</p>
      </footer>
    </div>
  );
}
