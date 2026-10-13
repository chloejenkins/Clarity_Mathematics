import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListUsers,
  useListStudentParentFeedback,
  useCreateParentFeedback,
  useUpdateParentFeedback,
  useDeleteParentFeedback,
  getListStudentParentFeedbackQueryKey,
  getListUsersQueryKey,
  type ParentFeedback,
  type User as StudentUser,
} from "@workspace/api-client-react";
import { ClipboardList, Pencil, Save, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function displayName(u: StudentUser) {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Unknown";
}

export default function ParentReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [period, setPeriod] = useState("");
  // The report being edited; null while writing a new one.
  const [editing, setEditing] = useState<ParentFeedback | null>(null);
  const isTutor = user?.role === "tutor";

  const { data: allUsers } = useListUsers({ query: { queryKey: getListUsersQueryKey(), enabled: isTutor } });
  const students = (allUsers ?? []).filter((u) => u.role === "student");

  const { data: reports = [], isLoading: reportsLoading } = useListStudentParentFeedback(selectedStudentId ?? "", {
    query: {
      queryKey: getListStudentParentFeedbackQueryKey(selectedStudentId ?? ""),
      enabled: isTutor && !!selectedStudentId,
    },
  });

  const refresh = () =>
    selectedStudentId &&
    queryClient.invalidateQueries({ queryKey: getListStudentParentFeedbackQueryKey(selectedStudentId) });

  function resetEditor() {
    setEditing(null);
    setDraft("");
    setPeriod("");
  }

  const createMutation = useCreateParentFeedback({
    mutation: {
      onSuccess: () => {
        refresh();
        resetEditor();
        toast({ title: "Report saved" });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  const updateMutation = useUpdateParentFeedback({
    mutation: {
      onSuccess: () => {
        refresh();
        resetEditor();
        toast({ title: "Report updated" });
      },
      onError: () => toast({ title: "Failed to save", variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteParentFeedback({
    mutation: {
      onSuccess: (_res, { id }) => {
        refresh();
        if (editing?.id === id) resetEditor();
        toast({ title: "Report deleted" });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    },
  });

  if (!isTutor) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">This page is restricted to tutors.</p>
      </div>
    );
  }

  function handleSelectStudent(id: string) {
    setSelectedStudentId(id);
    resetEditor();
  }

  function handleEdit(report: ParentFeedback) {
    setEditing(report);
    setDraft(report.content);
    setPeriod(report.period ?? "");
  }

  function handleDelete(report: ParentFeedback) {
    if (!confirm("Delete this report? Parents will no longer see it.")) return;
    deleteMutation.mutate({ id: report.id });
  }

  function handleSave() {
    if (!selectedStudentId) return;
    const data = { content: draft, period: period.trim() || null };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate({ studentId: selectedStudentId, data });
  }

  const saving = createMutation.isPending || updateMutation.isPending;
  const selected = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" /> Parent Reports
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Reports for parents. Each one appears on the linked parents' Feedback page; students never see them.
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

        {/* Editor and history */}
        <div className="sm:col-span-2 space-y-4">
          {!selectedStudentId ? (
            <div className="bg-muted rounded-2xl p-8 text-center">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm text-muted-foreground">Select a student to write a report or read past ones.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{selected ? displayName(selected) : ""}</p>
                <p className="text-xs text-muted-foreground">
                  {editing
                    ? `Editing the report from ${format(new Date(editing.createdAt), "MMM d, yyyy")}`
                    : "New report"}
                </p>
              </div>

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
                  placeholder="Write your feedback for the parent here. Parents linked to this student will see it; the student won't."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="rounded-xl min-h-[200px] resize-none"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={!draft.trim() || saving} className="flex-1 rounded-xl">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving…" : editing ? "Save Changes" : "Save Report"}
                </Button>
                {editing && (
                  <Button variant="outline" onClick={resetEditor} className="rounded-xl">
                    Cancel
                  </Button>
                )}
              </div>

              <div className="pt-2 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Past reports{reports.length > 0 ? ` (${reports.length})` : ""}
                </p>
                {reportsLoading ? (
                  <Skeleton className="h-24 rounded-2xl" />
                ) : reports.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No reports for this student yet.</p>
                ) : (
                  reports.map((r) => (
                    <div
                      key={r.id}
                      className={`bg-card border rounded-2xl p-4 space-y-2 ${editing?.id === r.id ? "border-primary" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {r.period && (
                            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground truncate">{r.period}</p>
                          )}
                          <p className="text-xs text-muted-foreground">{format(new Date(r.createdAt), "MMM d, yyyy")}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit report" onClick={() => handleEdit(r)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete report"
                            disabled={deleteMutation.isPending}
                            onClick={() => handleDelete(r)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{r.content}</p>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
