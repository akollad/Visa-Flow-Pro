import { query } from "./_generated/server";

function getRole(identity: { [key: string]: unknown } | null): string {
  if (!identity) return "client";
  return (identity.role as string) || "client";
}

export const getStats = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || getRole(identity as Record<string, unknown>) !== "admin") {
      return null;
    }

    const all = await ctx.db.query("applications").collect();
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    ).getTime();

    const uniqueUserIds = new Set(all.map((a) => a.userId));

    const byDestination = all.reduce(
      (acc, a) => {
        acc[a.destination] = (acc[a.destination] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const recentApplications = [...all]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10)
      .map((a) => ({
        _id: a._id,
        applicantName: a.applicantName,
        destination: a.destination,
        visaType: a.visaType,
        status: a.status,
        updatedAt: a.updatedAt,
      }));

    return {
      totalApplications: all.length,
      pendingReview: all.filter((a) => a.status === "in_review").length,
      approvedThisMonth: all.filter(
        (a) => a.status === "approved" && a.updatedAt >= startOfMonth
      ).length,
      totalClients: uniqueUserIds.size,
      byDestination,
      recentApplications,
    };
  },
});

export const listClients = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity || getRole(identity as Record<string, unknown>) !== "admin") {
      return [];
    }

    const all = await ctx.db.query("applications").collect();

    const clientMap = new Map<
      string,
      {
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        applicationCount: number;
        firstSeen: number;
      }
    >();

    for (const app of all) {
      if (!clientMap.has(app.userId)) {
        clientMap.set(app.userId, {
          userId: app.userId,
          firstName: app.userFirstName || "",
          lastName: app.userLastName || "",
          email: app.userEmail || "",
          applicationCount: 1,
          firstSeen: app._creationTime,
        });
      } else {
        const existing = clientMap.get(app.userId)!;
        existing.applicationCount += 1;
        if (app._creationTime < existing.firstSeen) {
          existing.firstSeen = app._creationTime;
        }
      }
    }

    return Array.from(clientMap.values()).sort(
      (a, b) => a.firstSeen - b.firstSeen
    );
  },
});
