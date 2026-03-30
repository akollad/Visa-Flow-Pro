import { pgTable, serial, integer, text, timestamp, boolean, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const destinationEnum = pgEnum("destination", ["usa", "dubai", "turkey", "india"]);

export const applicationStatusEnum = pgEnum("application_status", [
  "draft",
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "appointment_scheduled",
]);

export const applicationsTable = pgTable("applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  applicantName: text("applicant_name").notNull(),
  destination: destinationEnum("destination").notNull(),
  visaType: text("visa_type").notNull(),
  status: applicationStatusEnum("status").notNull().default("draft"),
  appointmentDate: timestamp("appointment_date"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  passportNumber: text("passport_number"),
  travelDate: timestamp("travel_date"),
  returnDate: timestamp("return_date"),
  purpose: text("purpose"),
  price: numeric("price", { precision: 10, scale: 2 }),
  isPaid: boolean("is_paid").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type Application = typeof applicationsTable.$inferSelect;
