import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function getRole(identity: { [key: string]: unknown } | null): string {
  if (!identity) return "client";
  return (identity.role as string) || "client";
}

export const list = query({
  args: { applicationId: v.id("applications") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const app = await ctx.db.get(args.applicationId);
    if (!app) return [];

    const isAdmin = getRole(identity as Record<string, unknown>) === "admin";
    if (!isAdmin && app.userId !== identity.subject) return [];

    return ctx.db
      .query("messages")
      .withIndex("by_application", (q) =>
        q.eq("applicationId", args.applicationId)
      )
      .order("asc")
      .collect();
  },
});

export const send = mutation({
  args: {
    applicationId: v.id("applications"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const app = await ctx.db.get(args.applicationId);
    if (!app) throw new Error("Application not found");

    const isAdmin = getRole(identity as Record<string, unknown>) === "admin";
    if (!isAdmin && app.userId !== identity.subject)
      throw new Error("Unauthorized");

    const senderName = isAdmin
      ? "Joventy (Admin)"
      : `${identity.givenName || ""} ${identity.familyName || ""}`.trim() ||
        identity.email ||
        "Client";

    await ctx.db.insert("messages", {
      applicationId: args.applicationId,
      senderId: identity.subject,
      senderName,
      content: args.content,
      isFromAdmin: isAdmin,
    });

    await ctx.db.patch(args.applicationId, { updatedAt: Date.now() });
  },
});
