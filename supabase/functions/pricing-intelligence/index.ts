import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const { action, estimate_db_id } = await req.json();

    if (action === "analyze_pricing") {
      // 1. Get completed line items across all contracts for this user (trade drift data)
      const { data: completedItems, error: liErr } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("user_id", userId)
        .eq("wip_status", "Completed")
        .gt("actual_labor_cost_to_date", 0);

      if (liErr) throw liErr;

      // 2. Get the current estimate's line items
      const { data: estimateItems, error: estErr } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate_db_id)
        .eq("user_id", userId);

      if (estErr) throw estErr;
      if (!estimateItems || estimateItems.length === 0) {
        return new Response(JSON.stringify({ suggestions: [], message: "No line items to analyze" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 3. Compute trade drift from completed items
      const tradeStats = new Map<string, { count: number; totalEstimated: number; totalActual: number; variances: number[] }>();
      for (const li of (completedItems || [])) {
        const trade = li.phase || "Other";
        const estimated = Number(li.labor_total) + Number(li.material_total);
        const actual = Number(li.actual_labor_cost_to_date) + Number(li.actual_material_cost_to_date);
        if (estimated <= 0) continue;

        const stats = tradeStats.get(trade) || { count: 0, totalEstimated: 0, totalActual: 0, variances: [] };
        stats.count++;
        stats.totalEstimated += estimated;
        stats.totalActual += actual;
        stats.variances.push((actual - estimated) / estimated);
        tradeStats.set(trade, stats);
      }

      // 4. Build drift context for AI
      const driftContext: any[] = [];
      for (const [trade, stats] of tradeStats) {
        const driftFactor = stats.totalEstimated > 0 ? stats.totalActual / stats.totalEstimated : 1;
        const avgVariance = stats.variances.reduce((a, b) => a + b, 0) / stats.variances.length;
        const stdDev = stats.variances.length > 1
          ? Math.sqrt(stats.variances.map(v => (v - avgVariance) ** 2).reduce((a, b) => a + b, 0) / stats.variances.length)
          : 0;
        driftContext.push({
          trade,
          sample_size: stats.count,
          drift_factor: Math.round(driftFactor * 1000) / 1000,
          avg_variance_pct: Math.round(avgVariance * 10000) / 100,
          volatility: Math.round(stdDev * 1000) / 1000,
        });
      }

      // 5. Prepare estimate items summary
      const itemsSummary = estimateItems.map(li => ({
        phase: li.phase,
        description: li.description,
        qty: Number(li.qty),
        unit: li.unit,
        labor_unit_cost: Number(li.labor_unit_cost),
        material_unit_cost: Number(li.material_unit_cost),
        labor_total: Number(li.labor_total),
        material_total: Number(li.material_total),
        line_total: Number(li.line_total),
      }));

      // 6. Call AI for pricing suggestions
      const prompt = `Analyze these estimate line items against historical trade drift data and generate pricing suggestions.

HISTORICAL TRADE DRIFT DATA (from completed contracts):
${JSON.stringify(driftContext, null, 2)}

CURRENT ESTIMATE LINE ITEMS:
${JSON.stringify(itemsSummary, null, 2)}

For each line item where drift data suggests the current pricing may be inaccurate, generate a suggestion.
Only suggest changes where drift data confidence is meaningful (sample_size >= 2).

Use the suggest_pricing tool to return your suggestions.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a construction pricing analyst for a GC/rehab contractor. 
Analyze trade drift data from completed contracts and suggest per-line pricing adjustments.
RULES:
- Only suggest changes backed by data (sample_size >= 2)
- Include confidence level based on sample size and volatility
- Show drift breakdown (labor vs material)
- Be conservative — suggest ranges, not exact numbers
- Never auto-apply — suggestions require manual review`,
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "suggest_pricing",
                description: "Return pricing suggestions for estimate line items based on trade drift analysis.",
                parameters: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          trade: { type: "string" },
                          description: { type: "string" },
                          current_labor_cost: { type: "number" },
                          current_material_cost: { type: "number" },
                          suggested_labor_low: { type: "number" },
                          suggested_labor_high: { type: "number" },
                          suggested_material_low: { type: "number" },
                          suggested_material_high: { type: "number" },
                          confidence: { type: "string", enum: ["Low", "Medium", "High"] },
                          drift_source: { type: "string" },
                          margin_impact_pct: { type: "number" },
                        },
                        required: ["trade", "description", "current_labor_cost", "current_material_cost", "suggested_labor_low", "suggested_labor_high", "suggested_material_low", "suggested_material_high", "confidence", "drift_source", "margin_impact_pct"],
                        additionalProperties: false,
                      },
                    },
                    summary: { type: "string" },
                  },
                  required: ["suggestions", "summary"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "suggest_pricing" } },
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        const errText = await aiResp.text();
        console.error("AI error:", status, errText);
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Payment required, please add credits." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI error ${status}`);
      }

      const aiResult = await aiResp.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      let suggestions: any = { suggestions: [], summary: "No suggestions generated" };

      if (toolCall?.function?.arguments) {
        try {
          suggestions = JSON.parse(toolCall.function.arguments);
        } catch {
          suggestions = { suggestions: [], summary: "Failed to parse AI response" };
        }
      }

      return new Response(JSON.stringify({
        suggestions: suggestions.suggestions || [],
        summary: suggestions.summary || "",
        drift_data: driftContext,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pricing-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
