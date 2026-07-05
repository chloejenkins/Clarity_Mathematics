import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { customFetch } from "@workspace/api-client-react";
import { ClipboardList, Save, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface StudentUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email: string | null;
}

interface FeedbackRecord {
  id: number;
  studentId: string;
  content: string;
  period: string | null;
  updatedAt: string;
}

function displayName(u: StudentUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.email || "Unknown";
}

export default function ParentReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [period, setPeriod] = useState("");

  if (user?.role !== "tutor") {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">This page is restricted to tutors.</p>
      </div>
    );
  }

  const { data: allUsers } = useQuery<StudentUser[]>({
    queryKey: ["/api/users"],
    queryFn: () => customFetch("/api/users"),
  });

  const students = (allUsers ?? []).filter((u) => u.id !== user.id);

  const { data: feedback, isLoading: feedbackLoading } = useQuery<FeedbackRecord | null>({
    queryKey: ["/api/parent-feedback", selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const rows = await customFetch<FeedbackRecord[]>(`/api/parent-feedback/${selectedStudentId}`);
      return rows[0] ?? null;
    },
    enabled: !!selectedStudentId,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/parent-feedback/${selectedStudentId}`, {
        method: "PUT",
        body: JSON.stringify({ content: draft, period: period || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent-feedback", selectedStudentId] });
      toast({ title: "Report saved" });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      customFetch(`/api/parent-feedback/${selectedStudentId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent-feedback", selectedStudentId] });
      setDraft("");
      setPeriod("");
      toast({ title: "Report cleared" });
    },
    onError: () => toast({ title: "Failed to clear", variant: "destructive" }),
  });

  function handleSelectStudent(id: string) {
    setSelectedStudentId(id);
    setDraft("");
    setPeriod("");
  }

  function handleLoadFeedback() {
    if (feedback) {
      setDraft(feedback.content);
      setPeriod(feedback.period ?? "");
    } else {
      setDraft("");
      setPeriod("");
    }
  }

  const selected = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Parent Reports
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Private notes for parents only — students cannot see this page.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {/* Student list */}
        <div className="sm:col-span-1 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Students</p>
          {students.length === 0 && (
            <p className="text-sm text-muted-foreground">No students yet.</p>
          )}
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectStudent(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 transition-all border ${
                selectedStudentId === s.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card border-border text-foreground hover:bg-muted"
              }`}
            >
              <User className="h-4 w-4 shrink-0 opacity-60" />
              <span className="truncate font-medium">{displayName(s)}</span>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="sm:col-span-2 space-y-4">
          {!selectedStudentId ? (
            <div className="bg-muted rounded-2xl p-8 text-center">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm text-muted-foreground">Select a student to write or view their parent report.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{selected ? displayName(selected) : ""}</p>
                {feedback && (
                  <p className="text-xs text-muted-foreground">
                    Last updated {format(new Date(feedback.updatedAt), "MMM d, yyyy")}
                  </p>
                )}
              </div>

              {feedbackLoading ? (
                <div className="h-40 bg-muted rounded-xl animate-pulse" />
              ) : (
                <>
                  {feedback && draft === "" && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                      <p className="text-sm text-blue-700">A report exists for this student.</p>
                      <Button size="sm" variant="outline" onClick={handleLoadFeedback} className="text-xs">
                        Load to edit
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Period / Label (optional)</label>
                    <Input
                      placeholder="e.g. Fall 2025, Week 3…"
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Report</label>
                    <Textarea
                      placeholder="Write your feedback for the parent here. This is private — only you can see it."
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="rounded-xl min-h-[200px] resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={!draft.trim() || saveMutation.isPending}
                      className="flex-1 rounded-xl"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {saveMutation.isPending ? "Saving…" : "Save Report"}
                    </Button>
                    {feedback && (
                      <Button
                        variant="outline"
                        onClick={() => deleteMutation.mutate()}
                        disabled={deleteMutation.isPending}
                        className="rounded-xl text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
