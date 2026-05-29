import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const stringField = (value: unknown, fallback = "Unknown") =>
  typeof value === "string" && value.trim() ? value : fallback;

const formatProjectClassification = (data: Record<string, unknown>) => [
  `Project type: ${stringField(data.project_type)}`,
  `Project category: ${stringField(data.project_category)}`,
  `Scope class: ${stringField(data.scope_class)}`,
  `Job size / complexity: ${stringField(data.job_complexity)}`,
  data.project_classification_summary
    ? `Classification summary: ${stringField(data.project_classification_summary)}`
    : "",
].filter(Boolean).join("\n");

const CHAT_SYSTEM_PROMPT = `You are TVIK LLC Estimator Assistant.

Rules:
- Never change totals directly.
- Never invent measurements.
- If missing info: ask questions or propose TBD/Allowance rows.
- Any ADD_LINE_ITEM must become a new line item row with: phase, description, unit, qty, unit costs (or TBD), confidence, evidence_source.
- Mark anything uncertain as pending_confirmation=true and locked=true.
- Output actions in JSON only (SuggestedChanges format).

PHASE LIST (use ONLY these values for phase):
Demo, Framing, Drywall, Paint, Flooring, Electrical, Plumbing, HVAC, Kitchen, Bathroom, Permits/Fees, Cleanup/Trash, Other

Phase mapping rules:
- demo/remove/tear out → Demo
- stud/blocking/joist → Framing
- hang/tape/mud → Drywall
- prime/paint → Paint
- LVP/tile/carpet → Flooring
- GFCI/switch/outlet/circuit/panel → Electrical
- valve/drain/supply/PEX → Plumbing
- furnace/AC/duct → HVAC
- cabinets/counters/appliances → Kitchen
- shower/tub/vanity/waterproof → Bathroom
- permit/inspection/fees → Permits/Fees
- trash/dumpster/cleanup → Cleanup/Trash

You MUST respond with a JSON block wrapped in \`\`\`json ... \`\`\` containing the SuggestedChanges object:
{
  "SuggestedChanges": [
    {
      "type": "ADD_LINE_ITEM",
      "target": "Estimate",
      "phase": "Electrical",
      "description": "Allowance: Electrical work (pending scope)",
      "unit": "lump_sum",
      "qty": 1,
      "labor_unit_cost": 0,
      "material_unit_cost": 1000,
      "include_in_public_pdf": true,
      "notes": "Allowance range: $500–$1500. Requires fixture count.",
      "confidence": "Low|Medium|High",
      "evidence_source": "Chat"
    }
  ],
  "QuestionsNeeded": [
    "Mud pan vs acrylic base?",
    "Is the uninsulated wall exterior?"
  ],
  "Confidence": "Medium"
}

IMPORTANT: You may also use the legacy format with "actions" array and types like ADD_LINE_ITEM, MODIFY_QTY, etc. Both formats are supported.
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

const INTAKE_SYSTEM_PROMPT = `You are TVIK LLC AI Intake Assistant — a structured construction estimator copilot.

Your job is to analyze project information (text descriptions, notes, and photo analyses) and produce a STRUCTURED intake report. You are NOT a casual chatbot. You are a professional scope intake tool.

CRITICAL RULES:
- Distinguish visible facts from assumptions. Label assumptions as "Needs Verification".
- Never invent measurements. Use "TBD", "Allowance", or "Needs Verification" when uncertain.
- Never finalize prices or quantities from unclear information.
- Ask targeted follow-up questions when information is missing.
- Recommend site visit when confidence is Low.
- All output is DRAFT — label it clearly as requiring human review.

You MUST respond with a JSON object (no markdown wrapping):
{
  "visible_findings": "Bullet list of factual observations from photos/description",
  "likely_scope_items": "Bullet list of probable work items based on evidence",
  "possible_hidden_risks": "Bullet list of risks that may exist but aren't confirmed",
  "missing_info_questions": "Numbered list of follow-up questions to ask",
  "suggested_trades": "Comma-separated list of trades likely involved",
  "suggested_allowances": "Bullet list of recommended allowances",
  "suggested_exclusions": "Bullet list of recommended exclusions",
  "suggested_assumptions": "Bullet list of recommended assumptions",
  "suggested_line_items": "Bullet list of draft line item descriptions (no final pricing)",
  "site_visit_required": true or false,
  "confidence": "High or Medium or Low",
  "intake_summary": "2-3 sentence executive summary of what was found"
}

