import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword } from "../lib/auth";
import {
  RegisterUserBody,
  LoginUserBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone ?? null,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

router.get("/me", async (req: Request, res: Response) => {
  const userId = req.signedCookies?.userId;
  if (!userId) {
    res.status(401).json({ error: "unauthorized", message: "Not logged in" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, Number(userId)));
  if (!user) {
    res.status(401).json({ error: "unauthorized", message: "User not found" });
    return;
  }
  res.json(serializeUser(user));
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }
  const { email, password, firstName, lastName, phone } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "email_taken", message: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    firstName,
    lastName,
    phone: phone ?? null,
    role: "client",
  }).returning();

  res.cookie("userId", String(user.id), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  res.status(201).json({ user: serializeUser(user), token: String(user.id) });
});

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }
  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "invalid_credentials", message: "Email ou mot de passe incorrect" });
    return;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "invalid_credentials", message: "Email ou mot de passe incorrect" });
    return;
  }

  res.cookie("userId", String(user.id), {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  res.json({ user: serializeUser(user), token: String(user.id) });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("userId");
  res.json({ message: "Déconnexion réussie" });
});

export default router;
