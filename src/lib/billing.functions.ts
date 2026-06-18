import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS, type PlanId } from "./plans";

export const getBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    let { data: profile } = await supabase
      .from("profiles")
      .select("plan, validations_used_this_period, period_started_at, current_period_end, stripe_subscription_id")
      .eq("id", userId)
      .maybeSingle();

    // Self-heal: roll the period window forward if 30 days have passed
    if (profile) {
      const started = new Date(profile.period_started_at).getTime();
      if (Date.now() - started > 30 * 24 * 60 * 60 * 1000) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin
          .from("profiles")
          .update({ validations_used_this_period: 0, period_started_at: new Date().toISOString() })
          .eq("id", userId);
        profile = { ...profile, validations_used_this_period: 0, period_started_at: new Date().toISOString() };
      }
    } else {
      // Defensive create if trigger missed — must use admin since users cannot write privileged columns
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: created } = await supabaseAdmin
        .from("profiles")
        .insert({ id: userId, plan: "free" })
        .select("plan, validations_used_this_period, period_started_at, current_period_end, stripe_subscription_id")
        .single();
      profile = created;
    }

    const plan = (profile?.plan ?? "free") as PlanId;
    const def = PLANS[plan] ?? PLANS.free;
    return {
      plan,
      planName: def.name,
      limit: def.validationsPerMonth,
      used: profile?.validations_used_this_period ?? 0,
      periodStartedAt: profile?.period_started_at ?? null,
      currentPeriodEnd: profile?.current_period_end ?? null,
      hasSubscription: !!profile?.stripe_subscription_id,
    };
  });