CONFIDENCE RULES:
- High = scope mostly visible, simple project, clear photos
- Medium = useful clues exist but clarification needed on key items  
- Low = insufficient evidence, likely hidden conditions, blurry/unclear photos
- If Low, set site_visit_required to true

For WORKFLOW modes:
- "intake_fresh": Starting from scratch. Focus on asking questions, identifying visible scope, flagging missing info.
- "completeness_check": Draft exists. Compare against photos/notes, find gaps, suggest allowances/exclusions/assumptions.
- "revision_check": New photos added. Compare new info vs existing, flag if revision may be needed.`;

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

    } else if (action === "initial_intake") {
      // Patch 3: Estimate-level Initial Intake — structured extraction via tool calling
      const userPrompt = `${formatProjectClassification(data)}
Description: ${data.typed_description || data.description || 'None provided'}
Customer goal: ${data.customer_goal || 'Not specified'}
Urgency: ${data.urgency || 'Not specified'}
Existing status: ${data.existing_status || 'Draft'}
Square footage: ${data.sqft || 'Unknown'}
Finish level: ${data.finish_level || 'Unknown'}
Address: ${data.project_address || 'Not provided'}
Additional notes: ${data.notes || 'None'}`;

      const initialIntakeSystemPrompt = `You are TVIK LLC AI Intake Assistant — a structured construction estimator copilot for initial project intake.

Your job is to take a rough typed project description and convert it into a structured first-pass estimating support report.

CRITICAL RULES:
- You are a STRUCTURED EXTRACTOR, not a chatbot.
- Distinguish visible facts from assumptions. Label assumptions as "Needs Verification".
- Never invent measurements. Use "TBD", "Allowance", or "Needs Verification" when uncertain.
- Never finalize prices or quantities.
- Generate only 3-5 high-value follow-up questions that materially affect scope.
- Keep confidence conservative.
- Only suggest queue items when there is enough evidence from the typed description.

CONFIDENCE RULES:
- High = clear description, simple project, sufficient detail
- Medium = useful clues but clarification needed on key items
- Low = insufficient detail, vague description, likely hidden conditions

Call the extract_initial_intake function with the structured output.`;

      const toolCallBody = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: initialIntakeSystemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_initial_intake",
              description: "Extract structured initial intake from a rough project description.",
              parameters: {
                type: "object",
                properties: {
                  summary_of_request: { type: "string", description: "2-3 sentence executive summary of what the client needs" },
                  probable_work_categories: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of probable work categories (e.g. Demo, Framing, Plumbing)"
                  },
                  likely_trades: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of trades likely needed (e.g. Electrician, Plumber, GC)"
                  },
                  obvious_unknowns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Things clearly missing or unknown from the description"
                  },
                  next_questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        why_it_matters: { type: "string" }
                      },
                      required: ["question", "why_it_matters"],
                      additionalProperties: false
                    },
                    description: "3-5 high-value follow-up questions"
                  },
                  review_queue_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        suggestion_type: { type: "string", enum: ["allowance", "missing_info", "internal_note", "risk_note", "trade_detection"] },
                        suggested_value: { type: "string" },
                        apply_target: { type: "string" },
                        confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                        evidence_summary: { type: "string" },
                        reason_for_suggestion: { type: "string" }
                      },
                      required: ["suggestion_type", "suggested_value", "confidence", "evidence_summary", "reason_for_suggestion"],
                      additionalProperties: false
                    },
                    description: "Optional queue items only when evidence supports them"
                  },
                  confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                  site_visit_recommended: { type: "boolean" }
                },
                required: ["summary_of_request", "probable_work_categories", "likely_trades", "obvious_unknowns", "next_questions", "review_queue_items", "confidence", "site_visit_recommended"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_initial_intake" } },
      };

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(toolCallBody),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI gateway error:", status, await response.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const result = await response.json();
      // Extract tool call arguments
      const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
      let structured: any = {};
      if (toolCall?.function?.arguments) {
        try {
          structured = typeof toolCall.function.arguments === 'string'
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
        } catch {
          structured = { summary_of_request: "Failed to parse AI response", probable_work_categories: [], likely_trades: [], obvious_unknowns: [], next_questions: [], review_queue_items: [], confidence: "Low", site_visit_recommended: true };
        }
      } else {
        // Fallback: try parsing content directly
        const content = result.choices?.[0]?.message?.content || "";
        try {
          structured = JSON.parse(content);
        } catch {
          structured = { summary_of_request: content || "No structured output", probable_work_categories: [], likely_trades: [], obvious_unknowns: [], next_questions: [], review_queue_items: [], confidence: "Low", site_visit_recommended: true };
        }
      }

      return new Response(JSON.stringify({ structured }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "area_photo_analysis") {
      // Patch 5: Structured photo analysis block — extraction only, no pricing
      const areaPhotoSystemPrompt = `You are TVIK LLC Photo Analysis AI — a structured construction photo extraction tool.

