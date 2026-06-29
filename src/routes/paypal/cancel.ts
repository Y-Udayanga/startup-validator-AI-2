import { createFileRoute } from "@tanstack/react-router";
import { cancelPayPalOrder } from "@/lib/paypal.server";

export const Route = createFileRoute("/paypal/cancel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const orderId = url.searchParams.get("order_id");
        await cancelPayPalOrder(orderId);
        const params = new URLSearchParams({ payment: "cancelled" });
        if (orderId) params.set("order_id", orderId);
        return new Response(null, {
          status: 302,
          headers: { Location: `/billing?${params.toString()}` },
        });
      },
    },
  },
});
