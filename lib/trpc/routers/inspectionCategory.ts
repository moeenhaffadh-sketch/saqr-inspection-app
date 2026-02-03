import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const inspectionCategoryRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const categories = await ctx.prisma.inspectionCategory.findMany({
      include: {
        authority: true,
      },
      orderBy: { name: "asc" },
    });
    return categories;
  }),

  getByCountry: publicProcedure
    .input(z.object({ countryCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const categories = await ctx.prisma.inspectionCategory.findMany({
        where: {
          authority: {
            countryCode: input.countryCode,
          },
        },
        include: {
          authority: true,
        },
        orderBy: { name: "asc" },
      });
      return categories;
    }),

  getByAuthority: publicProcedure
    .input(z.object({ authorityId: z.string() }))
    .query(async ({ ctx, input }) => {
      const categories = await ctx.prisma.inspectionCategory.findMany({
        where: {
          authorityId: input.authorityId,
        },
        include: {
          authority: true,
        },
        orderBy: { name: "asc" },
      });
      return categories;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.prisma.inspectionCategory.findUnique({
        where: { id: input.id },
        include: {
          authority: true,
          specs: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
      return category;
    }),
});