CRITICAL RULES:
- You are a STRUCTURED EXTRACTOR, not a chatbot.
- Only describe what is VISIBLY present in the images.
- Separate visible facts from probable inferences.
- Never invent measurements, dimensions, or exact quantities unless clearly countable.
- Never confirm hidden damage as fact — use "probable" or "possible" language.
- Never finalize pricing or quantities.
- Confidence must be conservative.
- If visibility is poor, set confidence to Low and recommend site visit.

CONFIDENCE RULES:
- High = clear images, simple scope, little hidden uncertainty
- Medium = good visual clues but important questions remain
- Low = limited visibility, conflicting evidence, major hidden-condition risk

Call the extract_photo_analysis function with the structured output.`;

      const imageContents: any[] = [];
      const imageUrls = data.image_urls || [];
      for (const url of imageUrls) {
        imageContents.push({ type: "image_url", image_url: { url } });
      }
      imageContents.push({
        type: "text",
        text: `Analyze these ${imageUrls.length} construction photo(s).
Area: ${data.area_name || 'Unknown'} (${data.area_type || 'Unknown'})
${formatProjectClassification(data)}
Quick tags: ${data.quick_tags || 'None'}
Existing notes: ${data.notes || 'None'}
Photo captions: ${data.captions || 'None'}`
      });

      const photoToolBody = {
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: areaPhotoSystemPrompt },
          { role: "user", content: imageContents },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_photo_analysis",
              description: "Extract structured photo analysis findings from construction photos.",
              parameters: {
                type: "object",
                properties: {
                  visible_facts: { type: "string", description: "Bullet list of only what can actually be seen in the photos" },
                  probable_scope_items: { type: "string", description: "Bullet list of probable work items based on visual evidence" },
                  probable_hidden_risks: { type: "string", description: "Bullet list of risks with visible basis (staining, damage, etc.)" },
                  trade_detection: { type: "string", description: "Comma-separated list of trades likely involved based on what is visible" },
                  missing_visual_information: { type: "string", description: "Bullet list of what cannot be determined from these photos" },
                  image_confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                  site_visit_recommended: { type: "boolean" },
                  site_visit_reason: { type: "string", description: "Why site visit is recommended, if applicable" },
                  photo_summary: { type: "string", description: "2-3 sentence summary of what the photos show" },
                  review_queue_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        suggestion_type: { type: "string", enum: ["risk_note", "trade_detection", "site_visit", "allowance", "missing_info", "internal_note"] },
                        suggested_value: { type: "string" },
                        apply_target: { type: "string" },
                        confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                        evidence_summary: { type: "string" },
                        reason_for_suggestion: { type: "string" }
                      },
                      required: ["suggestion_type", "suggested_value", "confidence", "evidence_summary", "reason_for_suggestion"],
                      additionalProperties: false
                    },
                    description: "Optional queue items only when visual evidence supports them"
                  }
                },
                required: ["visible_facts", "probable_scope_items", "probable_hidden_risks", "trade_detection", "missing_visual_information", "image_confidence", "site_visit_recommended", "photo_summary", "review_queue_items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_photo_analysis" } },
      };

      const photoResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(photoToolBody),
      });

      if (!photoResp.ok) {
        const status = photoResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI gateway error:", status, await photoResp.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const photoResult = await photoResp.json();
      const photoToolCall = photoResult.choices?.[0]?.message?.tool_calls?.[0];
      let photoStructured: any = {};
      if (photoToolCall?.function?.arguments) {
        try {
          photoStructured = typeof photoToolCall.function.arguments === 'string'
            ? JSON.parse(photoToolCall.function.arguments)
            : photoToolCall.function.arguments;
        } catch {
          photoStructured = { visible_facts: "", probable_scope_items: "", probable_hidden_risks: "", trade_detection: "", missing_visual_information: "", image_confidence: "Low", site_visit_recommended: true, site_visit_reason: "Failed to parse", photo_summary: "Analysis parsing failed", review_queue_items: [] };
        }
      } else {
        const content = photoResult.choices?.[0]?.message?.content || "";
        try { photoStructured = JSON.parse(content); } catch {
          photoStructured = { visible_facts: "", probable_scope_items: "", probable_hidden_risks: "", trade_detection: "", missing_visual_information: "", image_confidence: "Low", site_visit_recommended: true, site_visit_reason: "No structured output", photo_summary: content || "No analysis", review_queue_items: [] };
        }
      }

      return new Response(JSON.stringify({ structured: photoStructured }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "area_merge_analysis") {
      // Patch 6: Merge/reconciliation block — combines typed, voice, and photo outputs
      const mergeSystemPrompt = `You are TVIK LLC Merge Analysis AI — a structured construction estimator reconciliation tool.

