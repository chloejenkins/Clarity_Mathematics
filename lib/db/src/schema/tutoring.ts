import { pgTable, serial, text, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tutoringSessionsTable = pgTable("tutoring_sessions", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id"),
  studentId: varchar("student_id").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  topic: varchar("topic"),
  status: varchar("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  type: varchar("type").notNull().default("direct"), // "direct" | "group"
  title: varchar("title"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const conversationParticipantsTable = pgTable("conversation_participants", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Conversation = typeof conversationsTable.$inferSelect;
export type ConversationParticipant = typeof conversationParticipantsTable.$inferSelect;

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id"),
  assignedTo: varchar("assigned_to"), // the student or parent this assignment is for
  title: varchar("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  subject: varchar("subject"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id"),
  title: varchar("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  subject: varchar("subject"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const availabilitySlotsTable = pgTable("availability_slots", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  topic: varchar("topic"),
  isBooked: varchar("is_booked").notNull().default("false"),
  bookedByStudentId: varchar("booked_by_student_id"),
  sessionId: integer("session_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const submissionsTable = pgTable("submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull(),
  studentId: varchar("student_id").notNull(),
  content: text("content").notNull(),
  tutorComment: text("tutor_comment"), // tutor's review note
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id"), // null = file sent directly to the tutor
  uploadedBy: varchar("uploaded_by").notNull(),
  tutorId: varchar("tutor_id"), // recipient tutor (for routing direct sends)
  filename: varchar("filename").notNull(), // original file name
  storageKey: varchar("storage_key").notNull(), // on-disk file name
  mimeType: varchar("mime_type"),
  sizeBytes: integer("size_bytes"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Attachment = typeof attachmentsTable.$inferSelect;

export const parentStudentLinksTable = pgTable("parent_student_links", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id"),
  parentId: varchar("parent_id").notNull(),
  studentId: varchar("student_id"),
  studentName: varchar("student_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ParentStudentLink = typeof parentStudentLinksTable.$inferSelect;

export const parentFeedbackTable = pgTable("parent_feedback", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id"),
  studentId: varchar("student_id").notNull(),
  content: text("content").notNull(),
  period: varchar("period"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ParentFeedback = typeof parentFeedbackTable.$inferSelect;

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  tutorId: varchar("tutor_id").notNull(),
  studentId: varchar("student_id").notNull(),
  sessionId: integer("session_id"), // the session this charge is for (null = manual/other)
  amount: integer("amount").notNull(), // whole dollars
  description: varchar("description"),
  // "due" | "sent" | "received" | "void" | "refund_due" | "refunded"
  status: varchar("status").notNull().default("due"),
  refundDue: integer("refund_due").notNull().default(0), // amount the tutor should refund
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
});

export type Payment = typeof paymentsTable.$inferSelect;

export const insertTutoringSessionSchema = createInsertSchema(tutoringSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true });
export const insertAvailabilitySlotSchema = createInsertSchema(availabilitySlotsTable).omit({ id: true, createdAt: true });
export const insertSubmissionSchema = createInsertSchema(submissionsTable).omit({ id: true, submittedAt: true, updatedAt: true });

export type TutoringSession = typeof tutoringSessionsTable.$inferSelect;
export type InsertTutoringSession = z.infer<typeof insertTutoringSessionSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Video = typeof videosTable.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Submission = typeof submissionsTable.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
