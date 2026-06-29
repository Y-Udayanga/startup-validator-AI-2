import { createFileRoute } from "@tanstack/react-router";
import { finalizePayment } from "@/lib/payhere.server";

export const Route = createFileRoute("/payhere/notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.text();
          const form = new URLSearchParams(body);
          const payload = Object.fromEntries(form.entries());
          await finalizePayment(payload);
          return new Response("ok", { status: 200 });
        } catch (error) {
          console.error("[PayHere notify]", error);
          return new Response("invalid", { status: 400 });
        }
      },
    },
  },
});
