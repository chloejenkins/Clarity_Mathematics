import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { UserPlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface LinkRequest {
  id: number;
  parentName: string;
  parentEmail: string | null;
  studentName: string | null;
}

/**
 * Pending "link me as this student's parent" requests, shown to the student
 * (about themselves) and to their tutor. A parent sees nothing of the child
 * until one of them approves.
 */
export function ParentLinkRequestsBanner() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const enabled = isTutor || user?.role === "student";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requests } = useQuery({
    queryKey: ["/api/parent-links/requests"],
    queryFn: () => customFetch<LinkRequest[]>("/api/parent-links/requests"),
    refetchInterval: 60_000,
    retry: false,
    enabled,
  });

  const decide = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "approve" | "decline" }) =>
      customFetch(`/api/parent-links/${id}/${action}`, { method: "POST" }),
    onSuccess: (_res, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/parent-links/requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: action === "approve" ? "Parent linked" : "Request declined" });
    },
    onError: () => toast({ title: "Something went wrong", variant: "destructive" }),
  });

  if (!enabled || !requests || requests.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm"
        >
          <UserPlus className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 min-w-0">
            <span className="font-semibold">{r.parentName}</span>
            {r.parentEmail && <span className="text-muted-foreground"> ({r.parentEmail})</span>}
            {isTutor
              ? ` wants to be linked as ${r.studentName ?? "a student"}'s parent.`
              : " wants to be linked as your parent. They'd see your schedule, assignments and feedback."}
          </span>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              className="rounded-lg gap-1"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: r.id, action: "approve" })}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg gap-1"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: r.id, action: "decline" })}
            >
              <X className="h-3.5 w-3.5" /> Decline
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
