# Hosting the live site

The live site runs on [Render](https://render.com) at **claritymathematics.com**.
Everything is described in `render.yaml` at the repo root:

- **One web service** builds the frontend (`artifacts/tutor-hub`) and the API
  (`artifacts/api-server`). The API server also serves the built pages
  (`STATIC_DIR`), so the whole site and `/api` share one address.
- **A 1 GB persistent disk** at `/var/data` keeps uploaded worksheets
  (`UPLOADS_DIR=/var/data/uploads`) across deploys.
- **A managed Postgres database** (`clarity-db`) with daily backups.
  `pnpm --filter db run push` runs before each deploy to apply schema changes.
- Deploys happen automatically when a commit on `main` passes its GitHub checks.

Replit and local development are unchanged: `STATIC_DIR` is unset there, so the
API server only serves `/api`.

## Settings the service needs

| Variable | What it is | Where it comes from |
| --- | --- | --- |
| `DATABASE_URL` | Database address | Filled in by Render from `clarity-db` |
| `STATIC_DIR` | Built web pages to serve | Set in `render.yaml` |
| `UPLOADS_DIR` | Where worksheets are saved | Set in `render.yaml` (on the disk) |
| `CORS_ORIGINS` | Sites allowed to call the API | Set in `render.yaml` |
| `CLERK_PUBLISHABLE_KEY` | Clerk live key starting `pk_live_` | Clerk dashboard, production instance, API keys |
| `VITE_CLERK_PUBLISHABLE_KEY` | The same `pk_live_` key, built into the web pages | Same as above |
| `CLERK_SECRET_KEY` | Clerk secret starting `sk_live_` | Same place. Never share or commit it |
| `TUTOR_EMAILS` | Comma-separated emails allowed to become tutors | You decide |
| `TRUST_PROXY_HOPS` | Optional. Proxies in front of the app (default 1) | Only if rate limiting sees the proxy's address instead of visitors' |

## First-time setup

Steps marked **(Chloé)** need your accounts or payment details.

1. **(Chloé)** Create a Render account, sign in with GitHub, and give it access
   to the `Clarity_Mathematics` repository. Add a payment card under Billing.
2. **(Chloé)** In Render choose **New → Blueprint**, pick the repository, and
   approve the plan it shows: one web service, one disk, one database. It asks for the four
   `sync: false` values above. The test Clerk keys work for a first trial run.
3. Claude checks the trial copy at its `onrender.com` address before any DNS changes.
4. **(Chloé)** In Clerk, create the **production instance** (Clerk dashboard,
   switch from Development to Production) for `claritymathematics.com`.
5. **(Chloé)** Because families can sign in with Google, the production instance
   needs its own Google sign-in credentials: in Clerk go to
   **SSO connections → Google** and follow its link to create an OAuth client in Google Cloud,
   then paste the client ID and secret back into Clerk.
6. **(Chloé)** Add DNS records in Squarespace (**Domains → claritymathematics.com →
   DNS → Custom records**). Copy each value exactly from the dashboard named:
   - Render → the `clarity` service → **Settings → Custom Domains**: add
     `claritymathematics.com` and `www.claritymathematics.com`, then add the
     records Render shows. Remove any Squarespace default records for `@` or `www`
     that point at a Squarespace page.
   - Clerk → production instance → **Domains**: the CNAME records it lists
     (sign-in and email sending).
   - **Leave the Google Workspace MX records alone.** They deliver your email.
7. Swap the four Clerk values in Render for the `pk_live_` / `sk_live_` keys and
   redeploy. In Clerk, click **Deploy certificates** once its checklist is green.
8. Claude runs a full test on the live address before families are invited.

DNS changes usually show up within an hour, but can take up to 48 hours.

## Costs (checked 2026-11-15)

Web service $7 + disk $0.25 + database $6 ≈ **$13–14 a month** on Render's free
Hobby workspace. Clerk is free up to 50,000 monthly users.
