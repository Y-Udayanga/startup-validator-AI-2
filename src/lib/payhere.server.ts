import { createHash, timingSafeEqual } from "node:crypto";
import process from "node:process";
import { getSupabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS, type PlanId } from "./plans";

const PAID_STATUS = "2";
const CANCELLED_STATUS = "-2";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type PayHereMode = "checkout" | "recurring" | "preapproval";

let retrievalTokenCache:
  | {
      accessToken: string;
      expiresAt: number;
    }
  | undefined;

function md5Upper(value: string) {
  return createHash("md5").update(value).digest("hex").toUpperCase();
}

function base64Encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
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
  const mode = (process.env.PAYHERE_PAYMENT_MODE ?? "recurring").toLowerCase() as PayHereMode;
  const recurringPeriod = process.env.PAYHERE_RECURRING_PERIOD ?? "1 Month";
  const recurringDuration = process.env.PAYHERE_RECURRING_DURATION ?? "Forever";

  if (!merchantId || !merchantSecret) {
    throw new Error("Missing PayHere environment variables: PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET are required");
  }

  if (currency !== "LKR" && currency !== "USD") {
    throw new Error("PAYHERE_CURRENCY must be either LKR or USD");
  }

  if (!Number.isFinite(usdToLkrRate) || usdToLkrRate <= 0) {
    throw new Error("PAYHERE_USD_TO_LKR_RATE must be a positive number");
  }

  if (mode !== "checkout" && mode !== "recurring" && mode !== "preapproval") {
    throw new Error("PAYHERE_PAYMENT_MODE must be one of checkout, recurring, preapproval");
  }

  const actionPath = mode === "preapproval" ? "pay/preapprove" : "pay/checkout";

  return {
    merchantId,
    merchantSecret: decodeMerchantSecret(merchantSecret),
    sandbox,
    currency,
    usdToLkrRate,
    mode,
    recurringPeriod,
    recurringDuration,
    checkoutUrl: sandbox
      ? `https://sandbox.payhere.lk/${actionPath}`
      : `https://www.payhere.lk/${actionPath}`,
  };
}

export function getPayHereRetrievalConfig() {
  const sandbox = process.env.PAYHERE_SANDBOX !== "false";
  const appId = process.env.PAYHERE_APP_ID;
  const appSecret = process.env.PAYHERE_APP_SECRET;
  const authorizationCode = process.env.PAYHERE_AUTHORIZATION_CODE;

  const basicAuth = authorizationCode?.trim()
    ? authorizationCode.trim()
    : appId && appSecret
      ? base64Encode(`${appId}:${appSecret}`)
      : null;

  if (!basicAuth) return null;

  const baseUrl = sandbox ? "https://sandbox.payhere.lk" : "https://www.payhere.lk";
  return {
    sandbox,
    basicAuth,
    tokenUrl: `${baseUrl}/merchant/v1/oauth/token`,
    paymentSearchUrl: `${baseUrl}/merchant/v1/payment/search`,
  };
}

export function hasPayHereRetrievalConfig() {
  return !!getPayHereRetrievalConfig();
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
  subscription_id?: string;
  customer_token?: string;
  method?: string;
  message_type?: string;
  recurring?: string;
  item_recurrence?: string;
  item_duration?: string;
  item_rec_status?: string;
  item_rec_date_next?: string;
  item_rec_install_paid?: string;
  custom_1?: string;
  custom_2?: string;
  card_holder_name?: string;
  card_no?: string;
  card_expiry?: string;
};

type PayHereRetrievedPayment = {
  payment_id?: number | string;
  order_id?: string;
  date?: string;
  description?: string;
  status?: string;
  currency?: string;
  amount?: number;
  customer?: {
    fist_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  } | null;
  amount_detail?: {
    currency?: string;
    gross?: number;
    fee?: number;
    net?: number;
    exchange_rate?: number;
    exchange_from?: string;
    exchange_to?: string;
  } | null;
  payment_method?: {
    method?: string;
    card_customer_name?: string;
    card_no?: string;
  } | null;
  items?: unknown;
};

type PayHereRetrievalResponse =
  | {
      status: number;
      msg?: string;
      data: PayHereRetrievedPayment[] | null;
    }
  | {
      error: string;
      error_description?: string;
    };

function shouldActivatePlan(payload: PayHereCallbackPayload, status: ReturnType<typeof mapOrderStatus>) {
  if (status !== "paid") return false;

  // Preapproval callbacks return a customer token for future charges and should not auto-upgrade plans.
  if (payload.customer_token) return false;

  // Recurring callbacks include richer event names. If absent, treat as standard checkout success.
  if (!payload.message_type) return true;

  return (
    payload.message_type === "AUTHORIZATION_SUCCESS" ||
    payload.message_type === "RECURRING_INSTALLMENT_SUCCESS"
  );
}

function mapRetrievalStatus(status: string | undefined) {
  switch ((status ?? "").toUpperCase()) {
    case "RECEIVED":
    case "REFUND REQUESTED":
    case "REFUND PROCESSING":
      return "paid" as const;
    case "REFUNDED":
      return "cancelled" as const;
    case "CHARGEBACKED":
      return "failed" as const;
    default:
      return "pending" as const;
  }
}

