import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { Link, useLocation } from "wouter";
import { AlertCircle, ArrowRight } from "lucide-react";

export interface Payment {
  id: number;
  amount: number;
  description: string | null;
  status: "due" | "sent" | "received" | "void" | "refund_due" | "refunded" | string;
  refundDue: number;
  studentId: string;
  studentName: string;
  tutorName: string;
  sessionDate: string | null;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
}

export function usePayments() {
  return useQuery({
    queryKey: ["/api/payments"],
    queryFn: () => customFetch<Payment[]>("/api/payments"),
    refetchInterval: 15000,
    retry: false,
  });
}

function Banner({ text, tone }: { text: string; tone: "primary" | "amber" }) {
  const cls =
    tone === "amber"
      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200"
      : "bg-primary/5 border-primary/25 text-foreground";
  return (
    <Link
      href="/payments"
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 mb-5 text-sm font-medium hover:shadow-sm transition-shadow ${cls}`}
    >
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{text}</span>
      <span className="flex items-center gap-1 text-xs font-semibold shrink-0">
        View <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

/** App-wide banner nudging outstanding payments. Hidden on the Payments page itself. */
export function PaymentBanner() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { data } = usePayments();

  if (!data || location === "/payments") return null;

  if (user?.role === "tutor") {
    const awaiting = data.filter((p) => p.status === "sent");
    const refunds = data.filter((p) => p.status === "refund_due");
    if (awaiting.length === 0 && refunds.length === 0) return null;
    const parts: string[] = [];
    if (awaiting.length) parts.push(`${awaiting.length} to confirm ($${awaiting.reduce((s, p) => s + p.amount, 0)})`);
    if (refunds.length) parts.push(`${refunds.length} refund${refunds.length > 1 ? "s" : ""} to send ($${refunds.reduce((s, p) => s + p.refundDue, 0)})`);
    return <Banner tone="amber" text={`Payments need attention — ${parts.join(" · ")}`} />;
  }

  const due = data.filter((p) => p.status === "due");
  if (due.length > 0) {
    const total = due.reduce((s, p) => s + p.amount, 0);
    return <Banner tone="primary" text={`You have ${due.length} unpaid session${due.length > 1 ? "s" : ""} — $${total} due`} />;
  }

  const owedRefunds = data.filter((p) => p.status === "refund_due");
  if (owedRefunds.length > 0) {
    const total = owedRefunds.reduce((s, p) => s + p.refundDue, 0);
    return <Banner tone="primary" text={`You're owed $${total} in refunds`} />;
  }

  return null;
}
