import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { ClipboardList, User, UserPlus, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export interface ParentStudentLink {
  id: number;
  studentId: string | null;
  studentName: string | null;
  studentEmail: string | null;
  linked: boolean;
}

interface FeedbackRecord {
  id: number;
  studentId: string;
  content: string;
  period: string | null;
  updatedAt: string;
}

function errorMessage(e: unknown, fallback: string): string {
  const data = (e as { data?: { error?: string } })?.data;
  return data?.error ?? (e as Error)?.message ?? fallback;
}

export default function ParentFeedbackViewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: links = [] } = useQuery<ParentStudentLink[]>({
    queryKey: ["/api/parent-links"],
    queryFn: () => customFetch("/api/parent-links"),
    enabled: user?.role === "parent",
  });

  const unlink = useMutation({
    mutationFn: (id: number) => customFetch(`/api/parent-links/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/parent-links"] }),
  });

  // A parent acting as the family account (young child, no separate login)
  // may have feedback written for their own id.
  const { data: selfFeedback = [] } = useQuery<FeedbackRecord[]>({
    queryKey: ["/api/parent-feedback", user?.id],
    queryFn: () => customFetch(`/api/parent-feedback/${user?.id}`),
    enabled: user?.role === "parent" && !!user?.id,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Tutor Feedback
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Private notes your tutor has written about your child's progress.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="shrink-0 gap-2 rounded-full">
          <UserPlus className="h-4 w-4" /> Link a child
        </Button>
      </div>

      {selfFeedback.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <p className="font-semibold text-foreground">Your sessions</p>
          </div>
          <FeedbackCard feedback={selfFeedback[0]} />
        </div>
      )}

      {links.length === 0 && selfFeedback.length === 0 ? (
        <EmptyState
          icon={User}
          title="No child linked yet"
          description="Link your child's account to see their tutor feedback, schedule, and payments."
        />
      ) : (
        links.map((link) => (
          <LinkedStudentFeedback
            key={link.id}
            link={link}
            onUnlink={() => unlink.mutate(link.id)}
            unlinking={unlink.isPending}
          />
        ))
      )}

      <LinkChildDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

function LinkedStudentFeedback({
  link,
  onUnlink,
  unlinking,
}: {
  link: ParentStudentLink;
  onUnlink: () => void;
  unlinking: boolean;
}) {
  const { data: feedbackList = [], isLoading } = useQuery<FeedbackRecord[]>({
    queryKey: ["/api/parent-feedback", link.studentId],
    queryFn: () => customFetch(`/api/parent-feedback/${link.studentId}`),
    enabled: !!link.studentId,
  });

  const feedback = feedbackList[0] ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="font-semibold text-foreground truncate">{link.studentName ?? "Student"}</p>
          {link.studentEmail && (
            <span className="text-xs text-muted-foreground truncate">· {link.studentEmail}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          title="Unlink"
          disabled={unlinking}
          onClick={onUnlink}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {!link.linked ? (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-4 text-sm text-amber-800 dark:text-amber-200">
          This is a name only, it isn't connected to a real account yet, so no feedback, schedule, or
          payments will show. Unlink it and re-add your child by their email.
        </div>
      ) : isLoading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : !feedback ? (
        <EmptyState
          icon={ClipboardList}
          title="No feedback yet"
          description="Your tutor hasn't shared any feedback yet. Check back soon."
        />
      ) : (
        <FeedbackCard feedback={feedback} />
      )}
    </div>
  );
}

function FeedbackCard({ feedback }: { feedback: FeedbackRecord }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
      {feedback.period && (
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {feedback.period}
        </p>
      )}
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{feedback.content}</p>
      <p className="text-xs text-muted-foreground">
        Last updated {format(new Date(feedback.updatedAt), "MMMM d, yyyy")}
      </p>
    </div>
  );
}

export function LinkChildDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const link = useMutation({
    mutationFn: () =>
      customFetch("/api/parent-links", {
        method: "POST",
        body: JSON.stringify({ studentEmail: email.trim() }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent-links"] });
      toast({ title: "Child linked" });
      setEmail("");
      onOpenChange(false);
    },
    onError: (e) =>
      toast({ title: "Couldn't link", description: errorMessage(e, "Try again."), variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link your child</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Enter the email your child used to sign up. You'll then see their feedback, schedule, and payments.
        </p>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && email.trim()) link.mutate(); }}
          placeholder="child@example.com"
          className="rounded-lg"
          autoFocus
        />
        <DialogFooter>
          <Button
            onClick={() => link.mutate()}
            disabled={!email.trim() || link.isPending}
            className="w-full rounded-lg gap-2"
          >
            {link.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Link child
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
