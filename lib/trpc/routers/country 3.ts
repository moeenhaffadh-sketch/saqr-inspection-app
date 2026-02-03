import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const countryRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const countries = await ctx.prisma.country.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return countries;
  }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      const country = await ctx.prisma.country.findUnique({
        where: { code: input.code },
        include: {
          authorities: {
            include: {
              categories: true,
            },
          },
        },
      });
      return country;
    }),
});
