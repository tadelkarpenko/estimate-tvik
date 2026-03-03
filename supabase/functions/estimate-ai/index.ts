import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userContent = "";

    if (action === "scope") {
      systemPrompt = `You are a senior preconstruction estimator for TVIK LLC. Produce an advisory-grade scope document based on provided JSON inputs. Follow the required headings exactly. Do not invent scope that contradicts inputs. Respect finish_materials_included flag.

REQUIRED HEADINGS (in this order):
1 Executive Summary
2 Scope by Trades
3 Allowances & Owner Items
4 Assumptions
5 Risk Notes
6 Next Steps

RULES:
- Use short bullets.
- Mention labor/material split and Low–High range.
- In "Allowances & Owner Items": if finish_materials_included=false, state that finish materials are excluded and list excluded categories (paint/tile/flooring consumables/decorative fixtures).
- In "Risk Notes": explicitly reference the risks provided.
- Mirror assumptions_rich content (do not contradict).
- Tone: professional, contractor-ready, concise.`;

      userContent = JSON.stringify(data);

    } else if (action === "audit") {
      systemPrompt = `You are a construction cost auditor for TVIK LLC. Your job is to identify pricing anomalies and recommend corrective actions. You MUST NOT change numbers. You only recommend.

OUTPUT FORMAT:
A) Findings (bullets) — include numbers and thresholds
B) Likely Causes (bullets)
C) Recommended Actions (bullets) — choose from:
   - adjust specific trade unit costs
   - add missing line item(s)
   - update CostLibrary row(s)
   - justify as unique site conditions
D) What NOT to change (1 bullet)

RULES:
- Quantify: show cost_per_sqft vs historical_avg and % deviation.
- Flag top 1–3 trades by share.
- If no anomalies: state "No material anomalies detected."`;

      userContent = JSON.stringify(data);
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, text);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("estimate-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
