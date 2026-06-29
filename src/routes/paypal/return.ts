import { createFileRoute } from "@tanstack/react-router";
import { capturePayPalOrder } from "@/lib/paypal.server";

function toBillingRedirect(status: string, orderId: string | null, detail?: string) {
  const params = new URLSearchParams({ payment: status });
  if (orderId) params.set("order_id", orderId);
  if (detail) params.set("detail", detail);
  return new Response(null, {
    status: 302,
    headers: { Location: `/billing?${params.toString()}` },
  });
}

export const Route = createFileRoute("/paypal/return")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const merchantOrderId = url.searchParams.get("order_id");
        const paypalOrderId = url.searchParams.get("token");

        if (!merchantOrderId || !paypalOrderId) {
          return toBillingRedirect("failed", merchantOrderId, "Missing PayPal return parameters");
        }

        try {
          const result = await capturePayPalOrder({ merchantOrderId, paypalOrderId });
          return toBillingRedirect(result.status, result.orderId);
        } catch (error) {
          const detail = error instanceof Error ? error.message : "PayPal payment verification failed";
          return toBillingRedirect("failed", merchantOrderId, detail);
        }
      },
    },
  },
});
