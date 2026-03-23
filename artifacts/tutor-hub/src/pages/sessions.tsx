import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListSessions, useCreateSession, useUpdateSession, useDeleteSession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isToday, isTomorrow, isThisWeek } from "date-fns";
import { CalendarDays, Clock, CheckCircle2, XCircle, Trash2, Plus, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  scheduledAt: z.string().min(1, "Date and time required"),
  durationMinutes: z.coerce.number().min(15).max(180),
  topic: z.string().optional(),
  notes: z.string().optional(),
});

type SessionStatus = "pending" | "approved" | "cancelled" | "completed";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-800 border-amber-200",
    approved:  "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-red-100 text-red-800 border-red-200",
    completed: "bg-blue-100 text-blue-800 border-blue-200",
  };
  return (
    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${styles[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status.toUpperCase()}
    </span>
  );
}

function formatDay(date: Date) {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  if (isThisWeek(date)) return format(date, "EEEE");
  return format(date, "EEE, MMM d");
}

export default function SchedulePage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const { data: sessions, isLoading } = useListSessions(
    isTutor ? undefined : { studentId: user?.id }
  );

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateSession();
  const updateMutation = useUpdateSession();
  const deleteMutation = useDeleteSession();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { durationMinutes: 60, topic: "", notes: "" },
  });

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Session request sent!" });
      },
      onError: () => toast({ title: "Error sending request", variant: "destructive" }),
    });
  };

  const handleStatus = (id: number, status: SessionStatus) => {
    updateMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        toast({ title: `Session ${status}` });
      },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this session?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
        toast({ title: "Session deleted" });
      },
    });
  };

  const sorted = [...(sessions ?? [])].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );

  const upcoming = sorted.filter(s => s.status === "pending" || s.status === "approved");
  const past     = sorted.filter(s => s.status === "cancelled" || s.status === "completed");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            Schedule
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTutor ? "All student session requests and upcoming appointments." : "Your tutoring appointments."}
          </p>
        </div>

        {!isTutor && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl shadow-md hover-elevate gap-2">
                <Plus className="h-5 w-5" /> Request Session
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Request a Tutoring Session</DialogTitle>
                <DialogDescription>Choose a date and time that works for you.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                  <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date & Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" className="rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={String(field.value)}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                          <SelectItem value="90">1.5 hours</SelectItem>
                          <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="topic" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Topic <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Fractions, Algebra, Geometry…" className="rounded-xl" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea placeholder="Anything specific you'd like help with…" className="rounded-xl min-h-[80px]" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full rounded-xl mt-2" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Sending…" : "Send Request"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Pending requests banner for tutor */}
      {isTutor && upcoming.filter(s => s.status === "pending").length > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-semibold">
            {upcoming.filter(s => s.status === "pending").length} pending session request{upcoming.filter(s => s.status === "pending").length !== 1 ? "s" : ""} waiting for your approval.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-36 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-10">
          {/* Upcoming */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
              Upcoming & Pending
            </h2>
            {upcoming.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-2xl text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No upcoming sessions.</p>
                {!isTutor && <p className="text-sm mt-1">Use "Request Session" to schedule one.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcoming.map(session => {
                  const date = new Date(session.scheduledAt);
                  const isPending = session.status === "pending";
                  return (
                    <Card key={session.id} className={`border-none shadow-md rounded-2xl overflow-hidden relative transition-shadow hover:shadow-lg ${isPending ? "ring-2 ring-amber-300 dark:ring-amber-700" : ""}`}>
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${isPending ? "bg-amber-400" : "bg-emerald-500"}`} />
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex justify-between items-start">
                          <StatusBadge status={session.status} />
                          {isTutor && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive -mt-1 -mr-1" onClick={() => handleDelete(session.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <CardTitle className="text-xl font-bold mt-2">{formatDay(date)}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-base text-foreground font-medium mt-0.5">
                          <Clock className="h-4 w-4 text-primary" />
                          {format(date, "h:mm a")} · {session.durationMinutes} min
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-5 pb-4 space-y-3">
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-sm">
                          {isTutor && (
                            <p className="font-semibold text-foreground">{session.studentName}</p>
                          )}
                          {session.topic && (
                            <p className="text-muted-foreground mt-0.5">Topic: {session.topic}</p>
                          )}
                          {session.notes && (
                            <p className="text-muted-foreground mt-0.5 border-t pt-1 mt-2">"{session.notes}"</p>
                          )}
                          {!session.topic && !session.notes && (
                            <p className="text-muted-foreground italic">No topic specified</p>
                          )}
                        </div>

                        {/* Tutor actions for pending */}
                        {isTutor && isPending && (
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 rounded-xl gap-1" onClick={() => handleStatus(session.id, "approved")}>
                              <CheckCircle2 className="h-4 w-4" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" className="flex-1 rounded-xl gap-1" onClick={() => handleStatus(session.id, "cancelled")}>
                              <XCircle className="h-4 w-4" /> Decline
                            </Button>
                          </div>
                        )}

                        {/* Tutor can mark approved sessions complete */}
                        {isTutor && session.status === "approved" && (
                          <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={() => handleStatus(session.id, "completed")}>
                            Mark Completed
                          </Button>
                        )}

                        {/* Student can cancel their own pending request */}
                        {!isTutor && isPending && (
                          <Button size="sm" variant="outline" className="w-full rounded-xl text-destructive border-destructive/50 hover:bg-destructive/5" onClick={() => handleStatus(session.id, "cancelled")}>
                            Cancel Request
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Past sessions */}
          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Past Sessions
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {past.map(session => {
                  const date = new Date(session.scheduledAt);
                  return (
                    <Card key={session.id} className="border-none shadow-sm rounded-2xl overflow-hidden opacity-70 relative">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${session.status === "completed" ? "bg-blue-400" : "bg-red-300"}`} />
                      <CardHeader className="pb-2 pt-4 px-5">
                        <div className="flex justify-between items-start">
                          <StatusBadge status={session.status} />
                          {isTutor && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive -mt-1 -mr-1" onClick={() => handleDelete(session.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <CardTitle className="text-lg font-bold mt-2">{format(date, "EEE, MMM d")}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-sm">
                          <Clock className="h-3.5 w-3.5" />
                          {format(date, "h:mm a")} · {session.durationMinutes} min
                          {isTutor && ` · ${session.studentName}`}
                        </CardDescription>
                      </CardHeader>
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
