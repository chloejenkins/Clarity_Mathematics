import { useListSessions, getListSessionsQueryKey, type TutoringSession } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { ArrowRight, CheckCircle2, ClipboardCheck, UserX, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Whether a booked session's time is over, so the tutor should say whether it happened. */
export function needsCheck(s: Pick<TutoringSession, "status" | "scheduledAt" | "durationMinutes">, now = Date.now()) {
  const ends = new Date(s.scheduledAt).getTime() + (s.durationMinutes ?? 60) * 60_000;
  return s.status === "approved" && ends <= now;
}

/** The tutor's booked sessions that have ended but haven't been marked yet, oldest first. */
export function usePastSessionsToCheck() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const { data } = useListSessions(undefined, {
    query: { queryKey: getListSessionsQueryKey(), enabled: isTutor, refetchInterval: 60_000 },
  });
  if (!isTutor) return [];
  return (data ?? [])
    .filter((s) => needsCheck(s))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
}

/** App-wide reminder for the tutor. Hidden on the Schedule page, which shows the list itself. */
export function PastSessionsBanner() {
  const [location] = useLocation();
  const toCheck = usePastSessionsToCheck();
  if (toCheck.length === 0 || location === "/") return null;

  const text =
    toCheck.length === 1
      ? `Did your session with ${toCheck[0].studentName ?? "your student"} on ${format(new Date(toCheck[0].scheduledAt), "MMM d")} happen?`
      : `${toCheck.length} past sessions need checking: did they happen?`;

  return (
    <Link
      href="/"
      className="flex items-center gap-3 rounded-xl border px-4 py-3 mb-5 text-sm font-medium hover:shadow-sm transition-shadow bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
    >
      <ClipboardCheck className="h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
        Review <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

/** The tutor's to-do list of ended sessions, each settled with one click. */
export function PastSessionsCheck({
  sessions,
  onMark,
  busy,
}: {
  sessions: TutoringSession[];
  onMark: (id: number, status: "completed" | "cancelled", noShow?: boolean) => void;
  busy?: boolean;
}) {
  if (sessions.length === 0) return null;
  return (
    <section>
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-2">
        <ClipboardCheck className="h-4 w-4" /> Did these happen? ({sessions.length})
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        "Student didn't show" charges the 50% late-cancellation fee. "It was cancelled" has no charge.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sessions.map((s) => {
          const d = new Date(s.scheduledAt);
          return (
            <Card key={s.id} className="border border-amber-200 dark:border-amber-900/50 shadow-sm rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm">{s.studentName} · {format(d, "EEE, MMM d, h:mm a")}</p>
                  <p className="text-xs text-muted-foreground">{s.durationMinutes} min{s.topic ? ` · ${s.topic}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="flex-1 rounded-xl gap-1.5" disabled={busy} onClick={() => onMark(s.id, "completed")}>
                    <CheckCircle2 className="h-4 w-4" /> It happened
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl gap-1.5"
                    disabled={busy}
                    onClick={() => onMark(s.id, "cancelled", true)}
                  >
                    <UserX className="h-4 w-4" /> Student didn't show
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-xl gap-1.5"
                    disabled={busy}
                    onClick={() => onMark(s.id, "cancelled")}
                  >
                    <XCircle className="h-4 w-4" /> It was cancelled
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
