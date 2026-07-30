import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "get_estimate",
  title: "Get estimate detail",
  description:
    "Get one estimate by its estimate_id, including scope, totals, risk numbers and its line items grouped by phase.",
  inputSchema: {
    estimate_id: z.string().trim().min(1).describe("The estimate_id, e.g. EST-0014."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ estimate_id }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const { data: estimate, error } = await supabase
      .from("estimates")
      .select(
        "estimate_id, project_name, client_name, client_email, project_address, city, state, zip, status, project_type, project_category, scope_class, job_complexity, sqft, finish_level, included_trades, labor_subtotal, material_subtotal, subtotal, risk_cost_low, risk_cost_high, overall_risk_level, overhead_pct, profit_pct, contingency_pct, total_low, total_high, version, last_revision_summary, completeness_score, calc_status, ai_scope, public_notes, updated_at",
      )
      .eq("estimate_id", estimate_id)
      .maybeSingle();

    if (error) return errorResult(error.message);
    if (!estimate) return errorResult(`No estimate found with estimate_id ${estimate_id}.`);

    const { data: lines, error: linesError } = await supabase
      .from("estimate_line_items")
      .select(
        "line_id, phase, description, unit, qty, labor_total, material_total, line_total, source, locked",
      )
      .eq("estimate_id", estimate_id)
      .order("phase", { ascending: true });

    if (linesError) return errorResult(linesError.message);

    return jsonResult({ estimate, line_items: lines ?? [], line_item_count: lines?.length ?? 0 });
  },
});
