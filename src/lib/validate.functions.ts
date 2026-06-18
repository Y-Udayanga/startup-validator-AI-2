import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { PLANS, type PlanId } from "./plans";

const InputSchema = z.object({
  business_name: z.string().min(1).max(120),
  idea: z.string().min(20).max(4000),
  industry: z.string().max(120).optional().default(""),
  country: z.string().max(120).optional().default(""),
  audience: z.string().max(240).optional().default(""),
  budget: z.string().max(60).optional().default(""),
  business_model: z.string().max(120).optional().default(""),
});

const ReportSchema = z.object({
  summary: z.object({
    problem: z.string(),
    solution: z.string(),
    target_users: z.string(),
    unique_value: z.string(),
  }),
  market: z.object({
    demand_score: z.number().min(0).max(100),
    reason: z.string(),
    trends: z.array(z.string()).max(6),
  }),
  competitors: z
    .array(z.object({ name: z.string(), strengths: z.string(), weaknesses: z.string() }))
    .max(6),
  gap_opportunity: z.string(),
  swot: z.object({
    strengths: z.array(z.string()).max(6),
    weaknesses: z.array(z.string()).max(6),
    opportunities: z.array(z.string()).max(6),
    threats: z.array(z.string()).max(6),
  }),
  risks: z
    .array(
      z.object({
        label: z.string(),
        category: z.enum(["Technical", "Financial", "Market", "Legal", "Operational"]),
        score: z.number().min(0).max(100),
        mitigation: z.string(),
      }),
    )
    .max(6),
  revenue_forecast: z.array(z.object({ year: z.string(), revenue_usd: z.number() })).length(5),
  scores: z.object({
    demand: z.number().min(0).max(100),
    competition: z.number().min(0).max(100),
    profitability: z.number().min(0).max(100),
    scalability: z.number().min(0).max(100),
    innovation: z.number().min(0).max(100),
  }),
  final_score: z.number().min(0).max(100),
  verdict: z.enum(["Strong", "Promising", "Risky", "Weak"]),
  recommendations: z.array(z.string()).max(6),
  investor_readiness: z.object({
    score: z.number().min(0).max(100),
    stage: z.enum(["Idea", "Pre-seed", "Seed", "Series A-ready"]),
    explanation: z.string(),
    checklist: z
      .array(
        z.object({
          item: z.string(),
          metric: z.string(),
          status: z.enum(["complete", "partial", "missing"]),
          why_it_matters: z.string(),
          evidence: z.string(),
        }),
      )
      .min(6)
      .max(10),
  }),
  rag_citations: z
    .array(z.object({ source_title: z.string(), insight: z.string() }))
    .max(6)
    .optional()
    .default([]),
});

export type ValidationReport = z.infer<typeof ReportSchema>;

function buildPrompt(input: z.infer<typeof InputSchema>, ragContext: string) {
  return `You are a senior startup validator, market analyst and venture mentor.
Analyze this startup idea and return a rigorous, realistic validation report as STRICT JSON only — no prose, no markdown, no code fences.

Business Name: ${input.business_name}
Idea: ${input.idea}
Industry: ${input.industry || "unspecified"}
Country / Market: ${input.country || "global"}
Target Audience: ${input.audience || "unspecified"}
Budget: ${input.budget || "unspecified"}
Business Model: ${input.business_model || "unspecified"}

${ragContext ? `RETRIEVED MARKET RESEARCH (use this to strengthen competitor + market demand analysis; cite source titles in rag_citations):\n${ragContext}\n` : "No external sources provided.\n"}

Return JSON matching EXACTLY this TypeScript shape:
{
  "summary": { "problem": string, "solution": string, "target_users": string, "unique_value": string },
  "market": { "demand_score": number(0-100), "reason": string, "trends": string[] (3-5) },
  "competitors": Array<{ "name": string, "strengths": string, "weaknesses": string }> (3-5),
  "gap_opportunity": string,
  "swot": { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] } (3-5 each),
  "risks": Array<{ "label": string, "category": "Technical"|"Financial"|"Market"|"Legal"|"Operational", "score": number(0-100), "mitigation": string }> (3-5),
  "revenue_forecast": [ {"year":"Year 1","revenue_usd":number}, ... (5 entries) ],
  "scores": { "demand": number, "competition": number, "profitability": number, "scalability": number, "innovation": number } (0-100),
  "final_score": number(0-100),
  "verdict": "Strong" | "Promising" | "Risky" | "Weak",
  "recommendations": string[] (3-5),
  "investor_readiness": {
    "score": number(0-100),
    "stage": "Idea" | "Pre-seed" | "Seed" | "Series A-ready",
    "explanation": string (2-3 sentences explaining the score),
    "checklist": Array<{
      "item": string (e.g. "Problem-solution fit", "Founding team", "MVP", "Traction", "Market size", "Business model clarity", "Defensibility/Moat", "Go-to-market plan", "Financial model", "Legal/Compliance"),
      "metric": string (what specifically is being measured),
      "status": "complete" | "partial" | "missing",
      "why_it_matters": string (1-2 sentences explaining why investors care),
      "evidence": string (what evidence exists today OR what would be needed)
    }> (8 items, covering the standard investor-readiness dimensions above)
  },
  "rag_citations": Array<{ "source_title": string, "insight": string }> (0-5, only if RETRIEVED MARKET RESEARCH was provided)
}

Use realistic revenue ranges for the stated budget and market. When retrieved research is provided, cite specific source titles and explain the insight you extracted. Be candid — do not inflate scores.`;
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("Model returned no JSON object");
  return JSON.parse(raw.slice(first, last + 1));
}

