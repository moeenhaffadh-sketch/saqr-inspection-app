import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";

export const userRouter = router({
  // Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: ctx.userId },
        data: input,
      });
    }),

  // Admin: List all users
  list: adminProcedure
    .input(
      z.object({
        role: z.enum(["USER", "INSPECTOR", "ADMIN", "SUPER_ADMIN"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.user.findMany({
        where: input.role ? { role: input.role } : undefined,
        take: input.limit,
        orderBy: { createdAt: "desc" },
        include: {
          organization: true,
          _count: {
            select: { inspections: true },
          },
        },
      });
    }),

  // Admin: Update user role
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.enum(["USER", "INSPECTOR", "ADMIN", "SUPER_ADMIN"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only super admins can create other admins
      if (
        input.role === "SUPER_ADMIN" &&
        ctx.user?.role !== "SUPER_ADMIN"
      ) {
        throw new Error("Only super admins can assign super admin role");
      }

      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
      });
    }),
});
