import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { createValidation } from "@/lib/validate.functions";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/validate")({
  component: ValidatePage,
});

function ValidatePage() {
  const fn = useServerFn(createValidation);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    business_name: "",
    idea: "",
    industry: "",
    country: "",
    audience: "",
    budget: "",
    business_model: "",
  });

  const mut = useMutation({
    mutationFn: () => fn({ data: form }),
    onSuccess: ({ id }) => navigate({ to: "/validations/$id", params: { id } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Validation failed"),
  });

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" /> New validation
      </div>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
        Tell us about your <span className="text-gradient">startup idea</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        We'll run market, competitor, SWOT, risk and revenue analysis. Takes about 30–60 seconds.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mut.mutate();
        }}
        className="mt-8 space-y-5 rounded-2xl border border-border/60 bg-surface/40 p-6"
      >
        <Field label="Business Name" required>
          <input
            required
            maxLength={120}
            value={form.business_name}
            onChange={(e) => update("business_name", e.target.value)}
            placeholder="SmartCrop AI"
            className="input"
          />
        </Field>

        <Field label="Business Idea" required hint="20–4000 characters. Be specific.">
          <textarea
            required
            minLength={20}
            maxLength={4000}
            value={form.idea}
            onChange={(e) => update("idea", e.target.value)}
            rows={5}
            placeholder="AI-powered mobile app that helps farmers detect plant diseases from a photo and recommends treatment."
            className="input resize-y"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Industry">
            <input
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
              placeholder="Agriculture Technology"
              className="input"
            />
          </Field>
          <Field label="Country / Market">
            <input
              value={form.country}
              onChange={(e) => update("country", e.target.value)}
              placeholder="Sri Lanka"
              className="input"
            />
          </Field>
          <Field label="Target Audience">
            <input
              value={form.audience}
              onChange={(e) => update("audience", e.target.value)}
              placeholder="Smallholder farmers"
              className="input"
            />
          </Field>
          <Field label="Budget (USD)">
            <input
              value={form.budget}
              onChange={(e) => update("budget", e.target.value)}
              placeholder="$2,000"
              className="input"
            />
          </Field>
          <Field label="Business Model">
            <select
              value={form.business_model}
              onChange={(e) => update("business_model", e.target.value)}
              className="input"
            >
              <option value="">Select…</option>
              <option>Subscription</option>
              <option>Freemium</option>
              <option>One-time payment</option>
              <option>Marketplace</option>
              <option>Ads</option>
              <option>Enterprise / B2B</option>
              <option>Other</option>
            </select>
          </Field>
        </div>

        <button
          type="submit"
          disabled={mut.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-gradient px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-60"
        >
          {mut.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running AI validation…
            </>
          ) : (
            "Run AI validation"
          )}
        </button>

        {mut.isPending && (
          <p className="text-center text-xs text-muted-foreground">
            Analyzing market, competitors, risks and revenue — this can take 30–60 seconds.
          </p>
        )}
      </form>

      <style>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--input);
          background: var(--surface);
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: var(--primary); }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
