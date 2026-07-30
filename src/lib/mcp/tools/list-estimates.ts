import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_estimates",
  title: "List estimates",
  description:
    "List the signed-in user's estimates with status, client, project name and totals. Optionally filter by status or search text.",
  inputSchema: {
    status: z
      .string()
      .optional()
      .describe("Filter by estimate status, e.g. Draft, Ready, Sent, Accepted."),
    search: z
      .string()
      .optional()
      .describe("Case-insensitive match on project name or client name."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    let query = supabaseForUser(ctx)
      .from("estimates")
      .select(
        "estimate_id, project_name, client_name, status, project_type, project_category, city, state, sqft, subtotal, total_low, total_high, version, completeness_score, calc_status, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);

    if (status) query = query.eq("status", status);
    if (search) query = query.or(`project_name.ilike.%${search}%,client_name.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, estimates: data ?? [] });
  },
});
