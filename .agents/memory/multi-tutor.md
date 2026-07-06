---
name: Multi-tutor architecture
description: How the app scopes all data by tutorId to support multiple tutors
---

Every resource table (tutoring_sessions, assignments, availability_slots, parent_feedback, videos, parent_student_links) has a nullable `tutorId` column. The `users` table also has `tutorId` (which tutor a student/parent belongs to).

**How it works:**
- Tutors create resources → stamped with their own userId as tutorId
- Students/parents read resources → filtered by their linked tutorId from req.user.tutorId
- If tutorId is null (legacy data), existing rows are unaffected

**How tutorId flows:**
- Auth middleware (`authMiddleware.ts`) reads tutorId from usersTable and stamps it on req.user.tutorId
- Onboarding: when student/parent picks a tutor, POST /api/auth/set-role with { role, tutorId }
- Backend updates usersTable.tutorId AND Clerk publicMetadata.tutorId
- Frontend useAuth reads tutorId from clerkUser.publicMetadata.tutorId

**Why nullable (not required):**
- Allows backward compat — existing rows before multi-tutor don't break
- If tutorId is null on a student, they see empty lists (graceful degradation)

**How to apply:**
- Any new resource table should include `tutorId varchar("tutor_id")` (nullable)
- Tutor writes: stamp tutorId = req.user.id
- Student/parent reads: filter by tutorId = req.user.tutorId (skip filter if null)