function amountNumberToCents(amount: number | undefined) {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

async function activatePlanForOrder(order: { user_id: string; plan: string }) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
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
}

async function getPayHereAccessToken() {
  const config = getPayHereRetrievalConfig();
  if (!config) {
    throw new Error("Missing PayHere Retrieval API credentials. Set PAYHERE_AUTHORIZATION_CODE or PAYHERE_APP_ID and PAYHERE_APP_SECRET.");
  }

  if (retrievalTokenCache && retrievalTokenCache.expiresAt > Date.now() + 30_000) {
    return retrievalTokenCache.accessToken;
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${config.basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Failed to get PayHere access token");
  }

  retrievalTokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, (payload.expires_in ?? 0) - 30) * 1000,
  };

  return payload.access_token;
}

export async function retrievePayHerePayments(orderId: string) {
  const config = getPayHereRetrievalConfig();
  if (!config) {
    throw new Error("PayHere Retrieval API is not configured");
  }

  const accessToken = await getPayHereAccessToken();
  const url = new URL(config.paymentSearchUrl);
  url.searchParams.set("order_id", orderId);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const payload = (await response.json()) as PayHereRetrievalResponse;

  if ("error" in payload) {
    throw new Error(payload.error_description || payload.error);
  }

  if (payload.status === -2) {
    throw new Error(payload.msg || "Authentication error");
  }

  if (payload.status === -1 || !payload.data?.length) {
    return [];
  }

  return payload.data;
}

export async function reconcilePaymentOrderFromRetrieval(orderId: string) {
  const config = getPayHereRetrievalConfig();
  if (!config) return null;

  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const { data: order, error } = await admin
    .from("payment_orders")
    .select("id, user_id, plan, amount_cents, currency, status")
    .eq("payhere_order_id", orderId)
    .maybeSingle();

  if (error || !order) return null;

  const payments = await retrievePayHerePayments(orderId);
  if (!payments.length) return null;

  const payment =
    payments.find((item) => {
      const cents = amountNumberToCents(item.amount);
      return cents === order.amount_cents && (item.currency ?? "").toUpperCase() === order.currency.toUpperCase();
    }) ?? payments[0];

  const nextStatus = mapRetrievalStatus(payment.status);
  const update = {
    status: nextStatus,
    payhere_payment_id: payment.payment_id ? String(payment.payment_id) : null,
    payhere_status_message: payment.status ?? null,
    payhere_method: payment.payment_method?.method ?? null,
    payhere_card_holder_name: payment.payment_method?.card_customer_name ?? null,
    payhere_card_no: payment.payment_method?.card_no ?? null,
    paid_at: nextStatus === "paid" ? (order.status === "paid" ? undefined : new Date().toISOString()) : order.status === "paid" ? undefined : null,
  };

  await admin.from("payment_orders").update(update).eq("id", order.id);

  if (nextStatus === "paid" && order.status !== "paid") {
    await activatePlanForOrder(order);
  }

  return {
    orderId,
    status: nextStatus,
    plan: order.plan,
    paymentId: payment.payment_id ? String(payment.payment_id) : null,
    gatewayStatus: payment.status ?? null,
  };
}

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
  const recurring = payload.recurring === "1";
  const installPaid = payload.item_rec_install_paid ? Number.parseInt(payload.item_rec_install_paid, 10) : null;
  const orderUpdate = {
    status: nextStatus,
    payhere_payment_id: payload.payment_id ?? null,
    payhere_subscription_id: payload.subscription_id ?? null,
    payhere_customer_token: payload.customer_token ?? null,
    payhere_status_code: payload.status_code ?? null,
    payhere_status_message: payload.status_message ?? null,
    payhere_message_type: payload.message_type ?? null,
    payhere_method: payload.method ?? null,
    payhere_recurring: recurring,
    payhere_item_recurrence: payload.item_recurrence ?? null,
    payhere_item_duration: payload.item_duration ?? null,
    payhere_item_rec_status: payload.item_rec_status ?? null,
    payhere_item_rec_date_next: payload.item_rec_date_next ?? null,
    payhere_item_rec_install_paid: Number.isFinite(installPaid) ? installPaid : null,
    payhere_card_holder_name: payload.card_holder_name ?? null,
    payhere_card_no: payload.card_no ?? null,
    payhere_card_expiry: payload.card_expiry ?? null,
    payhere_custom_1: payload.custom_1 ?? null,
    payhere_custom_2: payload.custom_2 ?? null,
    paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
  };

  await admin.from("payment_orders").update(orderUpdate).eq("id", order.id);

  if (!shouldActivatePlan(payload, nextStatus)) {
    return { orderId: payload.order_id ?? "", status: nextStatus, plan: order.plan };
  }

  await activatePlanForOrder(order);

  return { orderId: payload.order_id ?? "", status: nextStatus, plan: order.plan };
}
