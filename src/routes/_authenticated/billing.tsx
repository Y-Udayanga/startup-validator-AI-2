import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getBilling, startPayHereCheckout } from "@/lib/billing.functions";
import { PLANS, type PlanId } from "@/lib/plans";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, CreditCard, ExternalLink, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function submitPayHereForm(action: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action;
  form.style.display = "none";

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

function BillingPage() {
  const billingFn = useServerFn(getBilling);
  const checkoutFn = useServerFn(startPayHereCheckout);
  const queryClient = useQueryClient();
  const [pendingPlanId, setPendingPlanId] = useState<PlanId | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => billingFn({}) });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    const detail = params.get("detail");
    if (!payment) return;

    if (payment === "paid") {
      toast.success("Payment confirmed. Your plan is now active.");
    } else if (payment === "cancelled") {
      toast.info("Payment cancelled.");
    } else if (payment === "pending") {
      toast.info(detail ?? "Your payment is pending confirmation.");
    } else {
      toast.error(detail ?? "Payment could not be verified.");
    }

    queryClient.invalidateQueries({ queryKey: ["billing"] });
    window.history.replaceState({}, "", window.location.pathname);
  }, [queryClient]);

  const checkout = useMutation({
    mutationFn: async (planId: Extract<PlanId, "pro" | "business">) => {
      setPendingPlanId(planId);
      return checkoutFn({ data: { planId } });
    },
    onSuccess: (payload) => {
      try {
        submitPayHereForm(payload.checkoutUrl, payload.fields);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to redirect to PayHere");
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to start PayHere checkout");
    },
    onSettled: () => {
      setPendingPlanId(null);
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CreditCard className="h-4 w-4 text-primary" /> Plans & billing
      </div>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Pick the plan that fits how <span className="text-gradient">fast you ship</span>
      </h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        PayHere sandbox is live for upgrades. Choose a paid plan and you will be redirected to the PayHere checkout page.
      </p>

      {isLoading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : data && (
        <>
          <div className="mt-6 rounded-2xl border border-border/60 bg-surface/40 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</p>
                <p className="font-display text-2xl font-semibold">{data.planName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{data.gateway}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Usage</p>
                <p className="font-display text-2xl font-semibold">
                  {data.used}<span className="text-muted-foreground"> / {data.limit === -1 ? "∞" : data.limit}</span>
                  <span className="ml-2 text-xs text-muted-foreground">validations this month</span>
                </p>
              </div>
            </div>
            {data.limit !== -1 && (
              <div className="mt-3 h-1.5 overflow-hidden rounded bg-muted">
                <div className="h-full bg-brand-gradient" style={{ width: `${Math.min(100, (data.used / data.limit) * 100)}%` }} />
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Secure hash generated on the server
              </div>
              {data.currentPeriodEnd && (
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-1.5">
                  Active until {new Date(data.currentPeriodEnd).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {data.recentOrders.length > 0 && (
            <div className="mt-4 rounded-2xl border border-border/60 bg-background/30 p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Recent payment attempts</p>
              <div className="mt-3 grid gap-2">
                {data.recentOrders.map((order) => (
                  <div key={order.payhere_order_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-surface/30 px-4 py-3 text-sm">
                    <div>
                      <p className="font-medium">{PLANS[order.plan as PlanId]?.name ?? order.plan} plan</p>
                      <p className="text-xs text-muted-foreground">{order.payhere_order_id}</p>
                      {(order.payhere_method || order.payhere_card_no || order.payhere_status_message) && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[
                            order.payhere_method,
                            order.payhere_card_no,
                            order.payhere_status_message,
                          ]
                            .filter(Boolean)
                            .join(" • ")}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{order.currency} {(order.amount_cents / 100).toFixed(2)}</p>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {Object.values(PLANS).map((p) => {
          const isCurrent = data?.plan === p.id;
          const isCheckoutPlan = p.id === "pro" || p.id === "business";
          const isPending = pendingPlanId === p.id && checkout.isPending;
          return (
            <div key={p.id} className={`rounded-2xl border p-6 ${p.id === "pro" ? "border-primary/60 bg-primary/5 shadow-glow" : "border-border/60 bg-surface/40"}`}>
              {p.id === "pro" && (
                <p className="mb-3 inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-foreground">
                  <Sparkles className="h-3 w-3" /> Most popular
                </p>
              )}
              <h3 className="font-display text-xl font-semibold">{p.name}</h3>
              <p className="mt-2">
                <span className="font-display text-4xl font-bold">${p.price}</span>
                <span className="text-sm text-muted-foreground"> /mo</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {f}</li>
                ))}
              </ul>
              <button
                disabled={isCurrent || !isCheckoutPlan || checkout.isPending}
                onClick={() => {
                  if (!isCheckoutPlan) return;
                  checkout.mutate(p.id as Extract<PlanId, "pro" | "business">);
                }}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isCurrent || !isCheckoutPlan
                    ? "border border-border bg-background/40 text-muted-foreground"
                    : "bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-90"
                }`}
              >
                {isCurrent
                  ? "Current plan"
                  : !isCheckoutPlan
                    ? "Included"
                    : isPending
                      ? "Redirecting to PayHere..."
                      : `Upgrade with PayHere`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border/60 bg-surface/20 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Sandbox notes</p>
        <p className="mt-2">
          Payments are submitted to PayHere using a secure form POST and come back here automatically after checkout. A public deployment URL is recommended if you want server-to-server notify callbacks during testing.
        </p>
        <a
          href="https://support.payhere.lk/api-&-mobile-sdk/payhere-checkout"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-primary hover:underline"
        >
          PayHere checkout reference <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
