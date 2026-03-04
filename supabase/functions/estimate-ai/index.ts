import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHAT_SYSTEM_PROMPT = `You are TVIK LLC Estimator Assistant.

Rules:
- Never change totals directly.
- Never invent measurements.
- If missing info: ask questions or propose TBD/Allowance rows.
- Any ADD_LINE_ITEM must become a new line item row with: trade, description, unit, qty, unit costs (or TBD), confidence, evidence_source.
- Mark anything uncertain as pending_confirmation=true and locked=true.
- Output actions in JSON only (SuggestedChanges format).

You MUST respond with a JSON block wrapped in \`\`\`json ... \`\`\` containing the SuggestedChanges object:
{
  "meta": { "confidence": "Low|Medium|High", "evidence_sources": ["Chat"], "notes": "brief" },
  "conditional_questions": [{ "question": "text", "why_it_matters": "text", "answer_type": "YesNo|Number|Picklist|Text" }],
  "actions": [{
    "type": "ADD_LINE_ITEM|MODIFY_QTY|MODIFY_UNIT_COST|ADD_RISK|ADD_ALLOWANCE|SCOPE_CLARIFICATION",
    "trade": "text", "description": "text", "unit": "ea|sf|lf|hr|day|lump_sum",
    "qty": 0, "labor_unit_cost": null, "material_unit_cost": null,
    "allowance_low": null, "allowance_high": null,
    "requires_confirmation": true, "pending_confirmation": true,
    "confidence": "Low|Medium|High", "evidence_source": "Chat|Photo|CostLibraryGap",
    "rationale": "text"
  }]
}

You may also include a brief conversational explanation BEFORE the JSON block. Always include the JSON block.`;

const PHOTO_ANALYSIS_PROMPT = `You are TVIK LLC Photo Analysis AI. Analyze the construction photo and return ONLY a JSON object:
{
  "observed_conditions": "factual description of what you see",
  "suggested_scope_impacts": "what work might be needed based on conditions",
  "risk_flags": "potential risks or concerns",
  "recommended_allowance_range": "dollar range if applicable",
  "ai_confidence": "Low|Medium|High",
  "questions_needed": [
    {"question": "text", "why_it_matters": "text", "answer_type": "YesNo|Number|Picklist|Text"}
  ]
}

If the photo appears to be a bathroom/shower, also include these questions:
- Pan type (mud / preform / TBD)?
- Waterproofing system (Kerdi / liquid / TBD)?
- Exterior wall? Insulation required?
- Drain type known? (clamping/linear/TBD)
- Tile height (7ft/8ft/ceiling)?
- Niche(s) count?
- Glass included?
- Plumbing rough complete?
- Subfloor replace needed?

Be factual. Do not invent measurements.`;

const PHOTO_CONVERT_PROMPT = `You are TVIK LLC Photo-to-LineItem Converter. Given photo analysis, clarification answers, and project context, generate SuggestedChanges actions.

Rules:
- Any unknown dimension/quantity → use Allowance or TBD row
- Do NOT invent tile quantities. If tile area not confirmed → propose "Tile install — TBD SF" as pending row
- confidence must be Low if dimensions not confirmed
- All items must have pending_confirmation=true
- evidence_source must be "Photo"

Output ONLY a JSON object in SuggestedChanges format (same as chat assistant).`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let messages: { role: string; content: string | any[] }[] = [];

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
- In "Allowances & Owner Items": if finish_materials_included=false, state that finish materials are excluded and list excluded categories.
- In "Risk Notes": explicitly reference the risks provided.
- Mirror assumptions_rich content (do not contradict).
- Tone: professional, contractor-ready, concise.`;
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(data) },
      ];

    } else if (action === "audit") {
      systemPrompt = `You are a construction cost auditor for TVIK LLC. Identify pricing anomalies and recommend corrective actions. You MUST NOT change numbers. You only recommend.

OUTPUT FORMAT:
A) Findings (bullets) — include numbers and thresholds
B) Likely Causes (bullets)
C) Recommended Actions (bullets)
D) What NOT to change (1 bullet)

RULES:
- Quantify: show cost_per_sqft vs historical_avg and % deviation.
- Flag top 1–3 trades by share.
- If no anomalies: state "No material anomalies detected."`;
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(data) },
      ];

    } else if (action === "chat") {
      // Streaming chat for estimator assistant
      const chatMessages = data.messages || [];
      const contextMsg = data.context ? `\n\nEstimate context:\n${JSON.stringify(data.context)}` : '';
      messages = [
        { role: "system", content: CHAT_SYSTEM_PROMPT + contextMsg },
        ...chatMessages,
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          stream: true,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        const t = await response.text();
        console.error("AI gateway error:", status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });

    } else if (action === "photo_analyze") {
      messages = [
        { role: "system", content: PHOTO_ANALYSIS_PROMPT },
        { role: "user", content: [
          { type: "text", text: `Analyze this construction photo. Caption: ${data.caption || 'No caption'}. Project type: ${data.project_type || 'Unknown'}.` },
          { type: "image_url", image_url: { url: data.image_url } },
        ]},
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI gateway error:", status, await response.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "photo_convert") {
      const prompt = `Photo analysis:\n${JSON.stringify(data.analysis)}\n\nClarification answers:\n${JSON.stringify(data.clarification_answers)}\n\nProject context:\n- Type: ${data.project_type}\n- SqFt: ${data.sqft}\n- Fixtures: ${data.fixture_count}\n- Finish: ${data.finish_level}\n\nExisting line items summary:\n${data.existing_items_summary || 'None'}`;
      messages = [
        { role: "system", content: PHOTO_CONVERT_PROMPT },
        { role: "user", content: prompt },
      ];

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI gateway error:", status, await response.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Non-streaming path (scope, audit)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI gateway error:", status, await response.text());
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ content }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("estimate-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
