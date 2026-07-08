import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { ClipboardList, User } from "lucide-react";
import { format } from "date-fns";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface ParentStudentLink {
  id: number;
  parentId: string;
  studentId: string | null;
  studentName: string | null;
}

interface FeedbackRecord {
  id: number;
  studentId: string;
  content: string;
  period: string | null;
  updatedAt: string;
}

interface StudentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

export default function ParentFeedbackViewPage() {
  const { user } = useAuth();

  const { data: links = [] } = useQuery<ParentStudentLink[]>({
    queryKey: ["/api/parent-links"],
    queryFn: () => customFetch("/api/parent-links"),
    enabled: user?.role === "parent",
  });

  const { data: allUsers = [] } = useQuery<StudentUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => customFetch("/api/users"),
    enabled: user?.role === "parent",
  });

  const linkedStudents = links
    .filter(l => l.studentId)
    .map(l => {
      const u = allUsers.find(u => u.id === l.studentId);
      return { link: l, user: u };
    });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Tutor Feedback
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Private notes your tutor has written for you about your student's progress.
        </p>
      </div>

      {links.length === 0 && (
        <div className="bg-muted rounded-2xl p-8 text-center">
          <User className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm text-muted-foreground">
            No linked student accounts yet. Add a student from your account settings.
          </p>
        </div>
      )}

      {links.map(link => (
        <LinkedStudentFeedback
          key={link.id}
          link={link}
          studentUser={allUsers.find(u => u.id === link.studentId)}
        />
      ))}
    </div>
  );
}

function LinkedStudentFeedback({
  link,
  studentUser,
}: {
  link: ParentStudentLink;
  studentUser?: StudentUser;
}) {
  const displayName = studentUser
    ? [studentUser.firstName, studentUser.lastName].filter(Boolean).join(" ") ||
      studentUser.username ||
      link.studentName
    : link.studentName;

  const { data: feedbackList = [], isLoading } = useQuery<FeedbackRecord[]>({
    queryKey: ["/api/parent-feedback", link.studentId],
    queryFn: () => customFetch(`/api/parent-feedback/${link.studentId}`),
    enabled: !!link.studentId,
  });

  const feedback = feedbackList[0] ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        <p className="font-semibold text-foreground">{displayName}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : !feedback ? (
        <EmptyState
          icon={ClipboardList}
          title="No feedback yet"
          description="Your tutor hasn't shared any feedback yet. Check back soon."
        />
      ) : (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
          {feedback.period && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {feedback.period}
            </p>
          )}
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {feedback.content}
          </p>
          <p className="text-xs text-muted-foreground">
            Last updated {format(new Date(feedback.updatedAt), "MMMM d, yyyy")}
          </p>
        </div>
      )}
    </div>
  );
}
