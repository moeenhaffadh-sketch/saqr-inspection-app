import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const authorityRouter = router({
  getByCountry: publicProcedure
    .input(z.object({ countryCode: z.string() }))
    .query(async ({ ctx, input }) => {
      const authorities = await ctx.prisma.authority.findMany({
        where: {
          countryCode: input.countryCode,
        },
        include: {
          categories: true,
        },
        orderBy: { name: "asc" },
      });
      return authorities;
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const authority = await ctx.prisma.authority.findUnique({
        where: { id: input.id },
        include: {
          categories: true,
          country: true,
        },
      });
      return authority;
    }),
});
