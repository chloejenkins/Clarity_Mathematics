import { CreditCard, Gift, Clock, RefreshCcw, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@workspace/replit-auth-web";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-slate-400 hover:text-slate-600 transition-colors"
      title="Copy"
    >
      {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const isTutor = user?.role === "tutor";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" /> Payments
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isTutor
            ? "Payment methods and policy shown to students."
            : "Send payment directly after each session using the details below."}
        </p>
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
            <p className="font-semibold text-foreground">Zelle</p>
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
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#008CFF]/10 flex items-center justify-center shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#008CFF]" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.014 2.002c.394 1.18.569 2.398.569 3.95C19.583 11.2 14.72 18.3 10.8 22H3.985L1 3.23l6.02-.567 1.567 12.634c1.46-2.48 3.26-6.386 3.26-9.048 0-1.458-.25-2.449-.622-3.277l7.79-.97z"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-foreground">Venmo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Handle coming soon</p>
            </div>
          </div>
        </div>
      </div>

      {/* Policy */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Pricing &amp; Policy</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div className="bg-emerald-100 p-1.5 rounded-lg shrink-0 mt-0.5">
              <Gift className="h-3.5 w-3.5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-snug">First session free</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">No payment needed to get started.</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div className="bg-amber-100 p-1.5 rounded-lg shrink-0 mt-0.5">
              <Clock className="h-3.5 w-3.5 text-amber-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-snug">50% refund</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">If cancelled within 24 hours of session.</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
            <div className="bg-blue-100 p-1.5 rounded-lg shrink-0 mt-0.5">
              <RefreshCcw className="h-3.5 w-3.5 text-blue-700" />
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
