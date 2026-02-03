import { router, adminProcedure, protectedProcedure } from "../trpc";

export const adminRouter = router({
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const [
      totalInspections,
      activeSessions,
      totalOrganizations,
      totalUsers,
    ] = await Promise.all([
      ctx.prisma.inspection.count(),
      ctx.prisma.remoteSession.count({
        where: {
          status: { in: ["WAITING", "CONNECTED", "IN_PROGRESS"] },
        },
      }),
      ctx.prisma.organization.count(),
      ctx.prisma.user.count(),
    ]);

    return {
      totalInspections,
      activeSessions,
      totalOrganizations,
      totalUsers,
    };
  }),
});
