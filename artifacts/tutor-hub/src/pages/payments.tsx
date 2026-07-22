import { CreditCard, Gift, Clock, RefreshCcw, Copy, CheckCircle, Wallet, Check, Loader2, Pencil, Receipt } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePayments, type Payment } from "@/components/payment-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

// Set this once the tutor's Venmo handle exists → enables the one-tap Venmo button.
const VENMO_HANDLE = "";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="ml-2 text-muted-foreground hover:text-foreground transition-colors" title="Copy">
      {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

/** Open a clean, printable receipt in a new window (user can Save as PDF). */
function openReceipt(p: Payment) {
  const w = window.open("", "_blank", "width=460,height=680");
  if (!w) return;
  const paidAt = p.receivedAt ?? p.createdAt;
  const date = paidAt ? format(new Date(paidAt), "MMMM d, yyyy") : "—";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt — Clarity Mathematics</title>
    <style>
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e293b;padding:40px;max-width:400px;margin:0 auto;}
      h1{font-family:Georgia,'Times New Roman',serif;color:#c9a227;font-size:30px;margin:0;letter-spacing:-1px;}
      .sub{color:#64748b;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
      h2{font-size:15px;margin:28px 0 12px;}
      .row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #e2e8f0;font-size:14px;}
      .row .label{color:#64748b;}
      .row span:last-child{text-align:right;font-weight:600;}
      .total{display:flex;justify-content:space-between;font-size:22px;font-weight:800;margin-top:18px;}
      .paid{display:inline-block;margin-top:14px;background:#dcfce7;color:#166534;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.5px;}
      .foot{margin-top:36px;color:#94a3b8;font-size:11px;text-align:center;}
    </style></head><body>
    <h1>CM</h1><div class="sub">Clarity Mathematics</div>
    <h2>Payment Receipt</h2>
    <div class="row"><span class="label">Description</span><span>${escapeHtml(p.description || "Tutoring session")}</span></div>
    ${p.studentName ? `<div class="row"><span class="label">Student</span><span>${escapeHtml(p.studentName)}</span></div>` : ""}
    <div class="row"><span class="label">Date paid</span><span>${date}</span></div>
    <div class="total"><span>Total</span><span>$${p.amount}.00</span></div>
    <span class="paid">PAID</span>
    <div class="foot">Thank you — Clarity Mathematics</div>
    </body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    due: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    sent: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
    received: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    void: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    refund_due: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
    refunded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  const labels: Record<string, string> = {
    due: "Unpaid",
    sent: "Awaiting confirmation",
    received: "Paid",
    void: "Cancelled",
    refund_due: "Refund due",
    refunded: "Refunded",
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[status] ?? ""}`}>{labels[status] ?? status}</span>;
}

function ChargeRow({ p, isTutor }: { p: Payment; isTutor: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const markSent = useMutation({
    mutationFn: () => customFetch(`/api/payments/${p.id}/mark-sent`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Marked as paid", description: "Your tutor will confirm receipt." });
    },
  });
  const markReceived = useMutation({
    mutationFn: () => customFetch(`/api/payments/${p.id}/mark-received`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Payment confirmed" });
    },
  });
  const markRefunded = useMutation({
    mutationFn: () => customFetch(`/api/payments/${p.id}/mark-refunded`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "Refund marked as sent" });
    },
  });

  return (
    <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">
          {isTutor ? `${p.studentName} · ` : ""}
          {p.description || "Tutoring session"}
        </p>
        <p className="text-xs text-muted-foreground">
          {p.sessionDate ? format(new Date(p.sessionDate), "EEE, MMM d") : format(new Date(p.createdAt), "MMM d")}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold">
          {p.status === "refund_due"
            ? <span className="text-purple-700 dark:text-purple-300">refund ${p.refundDue}</span>
            : p.status === "void" ? <span className="text-muted-foreground line-through">${p.amount}</span> : `$${p.amount}`}
        </p>
        <StatusBadge status={p.status} />
      </div>
      {!isTutor && p.status === "due" && (
        <Button size="sm" className="rounded-lg shrink-0" disabled={markSent.isPending} onClick={() => markSent.mutate()}>
          {markSent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark as paid"}
        </Button>
      )}
      {isTutor && p.status === "sent" && (
        <Button size="sm" className="rounded-lg shrink-0 gap-1" disabled={markReceived.isPending} onClick={() => markReceived.mutate()}>
          {markReceived.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Confirm</>}
        </Button>
      )}
      {isTutor && p.status === "refund_due" && (
        <Button size="sm" variant="outline" className="rounded-lg shrink-0" disabled={markRefunded.isPending} onClick={() => markRefunded.mutate()}>
          {markRefunded.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark refunded"}
        </Button>
      )}
      {p.status === "received" && (
        <Button size="sm" variant="ghost" className="rounded-lg shrink-0 gap-1 text-muted-foreground hover:text-foreground" onClick={() => openReceipt(p)} title="Receipt">
          <Receipt className="h-4 w-4" /><span className="hidden sm:inline">Receipt</span>
        </Button>
      )}
    </div>
  );
}

function RateEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  const { data } = useQuery({
    queryKey: ["/api/payments/settings"],
    queryFn: () => customFetch<{ hourlyRate: number }>("/api/payments/settings"),
  });

  const save = useMutation({
    mutationFn: (rate: number) =>
      customFetch("/api/payments/settings", { method: "PUT", body: JSON.stringify({ hourlyRate: rate }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      setEditing(false);
      toast({ title: "Hourly rate updated" });
    },
  });

  const rate = data?.hourlyRate ?? 40;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Your rate:</span>
      {editing ? (
        <>
          <div className="flex items-center">
            <span className="text-muted-foreground mr-1">$</span>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-8 w-20 rounded-lg"
              placeholder={String(rate)}
            />
            <span className="text-muted-foreground ml-1">/hr</span>
          </div>
          <Button size="sm" className="h-8 rounded-lg" disabled={save.isPending} onClick={() => save.mutate(Math.max(0, Math.round(Number(value) || rate)))}>
            Save
          </Button>
          <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => setEditing(false)}>Cancel</Button>
        </>
      ) : (
        <>
          <span className="font-bold">${rate}/hr</span>
          <button onClick={() => { setValue(String(rate)); setEditing(true); }} className="text-muted-foreground hover:text-foreground" title="Edit rate">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";
  const { data: payments } = usePayments();

  const list = payments ?? [];
  const outstanding = isTutor
    ? list.filter((p) => p.status === "sent")
    : list.filter((p) => p.status === "due");
  const outstandingTotal = outstanding.reduce((s, p) => s + p.amount, 0);

  const sum = (pred: (p: Payment) => boolean) => list.filter(pred).reduce((s, p) => s + p.amount, 0);
  const receivedTotal = sum((p) => p.status === "received");
  const owedTotal = isTutor
    ? sum((p) => p.status === "due" || p.status === "sent")
    : sum((p) => p.status === "due");

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" /> Payments
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isTutor ? "Charges per session, and payment confirmations." : "Pay after each session and mark it here."}
          </p>
        </div>
        {isTutor && <RateEditor />}
      </div>

      {list.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{isTutor ? "Received" : "Paid"}</p>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">${receivedTotal}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400">${owedTotal}</p>
          </div>
        </div>
      )}

      {/* Charges */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {isTutor ? "Payment history" : "Your charges"}
          </p>
          {outstanding.length > 0 && (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              {isTutor ? `$${outstandingTotal} awaiting confirmation` : `$${outstandingTotal} due`}
            </p>
          )}
        </div>

        {list.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-2xl p-8 text-center">
            <Wallet className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">
              {isTutor ? "No charges yet. They appear automatically after each session." : "No charges yet. Your first session is free!"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((p) => <ChargeRow key={p.id} p={p} isTutor={isTutor} />)}
          </div>
        )}
        {!isTutor && outstanding.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Pay using a method below, then tap <span className="font-medium">"Mark as paid"</span>.
          </p>
        )}
      </div>

      {/* Payment methods */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Payment Methods</p>

        {/* Zelle */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-xl bg-[#6D1ED4]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#6D1ED4]" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.25 16.5H9.362l5.513-8.25H8.75v-1.5h8.138L11.375 15H17.25v1.5z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-foreground">Zelle</p>
              <p className="text-xs text-muted-foreground mt-0.5">Copy a detail, then send in your bank's app.</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">Email</span>
              <div className="flex items-center">
                <span className="text-sm font-medium text-foreground">chloejenkins@claritymathematics.com</span>
                <CopyButton text="chloejenkins@claritymathematics.com" />
              </div>
            </div>
            <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2">
              <span className="text-xs text-muted-foreground">Phone</span>
              <div className="flex items-center">
                <span className="text-sm font-medium text-foreground">(862) 357-1374</span>
                <CopyButton text="(862) 357-1374" />
              </div>
            </div>
          </div>
        </div>

        {/* Venmo */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#008CFF]/10 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#008CFF]" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19.014 2.002c.394 1.18.569 2.398.569 3.95C19.583 11.2 14.72 18.3 10.8 22H3.985L1 3.23l6.02-.567 1.567 12.634c1.46-2.48 3.26-6.386 3.26-9.048 0-1.458-.25-2.449-.622-3.277l7.79-.97z"/>
                </svg>
              </div>
              <div>
                <p className="font-semibold text-foreground">Venmo</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {VENMO_HANDLE ? `@${VENMO_HANDLE}` : "Handle coming soon"}
                </p>
              </div>
            </div>
            {VENMO_HANDLE && !isTutor && (
              <a
                href={`https://venmo.com/u/${VENMO_HANDLE}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-[#008CFF] hover:bg-[#0079e0] text-white text-sm font-semibold px-4 h-9 rounded-lg transition-colors"
              >
                <Wallet className="h-4 w-4" /> Pay
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Policy */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pricing &amp; Policy</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div className="bg-emerald-100 dark:bg-emerald-950/40 p-1.5 rounded-lg shrink-0 mt-0.5">
              <Gift className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-snug">First session free</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">No payment needed to get started.</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div className="bg-amber-100 dark:bg-amber-950/40 p-1.5 rounded-lg shrink-0 mt-0.5">
              <Clock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-snug">50% refund</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">If cancelled within 24 hours of session.</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div className="bg-blue-100 dark:bg-blue-950/40 p-1.5 rounded-lg shrink-0 mt-0.5">
              <RefreshCcw className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-snug">100% refund</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">If cancelled more than 24 hours in advance.</p>
            </div>
          </div>
        </div>
      </div>

      {!isTutor && (
        <p className="text-xs text-muted-foreground text-center pb-4">
          Questions about a payment? Message your tutor directly in the Chat tab.
        </p>
      )}
    </div>
  );
}
