import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useListUsers,
  useGetMySubmission,
  useSubmitAssignment,
  useListAssignmentSubmissions,
  useReviewSubmission,
  getListAssignmentsQueryKey,
  getGetMySubmissionQueryKey,
  getListAssignmentSubmissionsQueryKey,
  type AssignmentSubmission,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { BookOpen, Calendar, Trash2, Plus, CheckCircle, ChevronDown, ChevronUp, Paperclip, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileUploadButton, AttachmentList } from "@/components/attachments";

const createSchema = z.object({
  assignedTo: z.string().min(1, "Choose who this is for"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  subject: z.string().optional(),
});

const submitSchema = z.object({
  content: z.string().optional(),
});

// A due date is a calendar day. Send it as the end of that day in the
// tutor's time zone; sending the bare "YYYY-MM-DD" made it midnight UTC, which
// showed as the day before anywhere west of London.
function dueDateToIso(day: string): string | undefined {
  if (!day) return undefined;
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59).toISOString();
}

// Assignments saved before that fix are stored at exactly midnight UTC; read
// those as the calendar day that was picked rather than shifting them.
function dueDateForDisplay(iso: string): Date {
  const d = new Date(iso);
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) {
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  return d;
}

function StudentSubmissionPanel({ assignmentId, readOnly = false, forName }: {
  assignmentId: number;
  // A parent looking at their child's assignment sees the child's work and
  // the tutor's review, but doesn't submit on the child's behalf.
  readOnly?: boolean;
  forName?: string | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: existing } = useGetMySubmission(assignmentId);

  const submitMutation = useSubmitAssignment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySubmissionQueryKey(assignmentId) });
        toast({ title: existing ? "Submission updated!" : "Work submitted!" });
        setExpanded(false);
      },
      onError: () => toast({ title: "Failed to submit", variant: "destructive" }),
    },
  });

  const form = useForm<z.infer<typeof submitSchema>>({
    resolver: zodResolver(submitSchema),
    defaultValues: { content: existing?.content ?? "" },
    values: { content: existing?.content ?? "" },
  });

  const onSubmit = (vals: z.infer<typeof submitSchema>) => submitMutation.mutate({ id: assignmentId, data: { content: vals.content ?? "" } });

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
          ) : readOnly ? (
            <span className="text-muted-foreground">{forName ? `${forName} hasn't` : "Not"} submitted work yet</span>
          ) : (
            <span className="text-muted-foreground">Submit your work <span className="font-normal">(optional)</span></span>
          )}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {existing && (existing.reviewedAt || existing.tutorComment) && (
        <div className="mt-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-3">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Reviewed by your tutor
          </p>
          {existing.tutorComment && (
            <p className="text-sm text-foreground mt-1.5 whitespace-pre-wrap">{existing.tutorComment}</p>
          )}
        </div>
      )}

      {expanded && readOnly && (
        <div className="mt-3 space-y-4">
          {existing?.content ? (
            <p className="text-sm whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 rounded-xl p-3">{existing.content}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No written note.</p>
          )}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Attached files</p>
            <AttachmentList assignmentId={assignmentId} emptyText="No files attached." />
          </div>
        </div>
      )}

      {expanded && !readOnly && (
        <div className="mt-3 space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="content" render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Add a note for your tutor (optional)…"
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

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attached files</p>
              <FileUploadButton assignmentId={assignmentId} label="Attach a file" />
            </div>
            <AttachmentList assignmentId={assignmentId} canDelete emptyText="No files attached yet." />
          </div>
        </div>
      )}
    </div>
  );
}


function AssignmentSubmissionReview({ assignmentId }: { assignmentId: number }) {
  const { data: submissions = [] } = useListAssignmentSubmissions(assignmentId);

  return (
    <div className="mt-4 border-t pt-3 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Submission &amp; files</p>
      <AttachmentList assignmentId={assignmentId} showUploader emptyText="No files submitted yet." />
      {submissions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No written submission yet.</p>
      ) : (
        submissions.map((s) => <SubmissionReviewRow key={s.id} sub={s} assignmentId={assignmentId} />)
      )}
    </div>
  );
}