Your job is to merge already-processed structured outputs from typed intake, voice walkthrough, and photo analysis into one coherent merged estimate picture.

CRITICAL RULES:
- You are a STRUCTURED RECONCILER, not a chatbot.
- Only work with upstream structured outputs provided to you.
- Separate visible facts from inferences from needs-verification items.
- Never invent measurements, dimensions, or quantities.
- Never finalize pricing.
- If sources conflict materially, lower confidence and surface the conflict.
- If sources align, confidence may increase.
- If one or more upstream sources are missing, proceed conservatively and lower confidence.
- Treat disagreement as a feature, not an error.

MERGE RULES:
- visible facts must be evidence-backed from upstream outputs
- likely inferences must stay separate from visible facts
- unresolved items go into needs_verification
- if sources align → confidence may increase
- if sources partially align → confidence usually Medium
- if sources materially conflict → confidence Low unless strong evidence resolves it
- if conflict materially affects estimate reliability → create missing_info or site_visit queue suggestions

CONFIDENCE RULES:
- High = all sources agree, clear scope, low uncertainty
- Medium = partial agreement, some clarification needed
- Low = material conflicts, missing sources, major uncertainty

Call the extract_merge_analysis function with the structured output.`;

      const mergeUserPrompt = `Merge the following upstream structured outputs into one reconciled estimate picture.

Area: ${data.area_name || 'Unknown'} (${data.area_type || 'Unknown'})
${formatProjectClassification(data)}
Current status: ${data.current_status || 'Draft'}
Quick tags: ${data.quick_tags || 'None'}

=== TYPED INTAKE OUTPUT ===
${data.typed_intake_output || 'Not available'}

=== VOICE WALKTHROUGH OUTPUT ===
${data.voice_walkthrough_output || 'Not available'}

=== PHOTO ANALYSIS OUTPUT ===
${data.photo_analysis_output || 'Not available'}

=== CURRENT LINE ITEMS (reference only) ===
${data.current_line_items || 'None'}

=== CURRENT RISK NOTES (reference only) ===
${data.current_risk_notes || 'None'}

