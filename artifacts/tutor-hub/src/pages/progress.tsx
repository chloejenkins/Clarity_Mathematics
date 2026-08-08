import { useQuery } from "@tanstack/react-query";
import { customFetch, useListAssignments } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, CalendarCheck, BookOpen, CheckCircle, FileText, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";

interface SessionLite {
  id: number;
  scheduledAt: string;
  status: string;
  topic: string | null;
  notes: string | null;
  durationMinutes: number;
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number }) {
  return (
    <Card className="border-none shadow-sm rounded-2xl">
      <CardContent className="p-4">
        <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-2xl font-extrabold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

export default function ProgressPage() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";

  const { data: assignments = [] } = useListAssignments();
  const { data: sessions = [] } = useQuery({
    queryKey: ["/api/sessions"],
    queryFn: () => customFetch<SessionLite[]>("/api/sessions"),
  });

  const now = Date.now();
  const completedSessions = sessions.filter((s) => s.status === "completed");
  const upcomingSessions = sessions.filter(
    (s) => (s.status === "approved" || s.status === "pending") && new Date(s.scheduledAt).getTime() > now,
  );
  const submittedCount = assignments.filter((a) => a.submitted).length;
  const reviewedCount = assignments.filter((a) => a.reviewed).length;

  const todo = assignments
    .filter((a) => !a.submitted)
    .sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return ad - bd;
    });

  const recentNotes = completedSessions
    .filter((s) => s.notes)
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 3);

  const who = isParent ? "Your child's" : "Your";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="h-8 w-8 text-primary" /> Progress
        </h1>
        <p className="text-muted-foreground mt-1">
          {who} sessions, assignments, and recent lesson notes at a glance.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={CalendarCheck} label="Sessions done" value={completedSessions.length} />
        <Stat icon={Clock} label="Upcoming" value={upcomingSessions.length} />
        <Stat icon={BookOpen} label="Submitted" value={`${submittedCount}/${assignments.length}`} />
        <Stat icon={CheckCircle} label="Reviewed" value={reviewedCount} />
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">To do</h2>
        {todo.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-5 text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" /> All caught up, nothing outstanding.
          </div>
        ) : (
          <div className="space-y-2">
            {todo.map((a) => {
              const overdue = a.dueDate ? new Date(a.dueDate).getTime() < now : false;
              return (
                <div key={a.id} className="bg-card border border-border rounded-xl p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{a.title}</p>
                    {a.dueDate && (
                      <p className={`text-xs flex items-center gap-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                        {overdue && <AlertCircle className="h-3 w-3" />}
                        {overdue ? "Overdue · " : "Due "}
                        {format(new Date(a.dueDate), "EEE, MMM d")}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 shrink-0">
                    Not submitted
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent lesson notes</h2>
        {recentNotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No lesson notes yet, they'll appear after completed sessions.</p>
        ) : (
          <div className="space-y-2">
            {recentNotes.map((s) => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1">
                  <FileText className="h-3.5 w-3.5" />
                  {format(new Date(s.scheduledAt), "EEE, MMM d")}
                  {s.topic ? ` · ${s.topic}` : ""}
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{s.notes}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
