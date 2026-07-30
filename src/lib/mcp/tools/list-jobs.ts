import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_jobs",
  title: "List jobs",
  description:
    "List the signed-in user's jobs with status, schedule window, address and crew lead. Optionally filter by job status or scheduled date range.",
  inputSchema: {
    job_status: z
      .string()
      .optional()
      .describe("Filter by job status, e.g. Draft, Scheduled, Confirmed, In Progress, Completed."),
    starts_after: z.string().optional().describe("ISO date/time lower bound on start_datetime."),
    starts_before: z.string().optional().describe("ISO date/time upper bound on start_datetime."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ job_status, starts_after, starts_before, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    let query = supabaseForUser(ctx)
      .from("jobs")
      .select(
        "job_id, estimate_id, job_title, job_status, property_address, start_datetime, end_datetime, crew_lead_name, client_name, scheduling_ready, updated_at",
      )
      .order("start_datetime", { ascending: true, nullsFirst: false })
      .limit(limit ?? 25);

    if (job_status) query = query.eq("job_status", job_status);
    if (starts_after) query = query.gte("start_datetime", starts_after);
    if (starts_before) query = query.lte("start_datetime", starts_before);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, jobs: data ?? [] });
  },
});
