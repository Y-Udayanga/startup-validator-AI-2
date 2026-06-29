import { createFileRoute } from "@tanstack/react-router";
import { finalizePayment, reconcilePaymentOrderFromRetrieval, type PayHereCallbackPayload } from "@/lib/payhere.server";

function toBillingRedirect(status: string, orderId: string | null, detail?: string) {
  const params = new URLSearchParams({ payment: status });
  if (orderId) params.set("order_id", orderId);
  if (detail) params.set("detail", detail);
  return new Response(null, {
    status: 302,
    headers: { Location: `/billing?${params.toString()}` },
  });
}

async function readPayload(request: Request): Promise<PayHereCallbackPayload> {
  if (request.method === "POST") {
    const body = await request.text();
    const form = new URLSearchParams(body);
    return Object.fromEntries(form.entries());
  }

  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export const Route = createFileRoute("/payhere/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const payload = await readPayload(request);
        if (!payload.status_code || !payload.md5sig) {
          if (payload.order_id) {
            try {
              const result = await reconcilePaymentOrderFromRetrieval(payload.order_id);
              if (result) {
                return toBillingRedirect(result.status, result.orderId);
              }
            } catch (error) {
              console.error("[PayHere return retrieval]", error);
            }
          }

          return toBillingRedirect("pending", payload.order_id ?? null, "Waiting for payment confirmation");
        }

        try {
          const result = await finalizePayment(payload);
          return toBillingRedirect(result.status, result.orderId);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Payment verification failed";
          return toBillingRedirect("failed", payload.order_id ?? null, detail);
        }
      },
      POST: async ({ request }) => {
        const payload = await readPayload(request);
        try {
          const result = await finalizePayment(payload);
          return toBillingRedirect(result.status, result.orderId);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Payment verification failed";
          return toBillingRedirect("failed", payload.order_id ?? null, detail);
        }
      },
    },
  },
});
