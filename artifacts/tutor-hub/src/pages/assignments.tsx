import { useState, type ReactNode } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListAssignments,
  useCreateAssignment,
  useDeleteAssignment,
  useUpdateAssignment,
  useListUsers,
  useGetMySubmission,
  useSubmitAssignment,
  useListAssignmentSubmissions,
  useReviewSubmission,
  getListAssignmentsQueryKey,
  getGetMySubmissionQueryKey,
  getListAssignmentSubmissionsQueryKey,
  type Assignment,
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
import { differenceInCalendarDays, endOfDay, format } from "date-fns";
import { BookOpen, Calendar, Trash2, Plus, CheckCircle, MessageSquare, Paperclip, Pencil, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileUploadButton, FileDropZone, AttachmentList, useAttachments } from "@/components/attachments";

const createSchema = z.object({
  assignedTo: z.string().min(1, "Choose who this is for"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  subject: z.string().optional(),
});

const editSchema = createSchema.omit({ assignedTo: true });

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

// Where an assignment stands, from the point of view of the person doing it.
type Status = "todo" | "overdue" | "handedIn" | "reviewed";

function statusOf(a: Assignment, now = new Date()): Status {
  if (a.reviewed) return "reviewed";
  if (a.submitted) return "handedIn";
  if (a.dueDate && endOfDay(dueDateForDisplay(a.dueDate)) < now) return "overdue";
  return "todo";
}

const dueTime = (a: Assignment) => (a.dueDate ? dueDateForDisplay(a.dueDate).getTime() : Number.POSITIVE_INFINITY);
const soonestFirst = (a: Assignment, b: Assignment) => dueTime(a) - dueTime(b) || b.id - a.id;
const latestFirst = (a: Assignment, b: Assignment) =>
  (b.dueDate ? dueTime(b) : 0) - (a.dueDate ? dueTime(a) : 0) || b.id - a.id;

// "Due today", "Due tomorrow", "Due Tue, Nov 24" or "Was due Thu, Nov 12".
function dueLabel(a: Assignment, status: Status): string | null {
  if (!a.dueDate) return null;
  const day = dueDateForDisplay(a.dueDate);
  const diff = differenceInCalendarDays(day, new Date());
  const date = format(day, "EEE, MMM d");
  if (status === "overdue") return `Was due ${date}`;
  if (status === "todo" && diff === 0) return "Due today";
  if (status === "todo" && diff === 1) return "Due tomorrow";
  return `Due ${date}`;
}

const STATUS_STYLE: Record<Status, { className: string; family: string; tutor: string }> = {
  todo: { className: "bg-muted text-muted-foreground", family: "To do", tutor: "Not handed in" },
  overdue: { className: "bg-warning-soft text-warning", family: "Overdue", tutor: "Overdue" },
  handedIn: { className: "bg-info-soft text-info", family: "Handed in", tutor: "Needs review" },
  reviewed: { className: "bg-success-soft text-success", family: "Reviewed", tutor: "Reviewed" },
};

function StatusPill({ status, forTutor }: { status: Status; forTutor: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${s.className}`}>
      {forTutor ? s.tutor : s.family}
    </span>
  );
}

function firstName(name?: string | null) {
  return name?.split(" ")[0] || "They";
}

const handedInAt = (iso: string) => format(new Date(iso), "EEE, MMM d 'at' h:mm a");

// The student's note and files, as handed in. Shared by every view.
function HandedInWork({ assignmentId, content }: { assignmentId: number; content?: string | null }) {
  return (
    <div className="space-y-2">
      {content ? (
        <p className="text-sm whitespace-pre-wrap bg-muted rounded-xl px-3.5 py-2.5">{content}</p>
      ) : null}
      <AttachmentList assignmentId={assignmentId} from="family" emptyText={content ? undefined : "No note or files."} />
    </div>
  );
}

function FeedbackBox({ title, comment }: { title: string; comment: string }) {
  return (
    <div className="bg-success-soft rounded-xl px-3.5 py-3">
      <p className="text-xs font-semibold text-success flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" /> {title}
      </p>
      <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">{comment}</p>
    </div>
  );
}

// Student (or a parent doing it for a young child): add files and a note,
// then press one Hand in button. A parent looking at their child's work
// gets the same panel read-only.
function FamilySubmissionPanel({ assignment, readOnly }: { assignment: Assignment; readOnly: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const assignmentId = assignment.id;
  const { data: existing, isLoading } = useGetMySubmission(assignmentId);
  const { data: files } = useAttachments(assignmentId);
  const familyFiles = (files ?? []).filter((f) => f.uploaderRole !== "tutor");
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteValue = note ?? existing?.content ?? "";

  const submitMutation = useSubmitAssignment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMySubmissionQueryKey(assignmentId) });
        queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
        toast({ title: existing ? "Updated and handed in again" : "Work handed in!", description: "Your tutor can see it now." });
        setEditing(false);
        setNote(null);
      },
      onError: () => toast({ title: "Couldn't hand in your work", description: "Please try again.", variant: "destructive" }),
    },
  });

  if (isLoading) return <Skeleton className="h-16 rounded-xl" />;

  const feedback = existing?.tutorComment ? (
    <FeedbackBox title="Feedback from your tutor" comment={existing.tutorComment} />
  ) : null;

  if (readOnly) {
    if (!existing) {
      return <p className="text-sm text-muted-foreground">{firstName(assignment.assignedToName)} hasn't handed this in yet.</p>;
    }
    return (
      <div className="space-y-3">
        <HandedInLine at={existing.submittedAt} />
        {feedback}
        <HandedInWork assignmentId={assignmentId} content={existing.content} />
      </div>
    );
  }

  if (existing && !editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <HandedInLine at={existing.submittedAt} />
          <Button variant="ghost" size="sm" className="rounded-lg text-primary -mr-2 shrink-0" onClick={() => setEditing(true)}>
            Change
          </Button>
        </div>
        {feedback}
        <HandedInWork assignmentId={assignmentId} content={existing.content} />
      </div>
    );
  }

  const nothingYet = familyFiles.length === 0 && noteValue.trim() === "";
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold">{existing ? "Change your work" : "Hand in your work"}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Add photos or files of your working, and a note if you like, then press Hand in.</p>
      </div>
      {feedback}
      <FileDropZone assignmentId={assignmentId} />
      <AttachmentList assignmentId={assignmentId} from="family" canDelete />
      <Textarea
        value={noteValue}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note for your tutor (optional)…"
        className="rounded-xl min-h-[80px] resize-none text-sm"
      />
      <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
        {existing && (
          <Button type="button" variant="ghost" className="rounded-xl" onClick={() => { setEditing(false); setNote(null); }}>
            Cancel
          </Button>
        )}
        <Button
          type="button"
          className="rounded-xl sm:px-8"
          disabled={submitMutation.isPending || nothingYet}
          onClick={() => submitMutation.mutate({ id: assignmentId, data: { content: noteValue.trim() } })}
        >
          {submitMutation.isPending ? "Handing in…" : existing ? "Hand in again" : "Hand in"}
        </Button>
        {nothingYet && <p className="text-xs text-muted-foreground sm:ml-1">Add a file or a note first.</p>}
      </div>
    </div>
  );
}

function HandedInLine({ at, who }: { at: string; who?: string }) {
  return (
    <p className="text-sm font-semibold text-success flex items-center gap-1.5">
      <CheckCircle className="h-4 w-4 shrink-0" />
      <span>{who ? `${who} handed this in` : "Handed in"} <span className="font-normal text-muted-foreground">· {handedInAt(at)}</span></span>
    </p>
  );
}

// Tutor: what the student handed in, and a place to send feedback.
function TutorSubmissionPanel({ assignment }: { assignment: Assignment }) {
  const assignmentId = assignment.id;
  const { data: submissions, isLoading } = useListAssignmentSubmissions(assignmentId);
  const sub = submissions?.find((s) => s.studentId === assignment.assignedTo) ?? submissions?.[0];
  const name = firstName(assignment.assignedToName);

  if (isLoading) return <Skeleton className="h-16 rounded-xl" />;

  if (!sub) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{name} hasn't handed this in yet.</p>
        <AttachmentList assignmentId={assignmentId} from="family" />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <HandedInLine at={sub.submittedAt} who={name} />
      <HandedInWork assignmentId={assignmentId} content={sub.content} />
      <FeedbackEditor key={`${sub.id}-${sub.reviewedAt ?? ""}`} sub={sub} assignmentId={assignmentId} name={name} />
    </div>
  );
}

function FeedbackEditor({ sub, assignmentId, name }: { sub: AssignmentSubmission; assignmentId: number; name: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!sub.reviewedAt);
  const [comment, setComment] = useState(sub.tutorComment ?? "");

  const review = useReviewSubmission({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssignmentSubmissionsQueryKey(assignmentId) });
        queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
        toast({ title: "Feedback sent", description: `${name} can see it now.` });
      },
      onError: () => toast({ title: "Couldn't send feedback", variant: "destructive" }),
    },
  });

  if (!editing) {
    return (
      <div className="space-y-1">
        {sub.tutorComment ? (
          <FeedbackBox title="Your feedback" comment={sub.tutorComment} />
        ) : (
          <p className="text-sm text-muted-foreground">Marked as reviewed, no written feedback.</p>
        )}
        <Button variant="ghost" size="sm" className="rounded-lg text-primary -ml-2" onClick={() => setEditing(true)}>
          Edit feedback
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-sm font-semibold">Feedback for {name}</p>
      {sub.tutorComment && sub.reviewedAt == null && (
        <p className="text-xs text-muted-foreground">{name} changed their work after your last feedback.</p>
      )}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave feedback for the student…"
        className="rounded-xl min-h-[80px] text-sm"
      />
      <div className="flex items-center gap-2">
        <Button className="rounded-xl" disabled={review.isPending} onClick={() => review.mutate({ id: sub.id, data: { comment } })}>
          {review.isPending ? "Sending…" : comment.trim() ? "Send feedback" : "Mark as reviewed"}
        </Button>
        {sub.reviewedAt && (
          <Button variant="ghost" className="rounded-xl" onClick={() => { setEditing(false); setComment(sub.tutorComment ?? ""); }}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({ assignment, isTutor, showFor, readOnly, onDelete }: {
  assignment: Assignment;
  isTutor: boolean;
  showFor: boolean;
  readOnly: boolean;
  onDelete: (id: number) => void;
}) {
  const status = statusOf(assignment);
  const due = dueLabel(assignment, status);
  const meta = [showFor && assignment.assignedToName ? `For ${assignment.assignedToName}` : null, assignment.subject]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="rounded-xl overflow-hidden group">
      <div className="px-5 pt-5 pb-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {meta && <p className="text-xs text-muted-foreground mb-1">{meta}</p>}
            <h3 className="text-lg font-semibold leading-snug">{assignment.title}</h3>
            {due && (
              <p className={`text-sm mt-1 flex items-center gap-1.5 ${status === "overdue" ? "text-warning font-medium" : "text-muted-foreground"}`}>
                <Calendar className="h-3.5 w-3.5 shrink-0" /><span>{due}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isTutor && (
              <div className="flex [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <EditAssignmentDialog assignment={assignment} />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  title="Delete assignment"
                  onClick={() => onDelete(assignment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <StatusPill status={status} forTutor={isTutor} />
          </div>
        </div>

        {assignment.description && (
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mt-3">{assignment.description}</p>
        )}

        {isTutor ? (
          <div className="mt-3 space-y-2">
            <AttachmentList assignmentId={assignment.id} from="tutor" canDelete />
            <FileUploadButton assignmentId={assignment.id} label="Attach worksheet" quiet />
          </div>
        ) : (
          <WorksheetList assignmentId={assignment.id} />
        )}
      </div>

      <div className="border-t px-5 py-4 sm:px-6">
        {isTutor ? (
          <TutorSubmissionPanel assignment={assignment} />
        ) : (
          <FamilySubmissionPanel assignment={assignment} readOnly={readOnly} />
        )}
      </div>
    </Card>
  );
}

// Shown to the family only when the tutor attached something.
function WorksheetList({ assignmentId }: { assignmentId: number }) {
  const { data } = useAttachments(assignmentId);
  if (!data?.some((a) => a.uploaderRole === "tutor")) return null;
  return (
    <div className="mt-3">
      <p className="eyebrow mb-2 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" /> From your tutor
      </p>
      <AttachmentList assignmentId={assignmentId} from="tutor" />
    </div>
  );
}

function Section({ title, count, children, empty }: { title: string; count: number; children: ReactNode; empty?: string }) {
  if (count === 0 && !empty) return null;
  return (
    <section className="space-y-3">
      <h2 className="eyebrow flex items-center gap-2">
        {title} <span className="text-muted-foreground font-normal normal-case tracking-normal">{count}</span>
      </h2>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground bg-card rounded-xl px-5 py-4">{empty}</p>
      ) : (
        <div className="space-y-4">{children}</div>
      )}
    </section>
  );
}

// The tutor fixes a typo or moves the due date without losing the submission.
function EditAssignmentDialog({ assignment }: { assignment: Assignment }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const updateMutation = useUpdateAssignment();

  const current = () => ({
    title: assignment.title,
    subject: assignment.subject ?? "",
    description: assignment.description ?? "",
    dueDate: assignment.dueDate ? format(dueDateForDisplay(assignment.dueDate), "yyyy-MM-dd") : "",
  });
  const form = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: current(),
  });

  const onSubmit = (values: z.infer<typeof editSchema>) => {
    updateMutation.mutate(
      {
        id: assignment.id,
        data: {
          title: values.title,
          subject: values.subject?.trim() || null,
          description: values.description?.trim() || null,
          dueDate: dueDateToIso(values.dueDate ?? "") ?? null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
          setOpen(false);
          toast({ title: "Assignment updated" });
        },
        onError: () => toast({ title: "Failed to update assignment", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) form.reset(current()); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Edit assignment">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription>
            {assignment.assignedToName ? `For ${assignment.assignedToName}. ` : ""}Their submission and files stay as they are.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl><Input className="rounded-xl" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="subject" render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input className="rounded-xl" {...field} /></FormControl>
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
                <FormControl><Textarea className="rounded-xl min-h-[100px]" {...field} /></FormControl>
              </FormItem>
            )} />
            <Button type="submit" className="w-full rounded-xl mt-2" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
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
    if (!confirm("Delete this assignment? Any work handed in for it is deleted too.")) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
        toast({ title: "Assignment deleted" });
      },
    });
  };

  const all = assignments ?? [];
  const withStatus = (...s: Status[]) => all.filter((a) => s.includes(statusOf(a)));
  const card = (a: Assignment) => (
    <AssignmentCard
      key={a.id}
      assignment={a}
      isTutor={isTutor}
      showFor={isTutor || isParent}
      readOnly={a.assignedTo !== user?.id}
      onDelete={handleDelete}
    />
  );

  const toDo = withStatus("overdue", "todo").sort(soonestFirst);
  const needsReview = withStatus("handedIn").sort(soonestFirst);
  const reviewed = withStatus("reviewed").sort(latestFirst);
  const handedIn = withStatus("handedIn", "reviewed").sort(latestFirst);

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Assignments</h1>
          <p className="page-subtitle">
            {isTutor
              ? "Post homework, then review what your students hand in."
              : isParent
                ? "Homework from your tutor, and what's been handed in."
                : "Your homework. Add your work and press Hand in when you're done."}
          </p>
        </div>

        {isTutor && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="rounded-xl gap-2">
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

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : all.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No assignments yet."
          description={isTutor ? "Post your first assignment above." : undefined}
        />
      ) : isTutor ? (
        <>
          <Section title="Needs review" count={needsReview.length} empty="Nothing waiting for you. New work shows up here.">
            {needsReview.map(card)}
          </Section>
          <Section title="Waiting for work" count={toDo.length}>{toDo.map(card)}</Section>
          <Section title="Reviewed" count={reviewed.length}>{reviewed.map(card)}</Section>
        </>
      ) : (
        <>
          <Section title="To do" count={toDo.length} empty="All done. Nothing left to hand in.">
            {toDo.map(card)}
          </Section>
          <Section title="Handed in" count={handedIn.length}>{handedIn.map(card)}</Section>
        </>
      )}

      {isTutor ? (
        <Card className="rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="eyebrow flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Other files sent to you
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <AttachmentList directOnly showUploader emptyText="Files students send outside an assignment show up here." />
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-xl">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Paperclip className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Something else for your tutor?</p>
                <p className="text-xs text-muted-foreground">Send a file that isn't for one of the assignments above.</p>
              </div>
            </div>
            <FileUploadButton label="Send a file" />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
