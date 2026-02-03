import { initTRPC, TRPCError } from "@trpc/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";
import superjson from "superjson";

// DEVELOPMENT MODE: Use test user ID when no auth
const DEV_TEST_USER_ID = "dev_test_user_001";

export const createTRPCContext = async () => {
  let userId: string | null = null;

  try {
    const authResult = await auth();
    userId = authResult.userId;
  } catch (e) {
    // Auth failed - use dev user in development
    console.log("Auth failed, using dev user for testing");
  }

  return {
    prisma,
    userId,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Protected procedure - uses dev user if no auth (for mobile testing)
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  let userId = ctx.userId;
  let user = null;

  // DEVELOPMENT: If no userId, use test user
  if (!userId) {
    userId = DEV_TEST_USER_ID;

    // Try to find or create dev test user
    user = await ctx.prisma.user.findUnique({
      where: { id: DEV_TEST_USER_ID },
    });

    if (!user) {
      try {
        user = await ctx.prisma.user.create({
          data: {
            id: DEV_TEST_USER_ID,
            email: "dev@test.local",
            firstName: "Dev",
            lastName: "Tester",
          },
        });
      } catch (e) {
        // User might already exist from concurrent request
        user = await ctx.prisma.user.findUnique({
          where: { id: DEV_TEST_USER_ID },
        });
      }
    }
  } else {
    // Normal auth flow - find user in database
    user = await ctx.prisma.user.findUnique({
      where: { id: userId },
    });

    // If user doesn't exist, create them from Clerk data
    if (!user) {
      try {
        const clerkUser = await currentUser();
        if (clerkUser) {
          user = await ctx.prisma.user.create({
            data: {
              id: clerkUser.id,
              email: clerkUser.emailAddresses[0]?.emailAddress || "",
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              imageUrl: clerkUser.imageUrl,
            },
          });
        }
      } catch (e) {
        // Ignore clerk errors in dev
      }
    }
  }

  return next({
    ctx: {
      ...ctx,
      userId,
      user,
    },
  });
});

// Admin procedure - requires admin role
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !["ADMIN", "SUPER_ADMIN"].includes(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be an admin to access this resource",
    });
  }

  return next({ ctx });
});
