import { Router, type IRouter, type Request, type Response } from "express";
import { db, applicationsTable, usersTable, messagesTable } from "@workspace/db";
import { eq, and, count, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  CreateApplicationBody,
  UpdateApplicationBody,
  ListApplicationsQueryParams,
  SendMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeApp(app: typeof applicationsTable.$inferSelect & { user?: typeof usersTable.$inferSelect | null; unreadCount?: number }) {
  return {
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
    user: app.user ? {
      id: app.user.id,
      email: app.user.email,
      firstName: app.user.firstName,
      lastName: app.user.lastName,
      phone: app.user.phone ?? null,
      role: app.user.role,
      createdAt: app.user.createdAt.toISOString(),
    } : null,
    unreadCount: app.unreadCount ?? 0,
  };
}

router.get("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const query = ListApplicationsQueryParams.safeParse(req.query);
  const page = query.success ? (query.data.page ?? 1) : 1;
  const limit = query.success ? (query.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (user.role !== "admin") {
    conditions.push(eq(applicationsTable.userId, user.id));
  }
  if (query.success && query.data.status) {
    conditions.push(eq(applicationsTable.status, query.data.status as typeof applicationsTable.$inferSelect["status"]));
  }
  if (query.success && query.data.destination) {
    conditions.push(eq(applicationsTable.destination, query.data.destination as typeof applicationsTable.$inferSelect["destination"]));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [apps, totalResult] = await Promise.all([
    db.select({
      app: applicationsTable,
      user: usersTable,
    })
      .from(applicationsTable)
      .leftJoin(usersTable, eq(applicationsTable.userId, usersTable.id))
      .where(whereClause)
      .orderBy(desc(applicationsTable.updatedAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(applicationsTable).where(whereClause),
  ]);

  const appsWithUnread = await Promise.all(apps.map(async ({ app, user: appUser }) => {
    const [unreadResult] = await db.select({ count: count() })
      .from(messagesTable)
      .where(and(
        eq(messagesTable.applicationId, app.id),
        eq(messagesTable.isRead, false),
        eq(messagesTable.isFromAdmin, user.role !== "admin"),
      ));
    return { ...app, user: appUser, unreadCount: unreadResult?.count ?? 0 };
  }));

  const total = totalResult[0]?.count ?? 0;
  res.json({
    applications: appsWithUnread.map(serializeApp),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }
  const data = parsed.data;
  const [app] = await db.insert(applicationsTable).values({
    userId: user.id,
    applicantName: data.applicantName,
    destination: data.destination as typeof applicationsTable.$inferSelect["destination"],
    visaType: data.visaType,
    status: "draft",
    passportNumber: data.passportNumber ?? null,
    travelDate: data.travelDate ? new Date(data.travelDate) : null,
    returnDate: data.returnDate ? new Date(data.returnDate) : null,
    purpose: data.purpose ?? null,
    notes: data.notes ?? null,
    isPaid: false,
  }).returning();

  res.status(201).json(serializeApp({ ...app, user, unreadCount: 0 }));
});

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const id = Number(req.params.id);
  const [result] = await db.select({ app: applicationsTable, user: usersTable })
    .from(applicationsTable)
    .leftJoin(usersTable, eq(applicationsTable.userId, usersTable.id))
    .where(eq(applicationsTable.id, id));

  if (!result) {
    res.status(404).json({ error: "not_found", message: "Application not found" });
    return;
  }
  if (user.role !== "admin" && result.app.userId !== user.id) {
    res.status(403).json({ error: "forbidden", message: "Access denied" });
    return;
  }

  const [unreadResult] = await db.select({ count: count() })
    .from(messagesTable)
    .where(and(
      eq(messagesTable.applicationId, id),
      eq(messagesTable.isRead, false),
      eq(messagesTable.isFromAdmin, user.role !== "admin"),
    ));

  res.json(serializeApp({ ...result.app, user: result.user, unreadCount: unreadResult?.count ?? 0 }));
});

router.patch("/:id", requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const parsed = UpdateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }
  const data = parsed.data;

  const updateData: Partial<typeof applicationsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (data.status !== undefined) updateData.status = data.status as typeof applicationsTable.$inferSelect["status"];
  if (data.appointmentDate !== undefined) updateData.appointmentDate = data.appointmentDate ? new Date(data.appointmentDate) : null;
  if (data.adminNotes !== undefined) updateData.adminNotes = data.adminNotes ?? null;
  if (data.price !== undefined) updateData.price = data.price ? String(data.price) : null;
  if (data.isPaid !== undefined) updateData.isPaid = data.isPaid;
  if (data.notes !== undefined) updateData.notes = data.notes ?? null;

  const [app] = await db.update(applicationsTable)
    .set(updateData)
    .where(eq(applicationsTable.id, id))
    .returning();

  if (!app) {
    res.status(404).json({ error: "not_found", message: "Application not found" });
    return;
  }

  const [userResult] = await db.select().from(usersTable).where(eq(usersTable.id, app.userId));
  res.json(serializeApp({ ...app, user: userResult, unreadCount: 0 }));
});

router.get("/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const id = Number(req.params.id);

  const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  if (!app) {
    res.status(404).json({ error: "not_found", message: "Application not found" });
    return;
  }
  if (user.role !== "admin" && app.userId !== user.id) {
    res.status(403).json({ error: "forbidden", message: "Access denied" });
    return;
  }

  const messages = await db.select({ msg: messagesTable, sender: usersTable })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.userId, usersTable.id))
    .where(eq(messagesTable.applicationId, id))
    .orderBy(messagesTable.createdAt);

  await db.update(messagesTable)
    .set({ isRead: true })
    .where(and(
      eq(messagesTable.applicationId, id),
      eq(messagesTable.isFromAdmin, user.role !== "admin"),
    ));

  res.json(messages.map(({ msg, sender }) => ({
    id: msg.id,
    applicationId: msg.applicationId,
    userId: msg.userId,
    content: msg.content,
    isFromAdmin: msg.isFromAdmin,
    isRead: msg.isRead,
    createdAt: msg.createdAt.toISOString(),
    senderName: sender ? `${sender.firstName} ${sender.lastName}` : "Inconnu",
  })));
});

router.post("/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const user = (req as AuthenticatedRequest).user;
  const id = Number(req.params.id);
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }

  const [app] = await db.select().from(applicationsTable).where(eq(applicationsTable.id, id));
  if (!app) {
    res.status(404).json({ error: "not_found", message: "Application not found" });
    return;
  }
  if (user.role !== "admin" && app.userId !== user.id) {
    res.status(403).json({ error: "forbidden", message: "Access denied" });
    return;
  }

  const [msg] = await db.insert(messagesTable).values({
    applicationId: id,
    userId: user.id,
    content: parsed.data.content,
    isFromAdmin: user.role === "admin",
    isRead: false,
  }).returning();

  await db.update(applicationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(applicationsTable.id, id));

  res.status(201).json({
    id: msg.id,
    applicationId: msg.applicationId,
    userId: msg.userId,
    content: msg.content,
    isFromAdmin: msg.isFromAdmin,
    isRead: msg.isRead,
    createdAt: msg.createdAt.toISOString(),
    senderName: `${user.firstName} ${user.lastName}`,
  });
});

export default router;
