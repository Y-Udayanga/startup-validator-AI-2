import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { PLANS, type PlanId } from "./plans";
import {
  amountToCheckoutString,
  buildCheckoutHash,
  deriveBuyerFields,
  getPayHereConfig,
  planAmountCents,
  resolveAppBaseUrl,
} from "./payhere.server";

function normalizePlanId(plan: string | null | undefined): PlanId {
  return plan && plan in PLANS ? (plan as PlanId) : "free";
}

export const getBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    let { data: profile } = await supabase
      .from("profiles")
      .select("plan, validations_used_this_period, period_started_at, current_period_end")
      .eq("id", userId)
      .maybeSingle();

    // Self-heal: roll the period window forward if 30 days have passed
    if (profile) {
      const started = new Date(profile.period_started_at).getTime();
      if (Date.now() - started > 30 * 24 * 60 * 60 * 1000) {
        const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
        const supabaseAdmin = getSupabaseAdmin();
        if (supabaseAdmin) {
          const nowIso = new Date().toISOString();
          await supabaseAdmin
            .from("profiles")
            .update({ validations_used_this_period: 0, period_started_at: nowIso })
            .eq("id", userId);
          profile = { ...profile, validations_used_this_period: 0, period_started_at: nowIso };
        }
      }
    } else {
      // Defensive create if trigger missed — must use admin since users cannot write privileged columns
      const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
      const supabaseAdmin = getSupabaseAdmin();
      if (!supabaseAdmin) {
        throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
      }
      const { data: created } = await supabaseAdmin
        .from("profiles")
        .insert({ id: userId, plan: "free" })
        .select("plan, validations_used_this_period, period_started_at, current_period_end")
        .single();
      profile = created;
    }

    const plan = normalizePlanId(profile?.plan);
    const def = PLANS[plan] ?? PLANS.free;
    const { data: recentOrders } = await supabase
      .from("payment_orders")
      .select("payhere_order_id, plan, status, amount_cents, currency, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(5);

    return {
      plan,
      planName: def.name,
      limit: def.validationsPerMonth,
      used: profile?.validations_used_this_period ?? 0,
      periodStartedAt: profile?.period_started_at ?? null,
      currentPeriodEnd: profile?.current_period_end ?? null,
      hasSubscription: plan !== "free",
      email: typeof claims.email === "string" ? claims.email : null,
      gateway: "PayHere Sandbox",
      recentOrders: recentOrders ?? [],
    };
  });

export const startPayHereCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: unknown) => z.object({ planId: z.enum(["pro", "business"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { userId, claims } = context;
    const { getSupabaseAdmin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
    }

    const request = getRequest();
    if (!request) {
      throw new Error("Unable to access request context");
    }

    const plan = PLANS[data.planId];
    if (!plan || plan.price <= 0) {
      throw new Error("Selected plan cannot be purchased");
    }

    const amountCents = planAmountCents(data.planId);
    const amount = amountToCheckoutString(amountCents);
    const orderId = `PH-${Date.now()}-${userId.slice(0, 8)}-${data.planId}`;
    const baseUrl = resolveAppBaseUrl(request);
    const { merchantId, checkoutUrl, currency, sandbox } = getPayHereConfig();

    const { error } = await supabaseAdmin.from("payment_orders").insert({
      user_id: userId,
      plan: data.planId,
      provider: "payhere",
      amount_cents: amountCents,
      currency,
      status: "pending",
      payhere_order_id: orderId,
    });
    if (error) {
      throw new Error(error.message ?? "Failed to create payment order");
    }

    const buyer = deriveBuyerFields(typeof claims.email === "string" ? claims.email : undefined);
    return {
      checkoutUrl,
      orderId,
      sandbox,
      fields: {
        merchant_id: merchantId,
        return_url: `${baseUrl}/payhere/return`,
        cancel_url: `${baseUrl}/payhere/cancel`,
        notify_url: `${baseUrl}/payhere/notify`,
        order_id: orderId,
        items: `${plan.name} plan`,
        currency,
        amount,
        hash: buildCheckoutHash(orderId, amount, currency),
        first_name: buyer.first_name,
        last_name: buyer.last_name,
        email: buyer.email,
        phone: buyer.phone,
        address: buyer.address,
        city: buyer.city,
        country: buyer.country,
        custom_1: data.planId,
        custom_2: userId,
      },
    };
  });
