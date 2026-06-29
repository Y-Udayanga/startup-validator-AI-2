import { createHash, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS, type PlanId } from "./plans";

const PAID_STATUS = "2";
const CANCELLED_STATUS = "-2";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function md5Upper(value: string) {
  return createHash("md5").update(value).digest("hex").toUpperCase();
}

function decodeMerchantSecret(secret: string) {
  const encoding = (process.env.PAYHERE_MERCHANT_SECRET_ENCODING ?? "plain").toLowerCase();
  if (encoding !== "base64") return secret;

  try {
    return Buffer.from(secret, "base64").toString("utf8").trim();
  } catch {
    throw new Error("PAYHERE_MERCHANT_SECRET_ENCODING is base64, but PAYHERE_MERCHANT_SECRET is not valid Base64");
  }
}

function equalHex(left: string, right: string) {
  const a = Buffer.from(left.toUpperCase(), "utf8");
  const b = Buffer.from(right.toUpperCase(), "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getPayHereConfig() {
  const merchantId = process.env.PAYHERE_MERCHANT_ID;
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET;
  const sandbox = process.env.PAYHERE_SANDBOX !== "false";
  const currency = (process.env.PAYHERE_CURRENCY ?? "LKR").toUpperCase();
  const usdToLkrRate = Number(process.env.PAYHERE_USD_TO_LKR_RATE ?? "65.97368421052632");

  if (!merchantId || !merchantSecret) {
    throw new Error("Missing PayHere environment variables: PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET are required");
  }

  if (currency !== "LKR" && currency !== "USD") {
    throw new Error("PAYHERE_CURRENCY must be either LKR or USD");
  }

  if (!Number.isFinite(usdToLkrRate) || usdToLkrRate <= 0) {
    throw new Error("PAYHERE_USD_TO_LKR_RATE must be a positive number");
  }

  return {
    merchantId,
    merchantSecret: decodeMerchantSecret(merchantSecret),
    sandbox,
    currency,
    usdToLkrRate,
    checkoutUrl: sandbox
      ? "https://sandbox.payhere.lk/pay/checkout"
      : "https://www.payhere.lk/pay/checkout",
  };
}

export function resolveAppBaseUrl(request: Request) {
  const envBaseUrl =
    process.env.APP_BASE_URL ??
    process.env.PUBLIC_APP_URL ??
    process.env.VITE_AUTH_REDIRECT_ORIGIN ??
    process.env.VITE_APP_URL;
  if (envBaseUrl) return envBaseUrl.replace(/\/$/, "");

  const proto = request.headers.get("x-forwarded-proto");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (proto && host) return `${proto}://${host}`;

  const origin = request.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  return new URL(request.url).origin;
}

export function amountToCheckoutString(amountCents: number) {
  return Number(amountCents / 100)
    .toLocaleString("en-us", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .replaceAll(",", "");
}

export function planAmountCents(planId: PlanId) {
  const { currency, usdToLkrRate } = getPayHereConfig();
  const amount = currency === "LKR" ? PLANS[planId].price * usdToLkrRate : PLANS[planId].price;
  return Math.round(amount * 100);
}

export function buildCheckoutHash(orderId: string, amount: string, currency: string) {
  const { merchantId, merchantSecret } = getPayHereConfig();
  return md5Upper(`${merchantId}${orderId}${amount}${currency}${md5Upper(merchantSecret)}`);
}

export function deriveBuyerFields(email: string | undefined) {
  const localPart = (email?.split("@")[0] ?? "startup founder").replace(/[._-]+/g, " ").trim();
  const [firstName = "Startup", ...rest] = localPart.split(/\s+/).filter(Boolean);
  return {
    first_name: firstName,
    last_name: rest.join(" ") || "Founder",
    email: email ?? "founder@example.com",
    phone: "0771234567",
    address: "Online business",
    city: "Colombo",
    country: "Sri Lanka",
  };
}

export type PayHereCallbackPayload = {
  merchant_id?: string;
  order_id?: string;
  payhere_amount?: string;
  payhere_currency?: string;
  status_code?: string;
  md5sig?: string;
  payment_id?: string;
  status_message?: string;
};

export function verifyCallbackSignature(payload: PayHereCallbackPayload) {
  const { merchantId, merchantSecret } = getPayHereConfig();

  if (
    !payload.order_id ||
    !payload.payhere_amount ||
    !payload.payhere_currency ||
    !payload.status_code ||
    !payload.md5sig
  ) {
    return false;
  }

  if (payload.merchant_id && payload.merchant_id !== merchantId) {
    return false;
  }

  const expected = md5Upper(
    `${merchantId}${payload.order_id}${payload.payhere_amount}${payload.payhere_currency}${payload.status_code}${md5Upper(merchantSecret)}`,
  );
  return equalHex(expected, payload.md5sig);
}

export function mapOrderStatus(statusCode: string | undefined) {
  if (statusCode === PAID_STATUS) return "paid" as const;
  if (statusCode === CANCELLED_STATUS) return "cancelled" as const;
  if (statusCode === "0") return "pending" as const;
  return "failed" as const;
}

export async function markOrderCancelled(orderId: string | null) {
  if (!orderId) return;

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
  }

  await admin
    .from("payment_orders")
    .update({
      status: "cancelled",
      payhere_status_code: CANCELLED_STATUS,
      payhere_status_message: "Checkout cancelled by user",
    })
    .eq("payhere_order_id", orderId)
    .neq("status", "paid");
}

export async function finalizePayment(payload: PayHereCallbackPayload) {
  if (!verifyCallbackSignature(payload)) {
    throw new Error("Invalid PayHere callback signature");
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const { data: order, error } = await admin
    .from("payment_orders")
    .select("id, user_id, plan, amount_cents, currency, status")
    .eq("payhere_order_id", payload.order_id ?? "")
    .maybeSingle();

  if (error || !order) {
    throw new Error("Payment order not found");
  }

  const amountCents = Math.round(Number(payload.payhere_amount ?? "0") * 100);
  if (!Number.isFinite(amountCents) || amountCents !== order.amount_cents) {
    throw new Error("Payment amount mismatch");
  }

  if ((payload.payhere_currency ?? "").toUpperCase() !== order.currency.toUpperCase()) {
    throw new Error("Payment currency mismatch");
  }

  const nextStatus = mapOrderStatus(payload.status_code);
  const orderUpdate = {
    status: nextStatus,
    payhere_payment_id: payload.payment_id ?? null,
    payhere_status_code: payload.status_code ?? null,
    payhere_status_message: payload.status_message ?? null,
    paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
  };

  await admin.from("payment_orders").update(orderUpdate).eq("id", order.id);

  if (nextStatus !== "paid" || order.status === "paid") {
    return { orderId: payload.order_id ?? "", status: nextStatus, plan: order.plan };
  }

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

  return { orderId: payload.order_id ?? "", status: nextStatus, plan: order.plan };
}
