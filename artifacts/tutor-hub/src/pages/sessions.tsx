import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListSessions, useUpdateSession, useDeleteSession, customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  Users,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Slot = {
  id: number;
  startsAt: string;
  durationMinutes: number;
  topic: string | null;
  isBooked: string;
  bookedByStudentId: string | null;
  sessionId: number | null;
};

function formatDay(date: Date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isThisWeek(date)) return format(date, "EEEE");
  return format(date, "EEE, MMM d");
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-800 border-amber-200",
    approved:  "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${styles[status] ?? "bg-slate-100 text-slate-700"}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Tutor: Add Availability Slots ───────────────────────────────────────────
function AddSlotsDialog({ onAdded }: { onAdded: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [times, setTimes] = useState<string[]>([""]);
  const [duration, setDuration] = useState("60");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);

  const addTimeField = () => setTimes(t => [...t, ""]);
  const removeTimeField = (i: number) => setTimes(t => t.filter((_, idx) => idx !== i));
  const updateTime = (i: number, val: string) => setTimes(t => t.map((v, idx) => idx === i ? val : v));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validTimes = times.filter(t => t.trim());
    if (!date || validTimes.length === 0) {
      toast({ title: "Pick a date and at least one time", variant: "destructive" });
      return;
    }
    setLoading(true);
    const slots = validTimes.map(t => ({
      startsAt: new Date(`${date}T${t}`).toISOString(),
      durationMinutes: Number(duration),
      topic: topic.trim() || undefined,
    }));
    try {
      const res = await fetch(`${BASE}/api/availability`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slots),
      });
      if (!res.ok) throw new Error();
      toast({ title: `${slots.length} slot${slots.length > 1 ? "s" : ""} added!` });
      setOpen(false);
      setDate(""); setTimes([""]); setTopic("");
      onAdded();
    } catch {
      toast({ title: "Failed to add slots", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2 rounded-xl shadow-md">
          <Plus className="h-5 w-5" /> Add Available Times
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add Availability</DialogTitle>
          <DialogDescription>Students will be able to book these times directly.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={format(new Date(), "yyyy-MM-dd")}
              className="rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Time slots on this date</Label>
            {times.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  type="time"
                  value={t}
                  onChange={e => updateTime(i, e.target.value)}
                  className="rounded-xl flex-1"
                  required
                />
                {times.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeTimeField(i)} className="shrink-0 text-muted-foreground hover:text-destructive">
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addTimeField} className="rounded-xl gap-1 text-xs">
              <Plus className="h-3.5 w-3.5" /> Add another time
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Topic <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                placeholder="e.g. Algebra"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : "Save Availability"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Student: Book a Slot ─────────────────────────────────────────────────────
function BookSlotDialog({ slot, onBooked }: { slot: Slot; onBooked: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(slot.topic ?? "");
  const [loading, setLoading] = useState(false);
  const date = new Date(slot.startsAt);

  const handleBook = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/availability/${slot.id}/book`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() || undefined }),
      });
      if (res.status === 409) { toast({ title: "This slot was just booked by someone else", variant: "destructive" }); return; }
      if (!res.ok) throw new Error();
      toast({ title: "Session booked! It's confirmed." });
      setOpen(false);
      onBooked();
    } catch {
      toast({ title: "Failed to book session", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl w-full">Book This Time</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Confirm Your Booking</DialogTitle>
          <DialogDescription>This session is auto-confirmed once you book.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-base text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              {formatDay(date)}, {format(date, "MMMM d")}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" /> {format(date, "h:mm a")} · {slot.durationMinutes} min
            </div>
            {slot.topic && <p className="text-muted-foreground">Topic: {slot.topic}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>What do you want to work on? <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
            <Input
              placeholder="e.g. Homework problem #5, quadratic equations…"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <Button className="w-full rounded-xl" onClick={handleBook} disabled={loading}>
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Booking…</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Confirm Booking</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function RescheduleDialog({ session }: { session: { id: number; scheduledAt: string } }) {
  const [open, setOpen] = useState(false);
  const [dt, setDt] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const reschedule = useMutation({
    mutationFn: () =>
      customFetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledAt: new Date(dt).toISOString() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({ title: "Session rescheduled" });
      setOpen(false);
    },
    onError: () => toast({ title: "Couldn't reschedule", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setDt(toLocalInput(session.scheduledAt)); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="flex-1 rounded-xl">Reschedule</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule session</DialogTitle>
          <DialogDescription>Pick a new date and time.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Label>New date &amp; time</Label>
          <Input type="datetime-local" value={dt} onChange={(e) => setDt(e.target.value)} className="rounded-xl" />
          <Button className="w-full rounded-xl" disabled={!dt || reschedule.isPending} onClick={() => reschedule.mutate()}>
            {reschedule.isPending ? "Saving…" : "Confirm new time"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SchedulePage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateMutation = useUpdateSession();
  const deleteMutation = useDeleteSession();

  // Availability slots
  const { data: slots = [], refetch: refetchSlots } = useQuery<Slot[]>({
    queryKey: ["/api/availability"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/availability`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
    refetchInterval: 10000,
  });

  // Confirmed sessions (from bookings)
  const { data: sessions = [], isLoading: sessionsLoading } = useListSessions(
    isTutor ? undefined : { studentId: user?.id }
  );

  const deleteSlot = async (id: number) => {
    if (!confirm("Remove this time slot?")) return;
    try {
      await fetch(`${BASE}/api/availability/${id}`, { method: "DELETE", credentials: "include" });
      refetchSlots();
      toast({ title: "Slot removed" });
    } catch {
      toast({ title: "Failed to remove slot", variant: "destructive" });
    }
  };

  const handleSessionStatus = (id: number, status: "completed" | "cancelled") => {
    updateMutation.mutate({ id, data: { status } }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        const cancellation = (res as { cancellation?: { policy: string; feeOwed: number; refundOwed: number } })?.cancellation;
        if (status === "cancelled" && cancellation) {
          const { policy, feeOwed, refundOwed } = cancellation;
          let desc =
            policy === "tutor_cancel"
              ? "Full refund — the student owes nothing."
              : policy === "full_refund"
                ? "Cancelled more than 24h ahead — no charge."
                : feeOwed
                  ? `Within 24h — a 50% fee ($${feeOwed}) applies.`
                  : "Within 24h — 50% fee applies.";
          if (refundOwed) desc += ` Refund $${refundOwed} to the student.`;
          toast({ title: "Session cancelled", description: desc });
        } else {
          toast({ title: `Session marked as ${status}` });
        }
      },
    });
  };

  const unbooked = slots.filter(s => s.isBooked === "false");
  const booked   = slots.filter(s => s.isBooked === "true");

  const upcomingSessions = [...sessions].filter(s => s.status === "approved" || s.status === "pending")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const pastSessions = [...sessions].filter(s => s.status === "completed" || s.status === "cancelled")
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" /> Schedule
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isTutor
              ? "Post your available times — students book directly, no back and forth."
              : "Pick from available times below. Bookings are instantly confirmed."}
          </p>
        </div>
        {isTutor && <AddSlotsDialog onAdded={refetchSlots} />}
      </div>

      {isTutor ? (
        /* ── TUTOR VIEW ── */
        <div className="space-y-8">
          {/* Unbooked slots */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" /> Open Slots ({unbooked.length})
            </h2>
            {unbooked.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-2xl text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No open slots.</p>
                <p className="text-sm mt-1">Add your available times so students can book.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {unbooked.map(slot => {
                  const d = new Date(slot.startsAt);
                  return (
                    <Card key={slot.id} className="border border-border rounded-2xl shadow-sm group hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-semibold text-sm">{formatDay(d)}, {format(d, "MMM d")}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" /> {format(d, "h:mm a")} · {slot.durationMinutes} min
                          </p>
                          {slot.topic && <p className="text-xs text-muted-foreground truncate">{slot.topic}</p>}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive shrink-0 transition-opacity"
                          onClick={() => deleteSlot(slot.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Booked sessions */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" /> Booked Sessions ({upcomingSessions.length})
            </h2>
            {sessionsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
              </div>
            ) : upcomingSessions.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No sessions booked yet" compact />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingSessions.map(session => {
                  const d = new Date(session.scheduledAt);
                  return (
                    <Card key={session.id} className="border-none shadow-md rounded-2xl overflow-hidden relative">
                      <div className="absolute left-0 top-0 w-1 h-full bg-primary" />
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex justify-between items-center">
                          <StatusPill status={session.status} />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this session?")) {
                                deleteMutation.mutate({ id: session.id }, {
                                  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sessions"] })
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <CardTitle className="text-lg font-bold mt-1">{formatDay(d)}, {format(d, "MMM d")}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Clock className="h-3.5 w-3.5 text-primary" /> {format(d, "h:mm a")} · {session.durationMinutes} min
                        </p>
                      </CardHeader>
                      <CardContent className="px-5 pb-4 space-y-3">
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-sm">
                          <p className="font-semibold">{session.studentName}</p>
                          {session.topic && <p className="text-muted-foreground text-xs mt-0.5">{session.topic}</p>}
                        </div>
                        {session.status === "approved" && (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="flex-1 rounded-xl" onClick={() => handleSessionStatus(session.id, "completed")}>
                                Mark Completed
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleSessionStatus(session.id, "cancelled")}>
                                Cancel
                              </Button>
                            </div>
                            <div className="flex">
                              <RescheduleDialog session={{ id: session.id, scheduledAt: session.scheduledAt }} />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past sessions */}
          {pastSessions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Past Sessions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pastSessions.slice(0, 6).map(session => {
                  const d = new Date(session.scheduledAt);
                  return (
                    <Card key={session.id} className="border shadow-sm rounded-2xl opacity-60">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{session.studentName} · {format(d, "MMM d, h:mm a")}</p>
                          <p className="text-xs text-muted-foreground">{session.durationMinutes} min {session.topic ? `· ${session.topic}` : ""}</p>
                        </div>
                        <StatusPill status={session.status} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      ) : (
        /* ── STUDENT VIEW ── */
        <div className="space-y-8">
          {/* Available slots to book */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" /> Available Times
            </h2>
            {unbooked.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-2xl text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No times available right now.</p>
                <p className="text-sm mt-1">Check back soon — your tutor will add new slots.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {unbooked.map(slot => {
                  const d = new Date(slot.startsAt);
                  return (
                    <Card key={slot.id} className="border-none shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="bg-primary/5 border-b border-border/50 px-5 pt-4 pb-3">
                        <p className="font-bold text-base">{formatDay(d)}</p>
                        <p className="text-sm font-semibold text-primary">{format(d, "MMMM d, yyyy")}</p>
                      </div>
                      <CardContent className="px-5 py-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-foreground">{format(d, "h:mm a")}</span>
                          <span>· {slot.durationMinutes} min</span>
                        </div>
                        {slot.topic && (
                          <p className="text-xs bg-primary/5 text-primary font-medium px-2.5 py-1 rounded-lg w-fit">
                            {slot.topic}
                          </p>
                        )}
                        <BookSlotDialog slot={slot} onBooked={() => {
                          refetchSlots();
                          queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
                        }} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Student's booked sessions */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> My Sessions
            </h2>
            {sessionsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
              </div>
            ) : upcomingSessions.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="No sessions booked yet" description="Pick a time above to book your first session." compact />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingSessions.map(session => {
                  const d = new Date(session.scheduledAt);
                  return (
                    <Card key={session.id} className="border-none shadow-md rounded-2xl overflow-hidden relative">
                      <div className="absolute left-0 top-0 w-1 h-full bg-emerald-500" />
                      <CardContent className="px-5 py-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <StatusPill status={session.status} />
                          <span className="text-xs text-muted-foreground">{format(d, "MMM d")}</span>
                        </div>
                        <p className="font-bold text-base">{formatDay(d)}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {format(d, "h:mm a")} · {session.durationMinutes} min
                        </p>
                        {session.topic && <p className="text-xs text-muted-foreground">{session.topic}</p>}
                        {session.status === "approved" && (
                          <div className="space-y-2 mt-2">
                            <div className="flex">
                              <RescheduleDialog session={{ id: session.id, scheduledAt: session.scheduledAt }} />
                            </div>
                            <Button size="sm" variant="outline" className="w-full rounded-xl text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => handleSessionStatus(session.id, "cancelled")}>
                              Cancel Session
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past */}
          {pastSessions.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Past Sessions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pastSessions.slice(0, 4).map(session => {
                  const d = new Date(session.scheduledAt);
                  return (
                    <Card key={session.id} className="border shadow-sm rounded-2xl opacity-60">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{format(d, "EEE, MMM d")} · {format(d, "h:mm a")}</p>
                          <p className="text-xs text-muted-foreground">{session.durationMinutes} min {session.topic ? `· ${session.topic}` : ""}</p>
                        </div>
                        <StatusPill status={session.status} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