Reconcile overlaps, surface conflicts, and produce a merged estimate picture. Be conservative.`;

      const mergeToolBody = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: mergeSystemPrompt },
          { role: "user", content: mergeUserPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_merge_analysis",
              description: "Extract structured merged analysis from reconciled upstream outputs.",
              parameters: {
                type: "object",
                properties: {
                  merged_scope_summary: { type: "string", description: "2-4 sentence merged scope summary from all sources" },
                  merged_visible_facts: { type: "string", description: "Bullet list of evidence-backed visible facts from all sources" },
                  merged_inferences: { type: "string", description: "Bullet list of likely inferences supported by combined evidence" },
                  merged_needs_verification: { type: "string", description: "Bullet list of unresolved items that need clarification or site visit" },
                  merged_risks: { type: "string", description: "Bullet list of combined risks from all sources" },
                  merged_trade_detection: { type: "string", description: "Comma-separated list of trades from combined evidence" },
                  merged_missing_questions: { type: "string", description: "Numbered list of remaining follow-up questions" },
                  merged_confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                  conflict_summary: { type: "string", description: "Summary of material conflicts between sources. Empty if no conflicts." },
                  site_visit_recommended: { type: "boolean" },
                  site_visit_reason: { type: "string", description: "Why site visit is recommended, if applicable" },
                  review_queue_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        suggestion_type: { type: "string", enum: ["missing_info", "risk_note", "trade_detection", "site_visit", "allowance", "assumption", "exclusion", "internal_note"] },
                        suggested_value: { type: "string" },
                        apply_target: { type: "string" },
                        confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                        evidence_summary: { type: "string" },
                        reason_for_suggestion: { type: "string" }
                      },
                      required: ["suggestion_type", "suggested_value", "confidence", "evidence_summary", "reason_for_suggestion"],
                      additionalProperties: false
                    },
                    description: "Queue items from merged analysis when evidence supports them"
                  }
                },
                required: ["merged_scope_summary", "merged_visible_facts", "merged_inferences", "merged_needs_verification", "merged_risks", "merged_trade_detection", "merged_missing_questions", "merged_confidence", "conflict_summary", "site_visit_recommended", "review_queue_items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_merge_analysis" } },
      };

      const mergeResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(mergeToolBody),
      });

      if (!mergeResp.ok) {
        const status = mergeResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI gateway error:", status, await mergeResp.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const mergeResult = await mergeResp.json();
      const mergeToolCall = mergeResult.choices?.[0]?.message?.tool_calls?.[0];
      let mergeStructured: any = {};
      if (mergeToolCall?.function?.arguments) {
        try {
          mergeStructured = typeof mergeToolCall.function.arguments === 'string'
            ? JSON.parse(mergeToolCall.function.arguments)
            : mergeToolCall.function.arguments;
        } catch {
          mergeStructured = { merged_scope_summary: "Failed to parse", merged_visible_facts: "", merged_inferences: "", merged_needs_verification: "", merged_risks: "", merged_trade_detection: "", merged_missing_questions: "", merged_confidence: "Low", conflict_summary: "Parse error", site_visit_recommended: true, review_queue_items: [] };
        }
      } else {
        const content = mergeResult.choices?.[0]?.message?.content || "";
        try { mergeStructured = JSON.parse(content); } catch {
          mergeStructured = { merged_scope_summary: content || "No analysis", merged_visible_facts: "", merged_inferences: "", merged_needs_verification: "", merged_risks: "", merged_trade_detection: "", merged_missing_questions: "", merged_confidence: "Low", conflict_summary: "", site_visit_recommended: true, review_queue_items: [] };
        }
      }

      return new Response(JSON.stringify({ structured: mergeStructured }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "missing_info_questions") {
      // Patch 7: Missing Info Questions block — ranked clarification questions only
      const missingInfoSystemPrompt = `You are TVIK LLC Missing Info Questions AI — a structured construction estimator clarification tool.

Your job is to look at the current structured intake state and produce ONLY the highest-value clarification questions needed to improve estimate reliability. You are NOT a chatbot. You do NOT ask filler questions.

CRITICAL RULES:
- You are a STRUCTURED QUESTION RANKER, not a conversational assistant.
- Ask ONLY questions that materially affect scope, trade involvement, repair-vs-replace decisions, material responsibility, hidden-condition risk, measurement dependence, permit exposure, or site-visit need.
- Never ask vague questions like "Anything else?" or "Can you tell me more?"
- Never repeat questions already answered by the structured intake state provided.
- Ask 3-5 questions maximum. Fewer if the intake is already mostly complete.
- If intake is sufficiently complete, return zero questions.
- Never finalize pricing or quantities.
- Never approve estimates.

QUESTION RANKING ORDER:
1. Questions that materially change scope
2. Questions that change trade count or hidden risk
3. Questions that affect site-visit necessity
4. Questions that affect finish assumptions
5. Lower-value questions last

BLOCK_IF_UNANSWERED RULES:
- Set block_if_unanswered to true ONLY when unanswered questions would materially undermine estimate reliability or later approval safety.
- Most questions should NOT block — they improve quality but don't prevent work.

SITE VISIT RULES:
- Recommend site visit when missing information materially affects reliability, especially for: water damage, structural unknowns, multi-trade overlap, measurement-sensitive unresolved scope, partial/conflicting photos, or new revision uncertainty.

Call the extract_missing_info_questions function with the structured output.`;

      const missingInfoUserPrompt = `Analyze the current structured intake state and produce the highest-value clarification questions.

Area: ${data.area_name || 'Unknown'} (${data.area_type || 'Unknown'})
${formatProjectClassification(data)}
Current status: ${data.current_status || 'Draft'}
Current confidence: ${data.current_confidence || 'Unknown'}

=== MERGED SCOPE SUMMARY ===
${data.merged_scope_summary || 'Not available'}

=== MERGED VISIBLE FACTS ===
${data.merged_visible_facts || 'Not available'}

