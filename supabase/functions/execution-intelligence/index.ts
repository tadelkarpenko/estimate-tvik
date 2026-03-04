import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADVISORY_SYSTEM_PROMPT = `You are an execution intelligence advisor for a construction contractor. 
You analyze contract financial state transitions and provide actionable advisory.

RULES:
- You are ADVISORY ONLY. You cannot modify any financial values.
- Focus on margin risk, opportunity, schedule compression, and liquidity strain.
- Be concise (3-5 bullet points max).
- Include confidence level (Low/Medium/High).
- Include impact level (Low/Medium/High/Critical).

Classify the contract into one of 4 quadrants:
- High Risk / High Opportunity
- High Risk / Low Opportunity  
- Low Risk / High Opportunity
- Stable

Output JSON only:
{
  "advisory_text": "Your advisory bullets as a single string",
  "margin_risk_score": 0-100,
  "margin_opportunity_score": 0-100,
  "execution_priority_score": 0-100,
  "risk_quadrant": "one of the 4 quadrants",
  "impact_level": "Low|Medium|High|Critical",
  "confidence": "Low|Medium|High"
}`;

// Debounce: max 1 advisory per contract per 10 minutes
const DEBOUNCE_MINUTES = 10;
const MAX_DAILY_ADVISORIES = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth check
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

    const { action, contract_id } = await req.json();

    if (action === "process_queue") {
      // Process unprocessed events for this user
      const { data: events, error: evErr } = await supabase
        .from("execution_events")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "Queued")
        .order("created_at", { ascending: true })
        .limit(10);

      if (evErr) throw evErr;
      if (!events || events.length === 0) {
        return new Response(JSON.stringify({ processed: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let processed = 0;

      // Group events by contract to batch
      const byContract = new Map<string, typeof events>();
      for (const ev of events) {
        const list = byContract.get(ev.contract_id) || [];
        list.push(ev);
        byContract.set(ev.contract_id, list);
      }

      for (const [cid, contractEvents] of byContract) {
        // Debounce check: any advisory in last DEBOUNCE_MINUTES?
        const cutoff = new Date(Date.now() - DEBOUNCE_MINUTES * 60 * 1000).toISOString();
        const { count: recentCount } = await supabase
          .from("execution_events")
          .select("*", { count: "exact", head: true })
          .eq("contract_id", cid)
          .eq("user_id", userId)
          .eq("status", "Completed")
          .gte("processed_at", cutoff);

        if ((recentCount || 0) > 0) {
          // Mark events as processed without AI call (debounced)
          for (const ev of contractEvents) {
            await supabase.from("execution_events").update({
              status: "Completed",
              processed_at: new Date().toISOString(),
              result_json: JSON.stringify({ debounced: true }),
            }).eq("id", ev.id);
            processed++;
          }
          continue;
        }

        // Daily limit check
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const { count: dailyCount } = await supabase
          .from("execution_events")
          .select("*", { count: "exact", head: true })
          .eq("contract_id", cid)
          .eq("user_id", userId)
          .eq("status", "Completed")
          .gte("processed_at", dayStart.toISOString())
          .not("result_json", "cs", '"debounced"');

        if ((dailyCount || 0) >= MAX_DAILY_ADVISORIES) {
          for (const ev of contractEvents) {
            await supabase.from("execution_events").update({
              status: "Completed",
              processed_at: new Date().toISOString(),
              result_json: JSON.stringify({ daily_limit_reached: true }),
            }).eq("id", ev.id);
            processed++;
          }
          continue;
        }

        // Fetch contract state
        const { data: contract } = await supabase
          .from("contracts")
          .select("*")
          .eq("id", cid)
          .single();

        if (!contract) {
          for (const ev of contractEvents) {
            await supabase.from("execution_events").update({
              status: "Failed",
              processed_at: new Date().toISOString(),
              result_json: JSON.stringify({ error: "Contract not found" }),
            }).eq("id", ev.id);
            processed++;
          }
          continue;
        }

        // State transition filter: check if thresholds crossed
        const latestEvent = contractEvents[contractEvents.length - 1];
        let payload: any = {};
        try { payload = JSON.parse(latestEvent.payload_json); } catch {}

        const shouldRunAI = checkStateTransition(contract, payload);

        if (!shouldRunAI) {
          for (const ev of contractEvents) {
            await supabase.from("execution_events").update({
              status: "Completed",
              processed_at: new Date().toISOString(),
              result_json: JSON.stringify({ no_transition: true }),
            }).eq("id", ev.id);
            processed++;
          }
          continue;
        }

        // Run AI advisory
        const aiPrompt = `Analyze this contract state and provide advisory:

Contract: ${contract.contract_id}
Status: ${contract.contract_status}
Baseline Value: $${contract.baseline_contract_value}
Net Value: $${contract.net_contract_value}
Percent Complete: ${contract.percent_complete}%
Projected Final Cost: $${contract.projected_final_cost}
Projected Profit: $${contract.projected_final_profit}
Baseline Margin: ${(contract.baseline_margin_pct * 100).toFixed(1)}%
Current Margin: ${(contract.margin_current_pct * 100).toFixed(1)}%
Profit Fade: ${contract.profit_fade_flag}
Cost Volatility Index: ${contract.cost_volatility_index}
Cash Forecast 30/60/90: $${contract.cash_forecast_30} / $${contract.cash_forecast_60} / $${contract.cash_forecast_90}

Trigger: ${latestEvent.event_type}
Previous risk score: ${payload.risk_score_before ?? 'N/A'}
Previous opportunity score: ${payload.opportunity_score_before ?? 'N/A'}`;

        try {
          const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: ADVISORY_SYSTEM_PROMPT },
                { role: "user", content: aiPrompt },
              ],
            }),
          });

          if (!aiResp.ok) {
            const errText = await aiResp.text();
            console.error("AI error:", aiResp.status, errText);
            for (const ev of contractEvents) {
              await supabase.from("execution_events").update({
                status: "Failed",
                processed_at: new Date().toISOString(),
                result_json: JSON.stringify({ error: `AI error ${aiResp.status}` }),
              }).eq("id", ev.id);
              processed++;
            }
            continue;
          }

          const aiResult = await aiResp.json();
          const content = aiResult.choices?.[0]?.message?.content || "";
          
          // Parse AI response
          let advisory: any = {};
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) advisory = JSON.parse(jsonMatch[0]);
          } catch {
            advisory = { advisory_text: content, confidence: "Low", impact_level: "Low" };
          }

          // Update contract with scores (advisory only - no financial fields)
          const contractUpdate: any = {};
          if (typeof advisory.margin_risk_score === "number") contractUpdate.margin_risk_score = advisory.margin_risk_score;
          if (typeof advisory.margin_opportunity_score === "number") contractUpdate.margin_opportunity_score = advisory.margin_opportunity_score;
          if (typeof advisory.execution_priority_score === "number") contractUpdate.execution_priority_score = advisory.execution_priority_score;
          if (advisory.risk_quadrant) contractUpdate.risk_quadrant = advisory.risk_quadrant;

          if (Object.keys(contractUpdate).length > 0) {
            await supabase.from("contracts").update(contractUpdate).eq("id", cid);
          }

          // Mark events completed
          for (const ev of contractEvents) {
            await supabase.from("execution_events").update({
              status: "Completed",
              processed_at: new Date().toISOString(),
              result_json: JSON.stringify(advisory),
            }).eq("id", ev.id);
            processed++;
          }
        } catch (aiErr) {
          console.error("AI call failed:", aiErr);
          for (const ev of contractEvents) {
            await supabase.from("execution_events").update({
              status: "Failed",
              processed_at: new Date().toISOString(),
              result_json: JSON.stringify({ error: String(aiErr) }),
            }).eq("id", ev.id);
            processed++;
          }
        }
      }

      return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "get_latest_advisory") {
      // Get the latest completed advisory for a contract
      const { data, error } = await supabase
        .from("execution_events")
        .select("*")
        .eq("contract_id", contract_id)
        .eq("user_id", userId)
        .eq("status", "Completed")
        .not("result_json", "cs", '"debounced"')
        .not("result_json", "cs", '"no_transition"')
        .not("result_json", "cs", '"daily_limit_reached"')
        .order("processed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return new Response(JSON.stringify({ advisory: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

  } catch (e) {
    console.error("execution-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * State transition filter: Only trigger AI advisory when meaningful thresholds are crossed.
 */
function checkStateTransition(contract: any, payload: any): boolean {
  // Always run on these event types
  const alwaysRun = ["contract_created", "margin_override", "contract_completed"];
  if (alwaysRun.includes(payload.event_type || "")) return true;

  // Margin category change
  const prevMargin = payload.margin_before ?? contract.margin_current_pct;
  const currMargin = contract.margin_current_pct;
  const marginCategory = (m: number) => m < 0.10 ? "critical" : m < 0.16 ? "warning" : m < 0.25 ? "normal" : "strong";
  if (marginCategory(prevMargin) !== marginCategory(currMargin)) return true;

  // Profit fade flag toggle
  if (payload.profit_fade_before !== undefined && payload.profit_fade_before !== contract.profit_fade_flag) return true;

  // Schedule compression threshold
  if (payload.delay_ratio_max && payload.delay_ratio_max > 1.15) return true;

  // Significant percent complete change (>10 pts)
  if (payload.percent_complete_before !== undefined) {
    const delta = Math.abs(contract.percent_complete - payload.percent_complete_before);
    if (delta >= 10) return true;
  }

  return false;
}
