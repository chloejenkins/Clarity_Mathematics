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
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: CalendarDays,
    title: "Session Scheduling",
    desc: "Students request sessions with a preferred time and topic. You approve, decline, or reschedule — all in one place.",
  },
  {
    icon: MessageSquare,
    title: "Private Messaging",
    desc: "A secure, direct chat between student and tutor. No third-party apps, no public threads.",
  },
  {
    icon: BookOpen,
    title: "Assignment Tracking",
    desc: "Post homework with instructions and due dates. Students can optionally submit their work directly in the portal.",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Controlled",
    desc: "Only enrolled students and the tutor have access. Every conversation is private and logged.",
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
      <header className="px-6 md:px-10 py-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg text-slate-800 tracking-tight">
            Tutoring for Understanding
          </span>
        </div>
        <Button
          onClick={login}
          variant="outline"
          className="font-medium border-slate-200 text-slate-700 hover:bg-slate-50"
        >
          Sign In
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-20 grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase bg-indigo-50 text-indigo-600 border border-indigo-100 mb-6">
              Private One-on-One Tutoring
            </span>

            <h1 className="font-display text-4xl md:text-5xl font-bold text-slate-900 leading-[1.1] mb-6">
              Reach Your{" "}
              <span className="text-indigo-600">
                Math Goals
              </span>
            </h1>

            <p className="text-lg text-slate-500 leading-relaxed mb-8 max-w-md">
              A structured, professional portal connecting students with their tutor — for scheduling, communication, and homework, all in one private space.
            </p>

            <Button
              onClick={login}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-14 px-8 text-base rounded-xl shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all duration-200"
            >
              Access the Portal <ArrowRight className="ml-2 h-5 w-5" />
            </Button>

            <ul className="mt-10 space-y-2.5">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2.5 text-sm text-slate-500">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Preview cards */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          >
            {/* Session card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                  <CalendarDays className="h-4 w-4 text-indigo-500" />
                  Upcoming Session
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                  Confirmed
                </span>
              </div>
              <p className="text-xl font-semibold text-slate-800">Tomorrow · 4:00 PM</p>
              <p className="text-sm text-slate-400 mt-0.5">Linear Equations — 60 minutes</p>
              <div className="mt-4 h-px bg-slate-100" />
              <p className="text-xs text-slate-400 mt-3 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" /> With your tutor
              </p>
            </div>

            {/* Chat card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <p className="text-sm font-medium text-slate-500 mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-indigo-500" /> Private Message
              </p>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-full bg-indigo-100 shrink-0 flex items-center justify-center text-indigo-700 font-bold text-sm">
                  T
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl rounded-tl-sm px-4 py-3 text-sm text-slate-700 leading-relaxed">
                  Great work today — you really understood the concept. I've posted a few practice problems for you.
                </div>
              </div>
            </div>

            {/* Assignment card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500 mb-1 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-indigo-500" /> New Assignment
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
        </section>

        {/* Feature section */}
        <section className="bg-slate-50 border-t border-slate-100 py-20">
          <div className="max-w-6xl mx-auto px-6 md:px-10">
            <div className="text-center mb-14">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-slate-900 mb-3">
                Everything in one place
              </h2>
              <p className="text-slate-500 max-w-lg mx-auto">
                Designed to keep students accountable and parents informed — without the noise of general-purpose apps.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
              {features.map((f, i) => (
                <motion.div
                  key={i}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow duration-200"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i, duration: 0.5 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm mb-2">{f.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-6 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <GraduationCap className="h-4 w-4" />
          Tutoring for Understanding
        </div>
        <p className="text-xs text-slate-400">Private · Secure · Focused</p>
      </footer>
    </div>
  );
}
