import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";

const LAST_UPDATED = "July 23, 2026";
const CONTACT_EMAIL = "chloejenkins@claritymathematics.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <Logo style={{ color: "#1b2740", fontSize: "1.05rem" }} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-14">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900">Privacy Policy</h1>
          <p className="text-sm text-slate-400 mt-2">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8">
          <p className="text-sm leading-relaxed text-slate-600">
            Clarity Mathematics ("we," "us") provides a private one-on-one math tutoring platform for
            scheduling lessons, messaging, sharing assignments, and tracking progress. This policy
            explains what information we collect, how we use it, and the choices you have. We collect
            only what we need to run the tutoring service, and we do not sell your personal information.
          </p>

          <Section title="1. Who this policy covers">
            <p>
              This policy applies to everyone who uses the platform: tutors, students, and parents or
              guardians. Because tutoring often involves minors, we ask that a parent or guardian set
              up and oversee a student account where the student is under the age of 18.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>We collect the following, most of which you provide directly:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-slate-700">Account information</strong>: your name, email
                address, username, and (if you add one) a profile photo. Sign-in and account security
                are handled by our authentication provider, Clerk.
              </li>
              <li>
                <strong className="text-slate-700">Role and relationships</strong>: whether you are a
                tutor, student, or parent, and any parent–student links you create.
              </li>
              <li>
                <strong className="text-slate-700">Tutoring activity</strong>: sessions you book or
                schedule, availability, lesson notes, assignments, and work you submit.
              </li>
              <li>
                <strong className="text-slate-700">Messages</strong>: the content of direct and group
                conversations you send through the platform.
              </li>
              <li>
                <strong className="text-slate-700">Payment records</strong>: the amount, date, and
                status of payments for sessions. Payments themselves are made outside the platform
                through Venmo or Zelle, so we do not collect or store card numbers or bank details.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use your information">
            <p>We use the information above to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>provide and operate the tutoring service, scheduling, messaging, assignments, and progress;</li>
              <li>let parents view their linked child's sessions, assignments, and progress;</li>
              <li>keep a record of payments due and received;</li>
              <li>send reminders and important account or session notifications;</li>
              <li>secure the platform and prevent misuse.</li>
            </ul>
          </Section>

          <Section title="4. Children's privacy">
            <p>
              We take the privacy of minors seriously. Student accounts for children should be created
              and supervised by a parent or guardian, who can review their child's information and
              request changes or deletion at any time. We collect only the information needed to
              deliver tutoring, and we do not use a child's information for advertising. If you believe
              a child's information has been provided without appropriate consent, contact us and we
              will delete it.
            </p>
          </Section>

          <Section title="5. How information is shared">
            <p>We share information only in these limited ways:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-slate-700">Within your tutoring relationship</strong>: a
                tutor and their student (and a linked parent) can see the sessions, assignments,
                messages, and notes relevant to that relationship.
              </li>
              <li>
                <strong className="text-slate-700">Service providers</strong>: we use trusted
                providers to run the platform, such as Clerk for authentication and our hosting
                provider for storing data. They may process information only on our behalf.
              </li>
              <li>
                <strong className="text-slate-700">Legal reasons</strong>: if required by law or to
                protect the safety and rights of our users.
              </li>
            </ul>
            <p>We do not sell your personal information or share it for third-party advertising.</p>
          </Section>

          <Section title="6. Data retention">
            <p>
              We keep your information for as long as your account is active or as needed to provide the
              service and keep accurate records (for example, past payments and sessions). When you ask
              us to delete your account, we remove your personal information unless we are required to
              retain some of it for legal or record-keeping reasons.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We use reasonable measures to protect your information, including authenticated access and
              encrypted connections. No online service can be guaranteed to be perfectly secure, but we
              work to protect your data and to limit access to it.
            </p>
          </Section>

          <Section title="8. Your choices and rights">
            <p>You can:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>view and update your profile information at any time from your account;</li>
              <li>request a copy of the personal information we hold about you;</li>
              <li>ask us to correct or delete your information, or close your account.</li>
            </ul>
            <p>To make any of these requests, contact us using the details below.</p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>
              We may update this policy from time to time. When we make material changes, we will update
              the "Last updated" date above and, where appropriate, notify you through the platform.
            </p>
          </Section>

          <Section title="10. Contact us">
            <p>
              If you have questions about this policy or your information, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-700 font-medium hover:underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-200 flex items-center gap-4">
          <Link href="/" className="text-sm text-blue-700 font-medium hover:underline">
            ← Back to Clarity Mathematics
          </Link>
          <Link href="/terms" className="text-sm text-slate-400 hover:text-slate-700">
            Terms &amp; Conditions
          </Link>
        </div>
      </main>
    </div>
  );
}
