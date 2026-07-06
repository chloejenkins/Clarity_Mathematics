---
name: Onboarding flow
description: Role assignment and tutor-linking flow for new users
---

**New user sign-in flow:**
1. User signs in via Clerk
2. GET /api/auth/user creates DB record with role="pending" (non-first user) or role="tutor" (first user)
3. Frontend ProtectedRoute detects role="pending" → redirects to /onboarding
4. Onboarding: user picks Tutor / Parent / Student
5. Tutors: POST /api/auth/set-role { role:"tutor" } → straight to portal
6. Students: pick their tutor → POST /api/auth/set-role { role:"student", tutorId } → portal
7. Parents: pick tutor → set role → link student by name → portal

**set-role endpoint:** POST /api/auth/set-role (in parentLinks.ts route file)
- Updates usersTable.role + usersTable.tutorId
- Updates Clerk publicMetadata { role, tutorId }

**Tutor discovery:** GET /api/users/tutors — returns all users with role="tutor", available to authenticated users including pending role

**Why:**
- First user = tutor is how Chloe (main tutor) got set up
- Subsequent tutors use the onboarding "Tutor" option
- Storing tutorId in Clerk metadata keeps useAuth purely client-side (no extra API call)
