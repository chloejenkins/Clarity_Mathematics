import { Button } from "@/components/ui/button";
import { useAuth } from "@workspace/replit-auth-web";
import { GraduationCap, ArrowRight, BookOpen, MessageSquare, Video } from "lucide-react";
import { motion } from "framer-motion";

export default function LandingPage() {
  const { login } = useAuth();

  const features = [
    { icon: CalendarDays, title: "Easy Scheduling", desc: "Book math sessions instantly." },
    { icon: MessageSquare, title: "Secure Chat", desc: "Ask questions anytime." },
    { icon: BookOpen, title: "Assignments", desc: "Track your homework." },
    { icon: Video, title: "Tutorials", desc: "Watch curated math videos." },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <header className="px-6 lg:px-12 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-xl shadow-lg shadow-primary/25">
            <GraduationCap className="h-6 w-6" />
          </div>
          <span className="font-display font-bold text-2xl tracking-tight text-foreground">Math Tutor Hub</span>
        </div>
        <Button onClick={login} variant="ghost" className="font-semibold text-base hover-elevate">
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
          <h1 className="text-5xl lg:text-7xl font-display font-extrabold tracking-tight text-foreground leading-[1.1] mb-6">
            Master Middle School <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Math</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-xl leading-relaxed">
            Your all-in-one portal for scheduling sessions, accessing curated video tutorials, tracking assignments, and chatting directly with your tutor.
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
                transition={{ delay: 0.3 + (i * 0.1) }}
              >
                <div className="bg-card p-2 rounded-lg border border-border shadow-sm">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">{f.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
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
          <div className="relative rounded-[2rem] overflow-hidden shadow-2xl shadow-primary/10 border-8 border-background/50 bg-background">
            <img 
              src={`${import.meta.env.BASE_URL}images/hero-bg.png`}
              alt="Abstract math shapes background" 
              className="w-full h-auto object-cover aspect-[4/3]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent flex items-end p-8">
               <div className="bg-card/90 backdrop-blur-md p-6 rounded-2xl border border-border shadow-xl max-w-xs">
                 <div className="flex items-center gap-3 mb-3">
                   <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                     <CalendarDays className="h-5 w-5" />
                   </div>
                   <div>
                     <p className="text-sm font-bold">Upcoming Session</p>
                     <p className="text-xs text-muted-foreground">Tomorrow, 4:00 PM</p>
                   </div>
                 </div>
                 <Button variant="secondary" className="w-full text-xs h-8">Join Meeting</Button>
               </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

// Keep the import happy
import { CalendarDays } from "lucide-react";
