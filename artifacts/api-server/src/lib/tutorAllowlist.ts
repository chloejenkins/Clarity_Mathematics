// Emails permitted to hold the "tutor" role.
//
// Configure via the TUTOR_EMAILS env var: a comma-separated list of exact
// addresses (case-insensitive), e.g.
//   TUTOR_EMAILS="chloejenkins@claritymathematics.com,ms.bennett@example.com"
//
// Fails closed: if TUTOR_EMAILS is unset/empty, no new account can claim the
// tutor role via onboarding. (Existing tutor rows keep their role, the
// allowlist only gates *assigning* the role, not revoking it.)
const allowedTutorEmails = new Set(
  (process.env.TUTOR_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** True if the given email address is authorized to hold the tutor role. */
export function isAllowedTutorEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return allowedTutorEmails.has(email.trim().toLowerCase());
}

/** True if any of the given addresses is allowed to be a tutor. */
export function anyAllowedTutorEmail(emails: (string | null | undefined)[]): boolean {
  return emails.some(isAllowedTutorEmail);
}