=== MERGED INFERENCES ===
${data.merged_inferences || 'Not available'}

=== MERGED NEEDS VERIFICATION ===
${data.merged_needs_verification || 'Not available'}

=== MERGED RISKS ===
${data.merged_risks || 'Not available'}

=== MERGED TRADE DETECTION ===
${data.merged_trade_detection || 'Not available'}

=== CURRENT EXCLUSIONS ===
${data.current_exclusions || 'None'}

=== CURRENT ALLOWANCES ===
${data.current_allowances || 'None'}

=== CURRENT ASSUMPTIONS ===
${data.current_assumptions || 'None'}

=== CURRENT RISK NOTES ===
${data.current_risk_notes || 'None'}

=== ALREADY ASKED QUESTIONS ===
${data.already_asked_questions || 'None'}

=== CURRENT SITE VISIT RECOMMENDATION ===
${data.current_site_visit_recommended ? 'Yes' : 'No'}

Produce only the highest-value clarification questions. Do not repeat already-answered items. Be specific and estimator-useful.`;

      const missingInfoToolBody = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: missingInfoSystemPrompt },
          { role: "user", content: missingInfoUserPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_missing_info_questions",
              description: "Extract ranked missing info clarification questions from current intake state.",
              parameters: {
                type: "object",
                properties: {
                  top_priority_questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string", description: "The specific clarification question" },
                        why_it_matters: { type: "string", description: "Why this question materially affects the estimate" },
                        impact_area: { type: "string", enum: ["scope", "trade", "hidden_risk", "material", "measurement", "permit", "site_visit", "finish"] },
                        priority_rank: { type: "number", description: "1 = highest priority" },
                      },
                      required: ["question", "why_it_matters", "impact_area", "priority_rank"],
                      additionalProperties: false
                    },
                    description: "3-5 highest-value clarification questions, ranked by impact. Fewer if intake is mostly complete."
                  },
                  block_if_unanswered: { type: "boolean", description: "True only if unanswered questions materially undermine estimate reliability" },
                  block_reason: { type: "string", description: "Why unanswered questions would block, if applicable. Empty if block_if_unanswered is false." },
                  site_visit_recommended: { type: "boolean" },
                  site_visit_reason: { type: "string", description: "Why site visit is recommended based on missing information. Empty if not recommended." },
                  overall_completeness_note: { type: "string", description: "1-2 sentence note on current intake completeness level" },
                  review_queue_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        suggestion_type: { type: "string", enum: ["missing_info", "site_visit", "risk_note"] },
                        suggested_value: { type: "string" },
                        apply_target: { type: "string" },
                        confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                        evidence_summary: { type: "string" },
                        reason_for_suggestion: { type: "string" }
                      },
                      required: ["suggestion_type", "suggested_value", "confidence", "evidence_summary", "reason_for_suggestion"],
                      additionalProperties: false
                    },
                    description: "Queue items only for high-value missing info worth tracking. No clutter."
                  }
                },
                required: ["top_priority_questions", "block_if_unanswered", "block_reason", "site_visit_recommended", "site_visit_reason", "overall_completeness_note", "review_queue_items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_missing_info_questions" } },
      };

      const miResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(missingInfoToolBody),
      });

      if (!miResp.ok) {
        const status = miResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI gateway error:", status, await miResp.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const miResult = await miResp.json();
      const miToolCall = miResult.choices?.[0]?.message?.tool_calls?.[0];
      let miStructured: any = {};
      if (miToolCall?.function?.arguments) {
        try {
          miStructured = typeof miToolCall.function.arguments === 'string'
            ? JSON.parse(miToolCall.function.arguments)
            : miToolCall.function.arguments;
        } catch {
          miStructured = { top_priority_questions: [], block_if_unanswered: false, block_reason: "", site_visit_recommended: false, site_visit_reason: "", overall_completeness_note: "Failed to parse", review_queue_items: [] };
        }
      } else {
        const content = miResult.choices?.[0]?.message?.content || "";
        try { miStructured = JSON.parse(content); } catch {
          miStructured = { top_priority_questions: [], block_if_unanswered: false, block_reason: "", site_visit_recommended: false, site_visit_reason: "", overall_completeness_note: content || "No analysis", review_queue_items: [] };
        }
      }

      return new Response(JSON.stringify({ structured: miStructured }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "completeness_check") {
      // Patch 8: Estimate Completeness Check control block
      const completenessSystemPrompt = `You are TVIK LLC Completeness Check AI — a structured construction estimate control block.

