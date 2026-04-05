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
    bg: "bg-violet-50",
    text: "text-violet-600",
  },
  {
    icon: MessageSquare,
    title: "Private Messaging",
    desc: "A secure, direct chat between student and tutor. No third-party apps needed.",
    bg: "bg-indigo-50",
    text: "text-indigo-600",
  },
  {
    icon: BookOpen,
    title: "Assignment Tracking",
    desc: "Post homework with due dates. Students submit their work directly in the portal.",
    bg: "bg-purple-50",
    text: "text-purple-600",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Private",
    desc: "Only enrolled students and the tutor have access. Fully private and logged.",
    bg: "bg-violet-50",
    text: "text-violet-600",
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
      <header className="px-6 md:px-10 py-4 flex items-center justify-between bg-white/90 backdrop-blur-sm sticky top-0 z-50 border-b border-violet-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-gradient-to-br from-violet-500 to-indigo-600 text-white p-1.5 rounded-xl shadow-sm shadow-violet-200">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-bold text-slate-800 tracking-tight">
            Tutoring for Understanding
          </span>
        </div>
        <Button
          onClick={login}
          className="bg-violet-600 hover:bg-violet-700 text-white text-sm h-9 px-5 rounded-lg shadow-sm shadow-violet-200"
        >
          Sign In
        </Button>
      </header>

      <main className="flex-1">
        {/* Hero — light violet tint, white-dominant */}
        <section className="relative overflow-hidden bg-gradient-to-br from-violet-50 via-white to-indigo-50">
          {/* Soft decorative blobs */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-100 rounded-full blur-[100px] opacity-60 -translate-y-1/3 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-100 rounded-full blur-[80px] opacity-50 translate-y-1/3 -translate-x-1/3" />

          <div className="relative max-w-6xl mx-auto px-6 md:px-10 py-16 md:py-24 grid md:grid-cols-2 gap-14 items-center">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200 mb-7">
                <Sparkles className="h-3.5 w-3.5" />
                Private One-on-One Tutoring
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-[1.1] mb-5">
                Reach Your{" "}
                <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                  Math Goals
                </span>
              </h1>

              <p className="text-lg text-slate-500 leading-relaxed mb-9 max-w-md">
                Book sessions, message your tutor, and track assignments — all in one private space.
              </p>

              <Button
                onClick={login}
                size="lg"
                className="bg-violet-600 hover:bg-violet-700 text-white h-13 px-8 text-base font-semibold rounded-xl shadow-lg shadow-violet-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                Access the Portal <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <ul className="mt-9 space-y-3">
                {trustPoints.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-slate-500">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Preview cards — clean white on light bg */}
            <motion.div
              className="space-y-3.5"
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut", delay: 0.18 }}
            >
              {/* Session card */}
              <div className="bg-white rounded-2xl border border-violet-100 shadow-md shadow-violet-100/60 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <CalendarDays className="h-4 w-4 text-violet-500" />
                    Upcoming Session
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                    Confirmed
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-800">Tomorrow · 4:00 PM</p>
                <p className="text-sm text-slate-400 mt-0.5">Linear Equations — 60 minutes</p>
                <div className="mt-4 h-px bg-violet-50" />
                <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-violet-400" /> With your tutor
                </p>
              </div>

              {/* Chat card */}
              <div className="bg-white rounded-2xl border border-violet-100 shadow-md shadow-violet-100/60 p-5">
                <p className="text-sm font-medium text-slate-500 mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-500" /> Private Message
                </p>
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    T
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 leading-relaxed">
                    Great work today — you really understood the concept. I've posted a few practice problems for you.
                  </div>
                </div>
              </div>

              {/* Assignment card */}
              <div className="bg-white rounded-2xl border border-violet-100 shadow-md shadow-violet-100/60 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-violet-500" /> New Assignment
                    </p>
                    <p className="font-semibold text-slate-800">Chapter 5 Practice Problems</p>
                    <p className="text-sm text-slate-400 mt-0.5">Due Friday · Algebra</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100">
                    Due Soon
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Feature section */}
        <section className="py-20 bg-white border-t border-violet-100">
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
                  className="bg-white rounded-2xl border border-violet-100 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200"
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

        {/* CTA strip — light violet, not dark */}
        <section className="bg-gradient-to-br from-violet-600 to-indigo-600 py-16 px-6 md:px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-2xl md:text-3xl font-extrabold text-white mb-4">
              Ready to get started?
            </h2>
            <p className="text-violet-200 mb-8 max-w-sm mx-auto">
              Sign in with your Replit account — takes under a minute.
            </p>
            <Button
              onClick={login}
              size="lg"
              className="bg-white text-violet-700 hover:bg-violet-50 font-semibold px-10 h-13 rounded-xl shadow-xl hover:-translate-y-0.5 transition-all duration-200"
            >
              Access the Portal <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-violet-100 py-5 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <GraduationCap className="h-4 w-4" />
          Tutoring for Understanding
        </div>
        <p className="text-xs text-slate-400">Private · Secure · Focused</p>
      </footer>
    </div>
  );
}
