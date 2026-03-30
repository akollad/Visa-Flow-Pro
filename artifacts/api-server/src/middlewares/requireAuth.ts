import { type Request, type Response, type NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type AuthenticatedRequest = Request & {
  user: typeof usersTable.$inferSelect;
};

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req as Request & { signedCookies: Record<string, string> }).signedCookies?.userId;
  if (!userId) {
    res.status(401).json({ error: "unauthorized", message: "Not logged in" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId)));
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "User not found" });
    return;
  }
  (req as AuthenticatedRequest).user = user;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, () => {
    const authReq = req as AuthenticatedRequest;
    if (authReq.user?.role !== "admin") {
      res.status(403).json({ error: "forbidden", message: "Admin access required" });
      return;
    }
    next();
  });
}
