import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Link } from "wouter";
import { CalendarClock, Clock, ArrowRight } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

interface SessionLite {
  id: number;
  scheduledAt: string;
  durationMinutes: number;
  topic: string | null;
  status: string;
  studentName?: string;
}

const DAY_MIN = 24 * 60;
const HOUR_MIN = 60;

/**
 * In-app reminder for the next upcoming session, shown to students and parents.
 * Surfaces once a session is within 24 hours, and turns urgent within 1 hour.
 */
export function SessionReminderBanner() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const isStudent = user?.role === "student";

  const { data: sessions } = useQuery({
    queryKey: ["/api/sessions"],
    queryFn: () => customFetch<SessionLite[]>("/api/sessions"),
    refetchInterval: 60_000, // re-check every minute so the countdown stays fresh
    retry: false,
    enabled: isParent || isStudent,
  });

  if (!sessions || !(isParent || isStudent)) return null;

  const now = Date.now();
  const next = sessions
    .filter((s) => s.status !== "cancelled" && s.status !== "completed")
    .map((s) => ({ ...s, t: new Date(s.scheduledAt).getTime() }))
    .filter((s) => s.t > now)
    .sort((a, b) => a.t - b.t)[0];

  if (!next) return null;

  const minsUntil = Math.round((next.t - now) / 60_000);
  if (minsUntil > DAY_MIN) return null; // only remind within 24 hours

  const date = new Date(next.t);
  const time = format(date, "h:mm a");
  const whose = isParent && next.studentName ? `${next.studentName.split(" ")[0]}'s ` : "";
  const urgent = minsUntil <= HOUR_MIN;

  let text: string;
  if (urgent) {
    const label = minsUntil <= 1 ? "now" : `in ${minsUntil} min`;
    text = `${whose}session ${label} — ${next.topic || "Tutoring"} at ${time}`;
  } else {
    const rel = isTomorrow(date) ? "tomorrow" : isToday(date) ? "today" : format(date, "EEE");
    text = `Reminder: ${whose}session ${rel} at ${time}${next.topic ? ` (${next.topic})` : ""}`;
  }

  const cls = urgent
    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
    : "bg-primary/5 border-primary/25 text-foreground";

  return (
    <Link
      href="/"
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-5 text-sm font-medium hover:shadow-sm transition-shadow ${cls}`}
    >
      {urgent ? <Clock className="h-4 w-4 shrink-0" /> : <CalendarClock className="h-4 w-4 shrink-0" />}
      <span className="flex-1">{text}</span>
      <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
        Schedule <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
