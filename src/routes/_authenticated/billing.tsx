import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getBilling } from "@/lib/billing.functions";
import { PLANS } from "@/lib/plans";
import { ArrowLeft, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/billing")({
  component: BillingPage,
});

function BillingPage() {
  const fn = useServerFn(getBilling);
  const { data, isLoading } = useQuery({ queryKey: ["billing"], queryFn: () => fn({}) });

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

      {isLoading ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : data && (
        <div className="mt-6 rounded-2xl border border-border/60 bg-surface/40 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Current plan</p>
              <p className="font-display text-2xl font-semibold">{data.planName}</p>
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
        </div>
      )}

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {Object.values(PLANS).map((p) => {
          const isCurrent = data?.plan === p.id;
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
                disabled={isCurrent}
                onClick={() => toast.info("Stripe billing setup is in progress — once enabled, this button will redirect you to checkout.")}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                  isCurrent
                    ? "border border-border bg-background/40 text-muted-foreground"
                    : "bg-brand-gradient text-primary-foreground shadow-glow hover:opacity-90"
                }`}
              >
                {isCurrent ? "Current plan" : p.price === 0 ? "Free forever" : `Upgrade to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Stripe billing is being configured — your usage limits are already enforced. Plan upgrades go live as soon as billing is connected.
      </p>
    </div>
  );
}
