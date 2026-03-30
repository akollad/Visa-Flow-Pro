import { Router, type IRouter, type Request, type Response } from "express";
import { db, applicationsTable, usersTable, messagesTable } from "@workspace/db";
import { eq, count, desc, and, gte } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/stats", requireAdmin, async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalApps, pendingReview, approvedMonth, totalClients] = await Promise.all([
    db.select({ count: count() }).from(applicationsTable),
    db.select({ count: count() }).from(applicationsTable).where(eq(applicationsTable.status, "in_review")),
    db.select({ count: count() }).from(applicationsTable).where(
      and(eq(applicationsTable.status, "approved"), gte(applicationsTable.updatedAt, startOfMonth))
    ),
    db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "client")),
  ]);

  const allApps = await db.select().from(applicationsTable);
  const byDestination: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const app of allApps) {
    byDestination[app.destination] = (byDestination[app.destination] ?? 0) + 1;
    byStatus[app.status] = (byStatus[app.status] ?? 0) + 1;
  }

  const recentApps = await db.select({ app: applicationsTable, user: usersTable })
    .from(applicationsTable)
    .leftJoin(usersTable, eq(applicationsTable.userId, usersTable.id))
    .orderBy(desc(applicationsTable.updatedAt))
    .limit(10);

  res.json({
    totalApplications: totalApps[0]?.count ?? 0,
    pendingReview: pendingReview[0]?.count ?? 0,
    approvedThisMonth: approvedMonth[0]?.count ?? 0,
    totalClients: totalClients[0]?.count ?? 0,
    byDestination,
    byStatus,
    recentApplications: recentApps.map(({ app, user }) => ({
      id: app.id,
      userId: app.userId,
      applicantName: app.applicantName,
      destination: app.destination,
      visaType: app.visaType,
      status: app.status,
      appointmentDate: app.appointmentDate?.toISOString() ?? null,
      notes: app.notes ?? null,
      adminNotes: app.adminNotes ?? null,
      passportNumber: app.passportNumber ?? null,
      travelDate: app.travelDate?.toISOString() ?? null,
      returnDate: app.returnDate?.toISOString() ?? null,
      purpose: app.purpose ?? null,
      price: app.price ? Number(app.price) : null,
      isPaid: app.isPaid,
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
      user: user ? {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone ?? null,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      } : null,
      unreadCount: 0,
    })),
  });
});

router.get("/users", requireAdmin, async (_req: Request, res: Response) => {
  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(users.map(u => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone ?? null,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  })));
});

export default router;