function SubmissionReviewRow({ sub, assignmentId }: { sub: AssignmentSubmission; assignmentId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState(sub.tutorComment ?? "");

  const review = useReviewSubmission({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssignmentSubmissionsQueryKey(assignmentId) });
        toast({ title: "Review saved" });
      },
    },
  });

  return (
    <div className="bg-muted/40 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{sub.studentName}</p>
        {sub.reviewedAt ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Reviewed</span>
        ) : (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Awaiting review</span>
        )}
      </div>
      {sub.content ? (
        <p className="text-sm text-foreground whitespace-pre-wrap">{sub.content}</p>
      ) : (
        <p className="text-xs text-muted-foreground italic">No note, see attached files.</p>
      )}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave feedback for the student…"
        className="rounded-xl min-h-[70px] text-sm bg-background"
      />
      <Button size="sm" className="rounded-lg" disabled={review.isPending} onClick={() => review.mutate({ id: sub.id, data: { comment } })}>
        {review.isPending ? "Saving…" : sub.reviewedAt ? "Update feedback" : "Save & mark reviewed"}
      </Button>
    </div>
  );
}

export default function AssignmentsPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const isParent = user?.role === "parent";
  const { data: assignments, isLoading } = useListAssignments();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMutation = useCreateAssignment();
  const deleteMutation = useDeleteAssignment();
  const [isOpen, setIsOpen] = useState(false);

  const { data: users } = useListUsers();
  const recipients = (users ?? []).filter((u) => u.role === "student" || u.role === "parent");
  const recipientLabel = (u: { firstName?: string | null; lastName?: string | null; username?: string | null }) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "User";

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { assignedTo: "", title: "", description: "", subject: "", dueDate: "" },
  });

  const onSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate({ data: { ...values, dueDate: dueDateToIso(values.dueDate ?? "") } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
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
        queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
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
                <DialogDescription>Assign to one student or parent. Only that person, and any parent linked to them, will see it.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                  <FormField control={form.control} name="assignedTo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign to</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Choose a student or parent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {recipients.length === 0 && (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">No students or parents yet</div>
                          )}
                          {([["student", "Students"], ["parent", "Parents"]] as const).map(([role, heading]) => {
                            const group = recipients.filter((u) => u.role === role);
                            if (group.length === 0) return null;
                            return (
                              <SelectGroup key={role}>
                                <SelectLabel>{heading}</SelectLabel>
                                {group.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>{recipientLabel(u)}</SelectItem>
                                ))}
                              </SelectGroup>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
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

      {!isTutor && (
        <Card className="border-none shadow-sm rounded-2xl">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Paperclip className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Send a file to your tutor</p>
                <p className="text-xs text-muted-foreground">Share work that isn't tied to a specific assignment.</p>
              </div>
            </div>
            <FileUploadButton label="Choose a file" />
          </CardContent>
        </Card>
      )}

      {isTutor && (
        <Card className="border-none shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Files sent to you
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AttachmentList directOnly showUploader emptyText="No files sent to you yet." />
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No assignments yet."
          description={isTutor ? "Post your first assignment above." : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sorted.map(assignment => (
            <Card key={assignment.id} className="border-none shadow-md hover:shadow-lg transition-shadow rounded-2xl overflow-hidden group">
              <CardHeader className="bg-slate-50 dark:bg-slate-900 border-b px-6 pt-5 pb-4 relative">
                {isTutor && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-4 right-4 h-8 w-8 text-muted-foreground [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:text-destructive"
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
                {(isTutor || isParent) && assignment.assignedToName && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    <User className="h-3 w-3" /> For {assignment.assignedToName}
                  </p>
                )}
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
                    Due: {format(dueDateForDisplay(assignment.dueDate), "EEE, MMM d, yyyy")}
                  </div>
                )}

                {/* Tutor: the student's submission (text + files) and review */}
                {isTutor && <AssignmentSubmissionReview assignmentId={assignment.id} />}

                {/* Student submission panel */}
                {!isTutor && (
                  <StudentSubmissionPanel
                    assignmentId={assignment.id}
                    readOnly={assignment.assignedTo !== user?.id}
                    forName={assignment.assignedToName}
                  />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