Your job is to compare the current structured intake findings against the current estimate-support content, identify missing categories and mismatches, assign a warning level, and decide whether review should be blocked.

CRITICAL RULES:
- You are a STRUCTURED CONTROL EVALUATOR, not a chatbot.
- Compare evidence from merged intake against what the estimate currently contains.
- Identify likely missing scope categories.
- Identify mismatches between findings and estimate content.
- Assign warning level (Low, Medium, High).
- Decide whether to block approval.
- Never rewrite the estimate.
- Never finalize pricing or quantities.
- Never approve estimates.

THREE-LAYER COMPLETENESS MODEL:

Layer 1 — Rule-based scope category completeness:
Check likely categories: demo, protection, disposal, patch/paint, electrical corrections, plumbing corrections, hidden conditions, permit/fee consideration.

Layer 2 — Evidence-to-estimate mismatch:
Compare merged visible facts vs line items, merged risks vs risk notes, detected trades vs represented trades, unresolved verification needs vs current exclusions/allowances/assumptions, site-visit signals vs current estimate readiness.

Layer 3 — Confidence/escalation:
If evidence is incomplete, conflicting, or low-confidence: lower readiness, raise warning level, recommend site visit, block review only when material.

BLOCKING RULES:
- block_approval = true ONLY for material issues: major missing scope categories, unresolved hidden-condition risk, severe mismatches, low confidence with multi-trade scope, strong site-visit dependency.
- Set human_fix_required = true when blocked.
- override_allowed = true for most blocks. override_reason_required = true for High warning cases.

COMPLETENESS SCORE:
- 0-40: Critical gaps, block review
- 41-60: Major gaps, likely block
- 61-79: Moderate gaps, warn but may not block
- 80-100: Mostly complete, Low warning

Call the extract_completeness_check function with the structured output.`;

      const completenessUserPrompt = `Compare the current structured intake findings against the estimate content and produce a completeness control result.

Area: ${data.area_name || 'All areas'}
${formatProjectClassification(data)}
Current status: ${data.current_status || 'Draft'}
Current confidence: ${data.current_confidence || 'Unknown'}

=== MERGED SCOPE SUMMARY ===
${data.merged_scope_summary || 'Not available'}

=== MERGED VISIBLE FACTS ===
${data.merged_visible_facts || 'Not available'}

=== MERGED INFERENCES ===
${data.merged_inferences || 'Not available'}

=== MERGED NEEDS VERIFICATION ===
${data.merged_needs_verification || 'Not available'}

=== MERGED RISKS ===
${data.merged_risks || 'Not available'}

=== MERGED TRADE DETECTION ===
${data.merged_trade_detection || 'Not available'}

=== CURRENT LINE ITEMS ===
${data.current_line_items || 'None'}

=== CURRENT EXCLUSIONS ===
${data.current_exclusions || 'None'}

=== CURRENT ALLOWANCES ===
${data.current_allowances || 'None'}

=== CURRENT ASSUMPTIONS ===
${data.current_assumptions || 'None'}

=== CURRENT RISK NOTES ===
${data.current_risk_notes || 'None'}

=== CURRENT SITE VISIT RECOMMENDATION ===
${data.current_site_visit_recommended ? 'Yes' : 'No'}

