import { Router } from "express";
import { getUsageEvents } from "../services/usageStore.js";
import { getActiveProviderId } from "../services/providers/resolve.js";
import { apiErrorBody } from "../services/apiError.js";

export const usageRouter = Router();

usageRouter.get("/", async (_req, res) => {
  // Usage/cost tracking is OpenRouter-only: it is the only supported provider that publishes
  // per-token pricing and reports a real cost. With any other provider active the feature is
  // unavailable, so the endpoint refuses instead of returning a half-meaningful dashboard.
  const providerId = await getActiveProviderId();
  if (providerId !== "openrouter") {
    res.status(409).json(apiErrorBody("usage.openRouterOnly"));
    return;
  }
  res.json(await getUsageEvents());
});
