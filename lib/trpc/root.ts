import { router } from "./trpc";
import { inspectionRouter } from "./routers/inspection";
import { userRouter } from "./routers/user";
import { countryRouter } from "./routers/country";
import { authorityRouter } from "./routers/authority";
import { inspectionCategoryRouter } from "./routers/inspectionCategory";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  inspection: inspectionRouter,
  user: userRouter,
  country: countryRouter,
  authority: authorityRouter,
  inspectionCategory: inspectionCategoryRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
