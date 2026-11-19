import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

const LAST_UPDATED = "October 16, 2026";
const CONTACT_EMAIL = "chloejenkins@claritymathematics.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-foreground/80">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-background">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Logo className="text-foreground" style={{ fontSize: "1.05rem" }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        <div className="mb-8">
          <h1 className="page-title">Terms &amp; Conditions</h1>
          <p className="text-sm text-muted-foreground mt-2">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8">
          <p className="text-[15px] leading-relaxed text-foreground/80">
            These Terms &amp; Conditions ("Terms") govern your use of Clarity Mathematics (the
            "Service"), a private one-on-one math tutoring platform. By creating an account or using the
            Service, you agree to these Terms. If you do not agree, please do not use the Service.
          </p>

          <Section title="1. The service">
            <p>
              Clarity Mathematics provides tools for booking tutoring sessions, messaging, sharing and
              submitting assignments, tracking progress, and recording payments for one-on-one math
              tutoring. We may add, change, or remove features over time.
            </p>
          </Section>

          <Section title="2. Accounts and eligibility">
            <p>
              You are responsible for the accuracy of the information on your account and for keeping
              your sign-in credentials secure. Student accounts for anyone under 18 should be created
              and supervised by a parent or guardian, who accepts these Terms on the student's behalf.
              You are responsible for activity that occurs under your account.
            </p>
          </Section>

          <Section title="3. Scheduling and cancellations">
            <p>
              Sessions are booked through the platform against the tutor's available times. Our current
              cancellation policy is:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>the first session is free;</li>
              <li>cancel more than 24 hours before a session for a full (100%) refund;</li>
              <li>cancel within 24 hours of a session for a 50% refund;</li>
              <li>a session missed without cancelling (a no-show) is charged at 50%, the same as a late cancellation.</li>
            </ul>
            <p>
              We ask that you give as much notice as possible so the time can be offered to other
              students.
            </p>
          </Section>

          <Section title="4. Payments">
            <p>
              Payment for sessions is made directly to the tutor outside the platform via Venmo or
              Zelle. The platform records the amount, date, and status of payments for your reference
              but does not process card or bank transactions. Fees for sessions are as communicated by
              the tutor and reflected in the platform.
            </p>
          </Section>

          <Section title="5. Acceptable use">
            <p>You agree to use the Service respectfully and lawfully. In particular, you will not:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>harass, abuse, or send inappropriate content to others through messaging;</li>
              <li>share another person's private information without permission;</li>
              <li>attempt to disrupt, overload, or gain unauthorized access to the Service;</li>
              <li>use the Service for anything other than its intended tutoring purpose.</li>
            </ul>
          </Section>

          <Section title="6. Your content">
            <p>
              You keep ownership of the messages, assignments, and other content you submit. You grant
              us permission to store and display that content as needed to operate the Service (for
              example, showing an assignment to your tutor, or a lesson note to a linked parent).
            </p>
          </Section>

          <Section title="7. Disclaimers">
            <p>
              The Service is provided on an "as is" basis. Tutoring is intended to support learning, and
              we do not guarantee any particular grade, score, or academic outcome. We aim to keep the
              Service available and accurate but cannot promise it will always be uninterrupted or
              error-free.
            </p>
          </Section>

          <Section title="8. Limitation of liability">
            <p>
              To the extent permitted by law, Clarity Mathematics is not liable for indirect or
              incidental damages arising from your use of the Service. Nothing in these Terms limits
              liability that cannot be limited under applicable law.
            </p>
          </Section>

          <Section title="9. Ending use of the service">
            <p>
              You may stop using the Service and close your account at any time. We may suspend or end
              access if these Terms are broken or if needed to protect the Service or its users.
            </p>
          </Section>

          <Section title="10. Changes and contact">
            <p>
              We may update these Terms from time to time; the "Last updated" date above reflects the
              latest version. For any questions about these Terms, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-foreground underline underline-offset-4 decoration-foreground/30 hover:decoration-foreground">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex items-center gap-4">
          <Link href="/" className="text-sm text-foreground font-medium underline-offset-4 hover:underline">
            ← Back to Clarity Mathematics
          </Link>
          <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
            Privacy Policy
          </Link>
        </div>
      </main>
    </div>
  );
}
