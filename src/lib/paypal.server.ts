import process from "node:process";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS, type PlanId } from "./plans";
import { resolveAppBaseUrl } from "./payhere.server";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type PayPalLink = {
  href: string;
  rel: string;
  method?: string;
};

type PayPalOrderResponse = {
  id: string;
  status?: string;
  links?: PayPalLink[];
};

type PayPalCaptureResponse = {
  id: string;
  status?: string;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{
        id?: string;
        status?: string;
        amount?: {
          currency_code?: string;
          value?: string;
        };
      }>;
    };
  }>;
};

export function getPayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const sandbox = process.env.PAYPAL_SANDBOX !== "false";
  const currency = (process.env.PAYPAL_CURRENCY ?? "USD").toUpperCase();
  const baseUrl = sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";

  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal environment variables: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required");
  }

  if (currency !== "USD") {
    throw new Error("PAYPAL_CURRENCY currently supports USD for these plan prices");
  }

  return {
    clientId,
    clientSecret,
    sandbox,
    currency,
    baseUrl,
  };
}

export function paypalAmountCents(planId: PlanId) {
  return Math.round(PLANS[planId].price * 100);
}

function amountToPayPalString(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

async function getPayPalAccessToken() {
  const { clientId, clientSecret, baseUrl } = getPayPalConfig();
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  const payload = (await response.json()) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Failed to get PayPal access token");
  }

  return payload.access_token;
}

async function paypalRequest<T>(path: string, init: RequestInit = {}) {
  const { baseUrl } = getPayPalConfig();
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = payload?.message || payload?.error_description || payload?.error || "PayPal API request failed";
    throw new Error(message);
  }

  return payload as T;
}

export async function createPayPalCheckout(input: { planId: Extract<PlanId, "pro" | "business">; userId: string; request: Request }) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const plan = PLANS[input.planId];
  const amountCents = paypalAmountCents(input.planId);
  const amount = amountToPayPalString(amountCents);
  const baseUrl = resolveAppBaseUrl(input.request);
  const { currency } = getPayPalConfig();
  const merchantOrderId = `PP-${Date.now()}-${input.userId.slice(0, 8)}-${input.planId}`;

  const { error } = await admin.from("payment_orders").insert({
    user_id: input.userId,
    plan: input.planId,
    provider: "paypal",
    amount_cents: amountCents,
    currency,
    status: "pending",
    payhere_order_id: merchantOrderId,
  });
  if (error) {
    throw new Error(error.message ?? "Failed to create PayPal payment order");
  }

  const order = await paypalRequest<PayPalOrderResponse>("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: merchantOrderId,
          description: `${plan.name} plan`,
          custom_id: input.userId,
          invoice_id: merchantOrderId,
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      application_context: {
        brand_name: "Startup Validator AI",
        landing_page: "LOGIN",
        user_action: "PAY_NOW",
        return_url: `${baseUrl}/paypal/return?order_id=${encodeURIComponent(merchantOrderId)}`,
        cancel_url: `${baseUrl}/paypal/cancel?order_id=${encodeURIComponent(merchantOrderId)}`,
      },
    }),
  });

  const approvalUrl = order.links?.find((link) => link.rel === "approve")?.href;
  if (!approvalUrl) {
    throw new Error("PayPal approval URL was not returned");
  }

  await admin
    .from("payment_orders")
    .update({ payhere_payment_id: order.id, payhere_status_message: order.status ?? null })
    .eq("payhere_order_id", merchantOrderId);

  return {
    orderId: merchantOrderId,
    paypalOrderId: order.id,
    approvalUrl,
  };
}

export async function capturePayPalOrder(input: { merchantOrderId: string; paypalOrderId: string }) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const { data: order, error } = await admin
    .from("payment_orders")
    .select("id, user_id, plan, amount_cents, currency, status, payhere_payment_id")
    .eq("payhere_order_id", input.merchantOrderId)
    .eq("provider", "paypal")
    .maybeSingle();

  if (error || !order) {
    throw new Error("PayPal payment order not found");
  }

  const paypalOrderId = input.paypalOrderId || order.payhere_payment_id;
  if (!paypalOrderId) {
    throw new Error("Missing PayPal order ID");
  }

  const capture = await paypalRequest<PayPalCaptureResponse>(`/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const firstCapture = capture.purchase_units?.flatMap((unit) => unit.payments?.captures ?? [])[0];
  const amountCents = Math.round(Number(firstCapture?.amount?.value ?? "0") * 100);
  const currency = firstCapture?.amount?.currency_code ?? order.currency;

  if (amountCents !== order.amount_cents) {
    throw new Error("PayPal payment amount mismatch");
  }

  if (currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new Error("PayPal payment currency mismatch");
  }

  const paid = capture.status === "COMPLETED" || firstCapture?.status === "COMPLETED";
  const nextStatus = paid ? "paid" : "pending";

  await admin
    .from("payment_orders")
    .update({
      status: nextStatus,
      payhere_payment_id: firstCapture?.id ?? null,
      payhere_status_message: capture.status ?? firstCapture?.status ?? null,
      payhere_method: "PayPal",
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", order.id);

  if (paid && order.status !== "paid") {
    const now = Date.now();
    await admin
      .from("profiles")
      .update({
        plan: order.plan,
        validations_used_this_period: 0,
        period_started_at: new Date(now).toISOString(),
        current_period_end: new Date(now + THIRTY_DAYS_MS).toISOString(),
      })
      .eq("id", order.user_id);
  }

  return {
    orderId: input.merchantOrderId,
    status: nextStatus,
    plan: order.plan,
  };
}

export async function cancelPayPalOrder(orderId: string | null) {
  if (!orderId) return;

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
  }

  await admin
    .from("payment_orders")
    .update({ status: "cancelled", payhere_status_message: "PayPal checkout cancelled by user" })
    .eq("payhere_order_id", orderId)
    .eq("provider", "paypal")
    .neq("status", "paid");
}
