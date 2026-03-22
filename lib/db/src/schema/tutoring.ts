import { pgTable, serial, text, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tutoringSessionsTable = pgTable("tutoring_sessions", {
  id: serial("id").primaryKey(),
  studentId: varchar("student_id").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  topic: varchar("topic"),
  status: varchar("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  subject: varchar("subject"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const videosTable = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  subject: varchar("subject"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTutoringSessionSchema = createInsertSchema(tutoringSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVideoSchema = createInsertSchema(videosTable).omit({ id: true, createdAt: true });

export type TutoringSession = typeof tutoringSessionsTable.$inferSelect;
export type InsertTutoringSession = z.infer<typeof insertTutoringSessionSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Video = typeof videosTable.$inferSelect;
export type InsertVideo = z.infer<typeof insertVideoSchema>;
