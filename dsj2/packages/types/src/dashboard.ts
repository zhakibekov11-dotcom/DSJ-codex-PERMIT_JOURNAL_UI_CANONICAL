import { z } from "zod";

export const dashboardMetricSchema = z.object({
  label: z.string(),
  value: z.number(),
  deltaLabel: z.string(),
  tone: z.enum(["neutral", "positive", "warning", "danger"]),
});

export const dashboardSummarySchema = z.object({
  metrics: z.array(dashboardMetricSchema),
  overdueRepeatBriefings: z.number(),
  unsignedRecords: z.number(),
  readyForSigning: z.number(),
  expiringActions: z.number(),
});

export type DashboardMetric = z.infer<typeof dashboardMetricSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