export const createValidation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // --- Quota check ---
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, validations_used_this_period, period_started_at")
      .eq("id", userId)
      .maybeSingle();

    let plan: PlanId = (profile?.plan as PlanId) ?? "free";
    if (!(plan in PLANS)) plan = "free";
    let used = profile?.validations_used_this_period ?? 0;
    const periodStarted = profile?.period_started_at ? new Date(profile.period_started_at).getTime() : Date.now();
    const limit = PLANS[plan].validationsPerMonth;
    if (limit !== -1 && used >= limit) {
      throw new Error(
        `You've used all ${limit} validations on the ${PLANS[plan].name} plan this month. Upgrade to run more.`,
      );
    }
    // Reset window if 30d elapsed (server-side via admin since users can't write privileged columns)
    if (Date.now() - periodStarted > 30 * 24 * 60 * 60 * 1000) {
      used = 0;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("profiles")
        .upsert({ id: userId, validations_used_this_period: 0, period_started_at: new Date().toISOString() });
    }

    // --- RAG retrieval ---
    let ragContext = "";
    try {
      const { embedText } = await import("./embeddings.server");
      const queryText = `${data.business_name}. ${data.idea}. Industry: ${data.industry}. Market: ${data.country}. Audience: ${data.audience}.`;
      const queryVec = await embedText(queryText);
      const { data: matches } = await supabase.rpc("match_user_source_chunks", {
        query_embedding: `[${queryVec.join(",")}]` as unknown as string,
        match_count: 6,
      });
      if (matches && matches.length > 0) {
        // Pull source titles
        const sourceIds = [...new Set(matches.map((m: any) => m.source_id))];
        const { data: sources } = await supabase
          .from("sources")
          .select("id, title")
          .in("id", sourceIds);
        const titleMap = new Map((sources ?? []).map((s) => [s.id, s.title]));
        ragContext = matches
          .map(
            (m: any, i: number) =>
              `[Source ${i + 1}: ${titleMap.get(m.source_id) ?? "Untitled"} | sim=${m.similarity.toFixed(2)}]\n${m.content}`,
          )
          .join("\n\n");
      }
    } catch (e) {
      console.error("RAG retrieval failed (continuing without):", e);
    }

    // --- Insert validation row ---
    const { data: row, error: insErr } = await supabase
      .from("validations")
      .insert({
        user_id: userId,
        business_name: data.business_name,
        idea: data.idea,
        industry: data.industry || null,
        country: data.country || null,
        audience: data.audience || null,
        budget: data.budget || null,
        business_model: data.business_model || null,
        status: "running",
      })
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Failed to create validation");

    try {
      const key = process.env.LOVABLE_API_KEY;
      if (!key) throw new Error("Missing LOVABLE_API_KEY");
      const { generateText } = await import("ai");
      const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
      const gateway = createLovableAiGatewayProvider(key);

      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        prompt: buildPrompt(data, ragContext),
        temperature: 0.4,
      });

      const parsed = ReportSchema.parse(extractJson(text));

      await supabase
        .from("validations")
        .update({
          status: "complete",
          report: parsed as unknown as Json,
          score: parsed.final_score,
          verdict: parsed.verdict,
        })
        .eq("id", row.id);

      // Increment usage (server-side: users cannot write privileged profile columns)
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("profiles")
        .update({ validations_used_this_period: used + 1 })
        .eq("id", userId);

      return { id: row.id as string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await supabase.from("validations").update({ status: "failed", error: message }).eq("id", row.id);
      throw new Error(message);
    }
  });
