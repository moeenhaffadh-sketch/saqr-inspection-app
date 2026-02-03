import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";

export const inspectionRouter = router({
  // Get all authorities
  getAuthorities: publicProcedure
    .input(
      z.object({
        country: z.string().default("BH"),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.authority.findMany({
        where: { countryCode: input.country },
        include: {
          categories: {
            include: {
              _count: { select: { specs: true } },
            },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Get sites for the current user's organization or all sites if admin
  getSites: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { organizationId: true, role: true },
    });

    // Admins can see all sites
    if (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") {
      return ctx.prisma.site.findMany({
        include: { organization: true },
        orderBy: { name: "asc" },
      });
    }

    // Regular users see their organization's sites
    if (user?.organizationId) {
      return ctx.prisma.site.findMany({
        where: { organizationId: user.organizationId },
        include: { organization: true },
        orderBy: { name: "asc" },
      });
    }

    // No organization - return all sites for now (demo mode)
    return ctx.prisma.site.findMany({
      include: { organization: true },
      orderBy: { name: "asc" },
    });
  }),

  // Get dashboard stats
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [total, completed, inProgress, inspections] = await Promise.all([
      ctx.prisma.inspection.count({ where: { userId: ctx.userId } }),
      ctx.prisma.inspection.count({ where: { userId: ctx.userId, status: "COMPLETED" } }),
      ctx.prisma.inspection.count({ where: { userId: ctx.userId, status: "IN_PROGRESS" } }),
      ctx.prisma.inspection.findMany({
        where: { userId: ctx.userId, status: "COMPLETED", passRate: { not: null } },
        select: { passRate: true },
      }),
    ]);

    const avgPassRate =
      inspections.length > 0
        ? inspections.reduce((acc, i) => acc + (i.passRate || 0), 0) / inspections.length
        : 0;

    return {
      total,
      completed,
      inProgress,
      passRate: Math.round(avgPassRate),
    };
  }),

  // Get recent inspections for dashboard
  getRecent: protectedProcedure
    .input(z.object({ limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.inspection.findMany({
        where: { userId: ctx.userId },
        take: input.limit,
        orderBy: { createdAt: "desc" },
        include: {
          category: { include: { authority: true } },
          site: true,
        },
      });
    }),

  // Get all inspection categories
  getCategories: publicProcedure
    .input(
      z.object({
        country: z.string().default("BH"),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.inspectionCategory.findMany({
        where: {
          authority: {
            countryCode: input.country,
          },
        },
        include: {
          authority: true,
          _count: {
            select: { specs: true },
          },
        },
        orderBy: { name: "asc" },
      });
    }),

  // Get specs for a category
  getSpecs: publicProcedure
    .input(
      z.object({
        categoryId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.prisma.inspectionSpec.findMany({
        where: {
          categoryId: input.categoryId,
          isActive: true,
        },
        orderBy: { sortOrder: "asc" },
      });
    }),

  // Start a new inspection
  create: protectedProcedure
    .input(
      z.object({
        categoryId: z.string(),
        siteId: z.string().optional(),
        organizationId: z.string().optional(),
        gpsLatitude: z.number().optional(),
        gpsLongitude: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get specs count for this category
      const specsCount = await ctx.prisma.inspectionSpec.count({
        where: { categoryId: input.categoryId, isActive: true },
      });

      return ctx.prisma.inspection.create({
        data: {
          userId: ctx.userId,
          categoryId: input.categoryId,
          siteId: input.siteId,
          organizationId: input.organizationId,
          gpsLatitude: input.gpsLatitude,
          gpsLongitude: input.gpsLongitude,
          gpsVerified: !!(input.gpsLatitude && input.gpsLongitude),
          totalItems: specsCount,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        },
      });
    }),

  // Get user's inspections
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "IN_PROGRESS", "PENDING_REVIEW", "COMPLETED", "CANCELLED"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const inspections = await ctx.prisma.inspection.findMany({
        where: {
          userId: ctx.userId,
          status: input.status,
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          category: {
            include: { authority: true },
          },
          site: true,
          organization: true,
        },
      });

      let nextCursor: string | undefined;
      if (inspections.length > input.limit) {
        const nextItem = inspections.pop();
        nextCursor = nextItem!.id;
      }

      return { inspections, nextCursor };
    }),

  // Get single inspection with results
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.inspection.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        include: {
          category: {
            include: {
              authority: true,
              specs: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          site: true,
          organization: true,
          results: {
            include: { spec: true },
          },
        },
      });
    }),

  // Save inspection result
  saveResult: protectedProcedure
    .input(
      z.object({
        inspectionId: z.string(),
        specId: z.string(),
        status: z.enum(["PASS", "FAIL", "UNCERTAIN", "SKIPPED"]).optional(),
        notes: z.string().optional(),
        photoUrl: z.string().optional(),
        documentUrl: z.string().optional(),
        aiAnalyzed: z.boolean().optional(),
        aiConfidence: z.number().optional(),
        aiReasoning: z.string().optional(),
        aiReasoningAr: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { inspectionId, specId, ...data } = input;

      // Verify ownership
      const inspection = await ctx.prisma.inspection.findFirst({
        where: { id: inspectionId, userId: ctx.userId },
      });

      if (!inspection) {
        throw new Error("Inspection not found");
      }

      return ctx.prisma.inspectionResult.upsert({
        where: {
          inspectionId_specId: { inspectionId, specId },
        },
        create: {
          inspectionId,
          specId,
          ...data,
        },
        update: data,
      });
    }),

  // Complete inspection
  complete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inspection = await ctx.prisma.inspection.findFirst({
        where: { id: input.id, userId: ctx.userId },
        include: { results: true },
      });

      if (!inspection) {
        throw new Error("Inspection not found");
      }

      const passedItems = inspection.results.filter((r) => r.status === "PASS").length;
      const failedItems = inspection.results.filter((r) => r.status === "FAIL").length;
      const total = inspection.results.length;

      return ctx.prisma.inspection.update({
        where: { id: input.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          passedItems,
          failedItems,
          totalItems: total,
          passRate: total > 0 ? (passedItems / total) * 100 : 0,
        },
      });
    }),

  // Get completed inspections for reports
  getCompletedForReports: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.inspection.findMany({
      where: {
        userId: ctx.userId,
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      include: {
        category: {
          include: { authority: true },
        },
        site: true,
        organization: true,
      },
    });
  }),

  // Get full inspection data for PDF generation
  getForPDF: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.inspection.findFirst({
        where: {
          id: input.id,
          userId: ctx.userId,
        },
        include: {
          category: {
            include: {
              authority: true,
              specs: {
                where: { isActive: true },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          site: true,
          organization: true,
          results: {
            include: { spec: true },
          },
        },
      });
    }),
});
