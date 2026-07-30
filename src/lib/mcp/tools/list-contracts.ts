import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_contracts",
  title: "List contracts",
  description:
    "List the signed-in user's contracts with contract status, baseline and current financials, percent complete and margin health flags.",
  inputSchema: {
    contract_status: z.string().optional().describe("Filter by contract status."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ contract_status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    let query = supabaseForUser(ctx)
      .from("contracts")
      .select(
        "contract_id, estimate_id, contract_status, baseline_contract_value, baseline_margin_pct, net_contract_value, percent_complete, projected_final_cost, projected_final_profit, margin_current_pct, profit_fade_flag, risk_quadrant, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);

    if (contract_status) query = query.eq("contract_status", contract_status);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, contracts: data ?? [] });
  },
});
