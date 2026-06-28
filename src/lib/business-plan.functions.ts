import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

const PlanSchema = z.object({
  executive_summary: z.object({
    overview: z.string(),
    mission: z.string(),
    vision: z.string(),
    objectives: z.array(z.string()).max(6),
  }),
  company_description: z.object({
    legal_structure: z.string(),
    location: z.string(),
    stage: z.string(),
    team_needs: z.array(z.string()).max(6),
  }),
  market_analysis: z.object({
    industry_overview: z.string(),
    target_market: z.string(),
    market_size_estimate: z.string(),
    customer_segments: z.array(z.string()).max(6),
  }),
  marketing_strategy: z.object({
    positioning: z.string(),
    pricing_strategy: z.string(),
    acquisition_channels: z.array(z.string()).max(6),
    growth_tactics: z.array(z.string()).max(6),
  }),
  operations_plan: z.object({
    key_activities: z.array(z.string()).max(8),
    key_resources: z.array(z.string()).max(6),
    tech_stack: z.array(z.string()).max(8),
    suppliers_partners: z.array(z.string()).max(6),
  }),
  financial_plan: z.object({
    startup_costs_usd: z.number(),
    monthly_burn_usd: z.number(),
    breakeven_months: z.number(),
    funding_needed_usd: z.number(),
    revenue_streams: z.array(z.string()).max(6),
    key_assumptions: z.array(z.string()).max(6),
  }),
  milestones: z
    .array(z.object({ month: z.number(), goal: z.string() }))
    .max(10),
  risks_and_mitigations: z
    .array(z.object({ risk: z.string(), mitigation: z.string() }))
    .max(6),
});

export type BusinessPlan = z.infer<typeof PlanSchema>;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("Model returned no JSON object");
  return JSON.parse(raw.slice(first, last + 1));
}

export const generateBusinessPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ validation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: validation, error: vErr } = await supabase
      .from("validations")
      .select("*")
      .eq("id", data.validation_id)
      .maybeSingle();
    if (vErr || !validation) throw new Error("Validation not found");
    if (validation.user_id !== userId) throw new Error("Forbidden");

    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const writeClient = getSupabaseAdmin() ?? supabase;
    const { data: row, error: insErr } = await writeClient
      .from("business_plans")
      .insert({ user_id: userId, validation_id: data.validation_id, status: "running" })
      .select("id")
      .single();
    if (insErr || !row) throw new Error(insErr?.message ?? "Failed to create plan");

    try {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("Missing OPENAI_API_KEY");
      const { generateText } = await import("ai");
      const { createAiProvider } = await import("./ai-gateway.server");
      const provider = createAiProvider(key);

      const prompt = `You are a senior startup consultant. Generate a COMPLETE, realistic business plan as STRICT JSON only — no prose, no markdown.

Context (already-validated startup):
Business Name: ${validation.business_name}
Idea: ${validation.idea}
Industry: ${validation.industry ?? "unspecified"}
Country/Market: ${validation.country ?? "global"}
Audience: ${validation.audience ?? "unspecified"}
Budget: ${validation.budget ?? "unspecified"}
Business Model: ${validation.business_model ?? "unspecified"}

Existing validation report (JSON):
${JSON.stringify(validation.report).slice(0, 6000)}

Return JSON matching EXACTLY this TypeScript shape:
{
  "executive_summary": { "overview": string, "mission": string, "vision": string, "objectives": string[] (3-5) },
  "company_description": { "legal_structure": string, "location": string, "stage": string, "team_needs": string[] (3-5) },
  "market_analysis": { "industry_overview": string, "target_market": string, "market_size_estimate": string, "customer_segments": string[] (3-5) },
  "marketing_strategy": { "positioning": string, "pricing_strategy": string, "acquisition_channels": string[] (3-5), "growth_tactics": string[] (3-5) },
  "operations_plan": { "key_activities": string[] (4-6), "key_resources": string[] (3-5), "tech_stack": string[] (3-6), "suppliers_partners": string[] (2-5) },
  "financial_plan": { "startup_costs_usd": number, "monthly_burn_usd": number, "breakeven_months": number, "funding_needed_usd": number, "revenue_streams": string[] (2-4), "key_assumptions": string[] (3-5) },
  "milestones": Array<{ "month": number, "goal": string }> (5-8 entries spanning months 1-18),
  "risks_and_mitigations": Array<{ "risk": string, "mitigation": string }> (3-5)
}

Be realistic, concrete and tailored to the country and budget. Use real numbers.`;

      const { text } = await generateText({
        model: provider("gpt-4o"),
        prompt,
        temperature: 0.5,
      });
      const parsed = PlanSchema.parse(extractJson(text));

      await writeClient
        .from("business_plans")
        .update({ status: "complete", plan: parsed as unknown as Json })
        .eq("id", row.id);
      return { id: row.id as string };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await writeClient.from("business_plans").update({ status: "failed", error: message }).eq("id", row.id);
      throw new Error(message);
    }
  });

export const getBusinessPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ validation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("business_plans")
      .select("*")
      .eq("validation_id", data.validation_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return row;
  });
