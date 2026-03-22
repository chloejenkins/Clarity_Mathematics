import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListSessions, useCreateSession, useUpdateSession, useDeleteSession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarDays, Clock, CheckCircle2, XCircle, Trash2, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  scheduledAt: z.string().min(1, "Date and time required"),
  durationMinutes: z.coerce.number().min(15).max(180),
  topic: z.string().optional(),
  notes: z.string().optional(),
});

export default function SessionsPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const { data: sessions, isLoading } = useListSessions(isTutor ? undefined : { studentId: user?.id });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateSession();
  const updateMutation = useUpdateSession();
  const deleteMutation = useDeleteSession();

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      durationMinutes: 60,
      topic: "",
      notes: ""
    }
  });

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
        setIsCreateOpen(false);
        form.reset();
        toast({ title: "Session requested successfully!" });
      },
      onError: (err) => {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleStatusChange = (id: number, status: "approved" | "cancelled" | "completed") => {
    updateMutation.mutate({ id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
        toast({ title: `Session marked as ${status}` });
      }
    });
  };

  const handleDelete = (id: number) => {
    if(confirm("Are you sure you want to delete this session?")) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
          toast({ title: "Session deleted" });
        }
      });
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, string> = {
      pending: "bg-orange-100 text-orange-800 border-orange-200",
      approved: "bg-green-100 text-green-800 border-green-200",
      cancelled: "bg-red-100 text-red-800 border-red-200",
      completed: "bg-blue-100 text-blue-800 border-blue-200"
    };
    return <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${variants[status] || "bg-gray-100 text-gray-800"}`}>{status.toUpperCase()}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Tutoring Sessions</h1>
          <p className="text-muted-foreground">Manage your schedule and requests.</p>
        </div>
        
        {!isTutor && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl shadow-lg hover-elevate">Request Session</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Request a Session</DialogTitle>
                <DialogDescription>Pick a time and topic for your next session.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
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
                      <FormLabel>Duration (minutes)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value.toString()}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select duration" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="30">30 mins</SelectItem>
                          <SelectItem value="45">45 mins</SelectItem>
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
                      <FormLabel>Topic (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Algebra fractions" className="rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full rounded-xl mt-6" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Submitting..." : "Submit Request"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
           {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sessions?.sort((a,b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()).map((session) => (
            <Card key={session.id} className="border-none shadow-md hover:shadow-lg transition-shadow rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <CardHeader className="pb-3 pt-5 px-5">
                <div className="flex justify-between items-start mb-2">
                  <StatusBadge status={session.status} />
                  {isTutor && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive -mt-2 -mr-2" onClick={() => handleDelete(session.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <CardTitle className="text-xl font-bold">{format(new Date(session.scheduledAt), "EEEE, MMM d")}</CardTitle>
                <CardDescription className="text-foreground font-medium text-base mt-1 flex items-center gap-2">
                   <Clock className="h-4 w-4 text-primary" /> {format(new Date(session.scheduledAt), "h:mm a")} ({session.durationMinutes}m)
                </CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 mb-4">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">
                    {isTutor ? "Student" : "Topic"}
                  </p>
                  <p className="font-medium text-sm">
                    {isTutor ? session.studentName : (session.topic || "No topic specified")}
                  </p>
                  {isTutor && session.topic && (
                    <p className="text-sm mt-1 text-muted-foreground border-t pt-1 mt-2">Topic: {session.topic}</p>
                  )}
                </div>

                {isTutor && session.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 rounded-lg" onClick={() => handleStatusChange(session.id, 'approved')}>
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 rounded-lg" onClick={() => handleStatusChange(session.id, 'cancelled')}>
                      <XCircle className="mr-2 h-4 w-4" /> Decline
                    </Button>
                  </div>
                )}
                
                {isTutor && session.status === 'approved' && (
                  <Button size="sm" variant="outline" className="w-full rounded-lg" onClick={() => handleStatusChange(session.id, 'completed')}>
                    Mark Completed
                  </Button>
                )}

                {!isTutor && session.status === 'pending' && (
                   <Button size="sm" variant="outline" className="w-full rounded-lg text-destructive border-destructive hover:bg-destructive/10" onClick={() => handleStatusChange(session.id, 'cancelled')}>
                     Cancel Request
                   </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {sessions?.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
              <CalendarDays className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-30" />
              <h3 className="text-xl font-bold">No Sessions Found</h3>
              <p className="text-muted-foreground mt-2">You don't have any sessions scheduled yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
