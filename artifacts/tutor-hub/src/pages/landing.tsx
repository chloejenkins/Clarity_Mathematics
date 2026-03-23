import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { GraduationCap, ArrowRight, BookOpen, MessageSquare, CalendarDays, Lock } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const { login } = useAuth();

  const features = [
    { icon: CalendarDays, title: "Session Scheduling", desc: "Request and manage tutoring sessions." },
    { icon: MessageSquare, title: "Secure Chat", desc: "Private messages with your tutor." },
    { icon: BookOpen, title: "Assignments", desc: "View and submit homework." },
    { icon: Lock, title: "Private & Secure", desc: "Only you and your tutor can access." },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <header className="px-6 lg:px-12 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/25">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-bold text-2xl tracking-tight text-foreground">Math Tutor Hub</span>
        </div>
        <Button onClick={login} variant="ghost" className="font-semibold text-base">
          Sign In
        </Button>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 px-6 lg:px-12 max-w-7xl mx-auto w-full relative z-10 py-12">
        <motion.div
          className="flex-1 flex flex-col items-start text-left"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 text-secondary-foreground font-semibold text-sm mb-6 border border-secondary/20 shadow-sm">
            <span>✨ Making Math Make Sense</span>
          </div>
          <h1 className="text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
            Master Middle School{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
              Math
            </span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed">
            Schedule tutoring sessions, chat securely with your tutor, and track your assignments — all in one place.
          </p>
          <Button
            onClick={login}
            size="lg"
            className="h-14 px-8 text-lg rounded-full shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 transition-all hover:-translate-y-1"
          >
            Enter Portal <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <div className="grid grid-cols-2 gap-6 mt-16 w-full max-w-lg">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="flex items-start gap-3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <div className="bg-card p-2 rounded-lg border border-border shadow-sm shrink-0">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{f.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="flex-1 w-full max-w-lg lg:max-w-none relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
        >
          <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-primary/10 border-8 border-background/50 bg-gradient-to-br from-primary/5 to-secondary/10">
            <div className="p-8 space-y-4 min-h-[300px] flex flex-col justify-center">
              {/* Mock schedule card */}
              <div className="bg-card rounded-2xl border border-border shadow-md p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Session</p>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">APPROVED</span>
                </div>
                <p className="font-bold text-lg">Tomorrow, 4:00 PM</p>
                <p className="text-sm text-muted-foreground">Algebra — 60 min</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <GraduationCap className="h-4 w-4" />
                  <span>With your tutor</span>
                </div>
              </div>
              {/* Mock chat preview */}
              <div className="bg-card rounded-2xl border border-border shadow-md p-5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Message</p>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/15 shrink-0 flex items-center justify-center text-primary font-bold text-sm">T</div>
                  <div className="bg-secondary/50 rounded-xl rounded-tl-sm px-3 py-2 text-sm">
                    Great work on the fractions! See you tomorrow.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