Evaluate completeness, identify gaps and mismatches, assign warning level, and determine if review should be blocked.`;

      const completenessToolBody = {
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: completenessSystemPrompt },
          { role: "user", content: completenessUserPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_completeness_check",
              description: "Extract structured completeness check results comparing intake evidence to estimate content.",
              parameters: {
                type: "object",
                properties: {
                  completeness_score: { type: "number", description: "0-100 score of estimate completeness based on evidence" },
                  missing_scope_categories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", description: "Missing scope category name" },
                        severity: { type: "string", enum: ["Low", "Medium", "High"] },
                        reason: { type: "string", description: "Why this category appears missing" }
                      },
                      required: ["category", "severity", "reason"],
                      additionalProperties: false
                    },
                    description: "List of likely missing scope categories"
                  },
                  mismatches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        finding: { type: "string", description: "What the evidence shows" },
                        estimate_gap: { type: "string", description: "What the estimate is missing or has wrong" },
                        severity: { type: "string", enum: ["Low", "Medium", "High"] }
                      },
                      required: ["finding", "estimate_gap", "severity"],
                      additionalProperties: false
                    },
                    description: "Mismatches between evidence and current estimate content"
                  },
                  warning_level: { type: "string", enum: ["Low", "Medium", "High"] },
                  block_approval: { type: "boolean", description: "True if material issues make review/approval unsafe" },
                  blocking_reason: { type: "string", description: "Why review is blocked. Empty if not blocked." },
                  human_fix_required: { type: "boolean" },
                  override_allowed: { type: "boolean" },
                  override_reason_required: { type: "boolean" },
                  site_visit_recommended: { type: "boolean" },
                  site_visit_reason: { type: "string" },
                  confidence_rollup: { type: "string", enum: ["High", "Medium", "Low"] },
                  completeness_summary: { type: "string", description: "2-3 sentence summary of completeness state" },
                  review_queue_items: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        suggestion_type: { type: "string", enum: ["missing_info", "risk_note", "trade_detection", "site_visit", "allowance", "exclusion", "assumption", "internal_note"] },
                        suggested_value: { type: "string" },
                        apply_target: { type: "string" },
                        confidence: { type: "string", enum: ["High", "Medium", "Low"] },
                        evidence_summary: { type: "string" },
                        reason_for_suggestion: { type: "string" }
                      },
                      required: ["suggestion_type", "suggested_value", "confidence", "evidence_summary", "reason_for_suggestion"],
                      additionalProperties: false
                    },
                    description: "Queue items for material issues worth tracking"
                  }
                },
                required: ["completeness_score", "missing_scope_categories", "mismatches", "warning_level", "block_approval", "blocking_reason", "human_fix_required", "override_allowed", "override_reason_required", "site_visit_recommended", "confidence_rollup", "completeness_summary", "review_queue_items"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_completeness_check" } },
      };

      const ccResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(completenessToolBody),
      });

      if (!ccResp.ok) {
        const status = ccResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        console.error("AI gateway error:", status, await ccResp.text());
        return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const ccResult = await ccResp.json();
      const ccToolCall = ccResult.choices?.[0]?.message?.tool_calls?.[0];
      let ccStructured: any = {};
      if (ccToolCall?.function?.arguments) {
        try {
          ccStructured = typeof ccToolCall.function.arguments === 'string'
            ? JSON.parse(ccToolCall.function.arguments)
            : ccToolCall.function.arguments;
        } catch {
          ccStructured = { completeness_score: 0, missing_scope_categories: [], mismatches: [], warning_level: "High", block_approval: true, blocking_reason: "Failed to parse", human_fix_required: true, override_allowed: true, override_reason_required: false, site_visit_recommended: true, confidence_rollup: "Low", completeness_summary: "Analysis parsing failed", review_queue_items: [] };
        }
      } else {
        const content = ccResult.choices?.[0]?.message?.content || "";
        try { ccStructured = JSON.parse(content); } catch {
          ccStructured = { completeness_score: 0, missing_scope_categories: [], mismatches: [], warning_level: "High", block_approval: true, blocking_reason: "No structured output", human_fix_required: true, override_allowed: true, override_reason_required: false, site_visit_recommended: true, confidence_rollup: "Low", completeness_summary: content || "No analysis", review_queue_items: [] };
        }
      }

      return new Response(JSON.stringify({ structured: ccStructured }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else if (action === "intake") {
      // AI Intake Assistant - structured analysis
      const workflow = data.workflow || "intake_fresh";
      const userPrompt = `Workflow mode: ${workflow}

${formatProjectClassification(data)}
Description: ${data.description || 'None provided'}
Notes: ${data.notes || 'None'}
Square footage: ${data.sqft || 'Unknown'}
Fixture count: ${data.fixture_count || 'Unknown'}
Finish level: ${data.finish_level || 'Unknown'}

Voice walkthrough transcript: ${data.voice_transcript || 'No voice transcript provided'}

Photo analyses: ${data.photo_analyses ? JSON.stringify(data.photo_analyses) : 'No photos analyzed'}

Existing estimate data: ${data.existing_estimate ? JSON.stringify(data.existing_estimate) : 'No existing estimate'}

Additional context from user: ${data.user_input || 'None'}

IMPORTANT: If both voice transcript and typed notes are provided, merge findings from all sources. Distinguish visible evidence (photos) from spoken observations (voice) and written notes (text). If sources conflict, lower confidence and note the conflict.`;

      messages = [
        { role: "system", content: INTAKE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
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
