import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "search_cost_library",
  title: "Search cost library",
  description:
    "Search the signed-in user's Cost Library reference pricing by trade, project type or description text.",
  inputSchema: {
    trade: z.string().optional().describe("Filter by trade/phase, e.g. Framing, Drywall."),
    project_type: z.string().optional().describe("Filter by project type, e.g. Bath, Kitchen, Full Rehab."),
    search: z.string().optional().describe("Case-insensitive match on the item description."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ trade, project_type, search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    let query = supabaseForUser(ctx)
      .from("cost_library")
      .select(
        "id, trade, project_type, description, unit_label, qty_rule, labor_unit_cost, material_unit_cost, labor_hours_per_unit, default_included, active, last_updated",
      )
      .order("trade", { ascending: true })
      .limit(limit ?? 25);

    if (trade) query = query.eq("trade", trade);
    if (project_type) query = query.eq("project_type", project_type);
    if (search) query = query.ilike("description", `%${search}%`);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, items: data ?? [] });
  },
});
