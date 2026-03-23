import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { useListAssignments, useCreateAssignment, useDeleteAssignment } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { BookOpen, Calendar, Trash2, Plus, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  subject: z.string().optional(),
});

const submitSchema = z.object({
  content: z.string().min(1, "Write something before submitting"),
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function StudentSubmissionPanel({ assignmentId }: { assignmentId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: existing } = useQuery({
    queryKey: [`/api/assignments/${assignmentId}/my-submission`],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/assignments/${assignmentId}/my-submission`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json() as Promise<{ id: number; content: string; submittedAt: string } | null>;
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`${BASE}/api/assignments/${assignmentId}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Submission failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/assignments/${assignmentId}/my-submission`] });
      toast({ title: existing ? "Submission updated!" : "Work submitted!" });
      setExpanded(false);
    },
    onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
  });

  const form = useForm<z.infer<typeof submitSchema>>({
    resolver: zodResolver(submitSchema),
    defaultValues: { content: existing?.content ?? "" },
    values: { content: existing?.content ?? "" },
  });

  const onSubmit = (vals: z.infer<typeof submitSchema>) => submitMutation.mutate(vals.content);

  return (
    <div className="mt-4 border-t pt-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-sm font-semibold text-left gap-2"
      >
        <span className="flex items-center gap-2">
          {existing ? (
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          ) : (
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          )}
          {existing ? (
            <span className="text-emerald-700">
              Submitted · {format(new Date(existing.submittedAt), "MMM d, h:mm a")}
            </span>
          ) : (
            <span className="text-muted-foreground">Submit your work <span className="font-normal">(optional)</span></span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-3 space-y-3">
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder="Write your answer, notes, or attach a description of your work…"
                    className="rounded-xl min-h-[100px] resize-none text-sm"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="rounded-xl" disabled={submitMutation.isPending}>
                {submitMutation.isPending ? "Saving…" : existing ? "Update Submission" : "Submit"}
              </Button>
              <Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={() => setExpanded(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const { data: assignments, isLoading } = useListAssignments();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateAssignment();
  const deleteMutation = useDeleteAssignment();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: "", description: "", subject: "", dueDate: "" },
  });

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
        setIsOpen(false);
        form.reset();
        toast({ title: "Assignment posted!" });
      },
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this assignment?")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
        toast({ title: "Assignment deleted" });
      },
    });
  };

  const sorted = [...(assignments ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" /> Assignments
          </h1>
          <p className="text-muted-foreground mt-1">
            {isTutor
              ? "Post homework and practice materials for your students."
              : "Your homework and practice materials. Submit your work directly here."}
          </p>
        </div>

        {isTutor && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl shadow-md gap-2">
                <Plus className="h-5 w-5" /> New Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Post New Assignment</DialogTitle>
                <DialogDescription>Students will see this immediately after you post it.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Chapter 4 Practice Problems" className="rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="subject" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Subject <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl><Input placeholder="e.g. Algebra" className="rounded-xl" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl><Input type="date" className="rounded-xl" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Instructions <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <Textarea placeholder="Describe what students should do…" className="rounded-xl min-h-[100px]" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full rounded-xl mt-2" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Posting…" : "Post Assignment"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed rounded-3xl text-muted-foreground">
          <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No assignments yet.</p>
          {isTutor && <p className="text-sm mt-1">Post your first assignment above.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sorted.map(assignment => (
            <Card key={assignment.id} className="border-none shadow-md hover:shadow-lg transition-shadow rounded-2xl overflow-hidden group">
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b px-6 pt-5 pb-4 relative">
                {isTutor && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                    onClick={() => handleDelete(assignment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {assignment.subject && (
                    <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-md uppercase tracking-wider">
                      {assignment.subject}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Posted {format(new Date(assignment.createdAt), "MMM d")}
                  </span>
                </div>
                <CardTitle className="text-xl font-bold leading-tight pr-6">{assignment.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {assignment.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {assignment.description}
                  </p>
                )}
                {assignment.dueDate && (
                  <div className="mt-3 inline-flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-900/50 text-sm font-semibold">
                    <Calendar className="h-4 w-4" />
                    Due: {format(new Date(assignment.dueDate), "EEE, MMM d, yyyy")}
                  </div>
                )}

                {/* Student submission panel */}
                {!isTutor && (
                  <StudentSubmissionPanel assignmentId={assignment.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
