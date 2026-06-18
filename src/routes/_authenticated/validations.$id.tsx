import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getValidation } from "@/lib/validations.functions";
import { generateBusinessPlan, getBusinessPlan, type BusinessPlan } from "@/lib/business-plan.functions";
import { exportBusinessPlanPdf } from "@/lib/business-plan-pdf";
import type { ValidationReport } from "@/lib/validate.functions";
import {
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  TrendingUp,
  ShieldAlert,
  Lightbulb,
  Target,
  CheckCircle2,
  Loader2,
  Briefcase,
  FileDown,
  Award,
  BookOpen,
  XCircle,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/validations/$id")({
  component: ValidationDetail,
});

function ValidationDetail() {
  const { id } = Route.useParams();
  const get = useServerFn(getValidation);
  const getPlan = useServerFn(getBusinessPlan);
  const genPlan = useServerFn(generateBusinessPlan);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["validation", id],
    queryFn: () => get({ data: { id } }),
  });

  const { data: planRow } = useQuery({
    queryKey: ["business-plan", id],
    queryFn: () => getPlan({ data: { validation_id: id } }),
    enabled: !!data?.report,
  });

  const generate = useMutation({
    mutationFn: () => genPlan({ data: { validation_id: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business-plan", id] });
      toast.success("Business plan generated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (isLoading)
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-destructive">{(error as Error)?.message ?? "Not found"}</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm text-primary">← Back to dashboard</Link>
      </div>
    );

  if (data.status === "failed")
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <h2 className="font-display text-xl font-semibold text-destructive">Validation failed</h2>
          <p className="mt-2 text-sm text-muted-foreground">{data.error}</p>
        </div>
      </div>
    );

  const report = data.report as unknown as ValidationReport | null;
  if (!report)
    return (
      <div className="mx-auto max-w-3xl px-6 py-10 text-center text-muted-foreground">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        <p className="mt-3 text-sm">Generating report…</p>
      </div>
    );

  const verdictTone =
    report.verdict === "Strong" ? "text-success"
    : report.verdict === "Promising" ? "text-primary"
    : report.verdict === "Risky" ? "text-warning"
    : "text-destructive";

  const scoreData = Object.entries(report.scores).map(([k, v]) => ({
    metric: k.charAt(0).toUpperCase() + k.slice(1),
    value: v,
  }));

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      {/* Hero */}
      <div className="mt-6 grid gap-6 rounded-2xl border border-border/60 bg-surface/40 p-8 shadow-violet lg:grid-cols-[1fr_auto]">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Startup</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{data.business_name}</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{data.idea}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {[data.industry, data.country, data.audience, data.business_model, data.budget].filter(Boolean).map((t) => (
              <span key={t as string} className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-muted-foreground">{t as string}</span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end justify-center">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Final score</p>
          <p className="font-display text-7xl font-bold text-gradient">{report.final_score}</p>
          <p className={`mt-1 font-display text-lg font-semibold ${verdictTone}`}>{report.verdict}</p>
        </div>
      </div>

      {/* RAG citations */}
      {report.rag_citations && report.rag_citations.length > 0 && (
        <Section icon={BookOpen} title="Insights from your sources">
          <div className="grid gap-2">
            {report.rag_citations.map((c, i) => (
              <div key={i} className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-primary">{c.source_title}</p>
                <p className="mt-1">{c.insight}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Summary */}
      <Section icon={Lightbulb} title="Idea understanding">
        <div className="grid gap-4 sm:grid-cols-2">
          <Pair k="Problem" v={report.summary.problem} />
          <Pair k="Solution" v={report.summary.solution} />
          <Pair k="Target users" v={report.summary.target_users} />
          <Pair k="Unique value" v={report.summary.unique_value} />
        </div>
      </Section>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader icon={TrendingUp} title="Score breakdown" />
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={scoreData}>
                <PolarGrid stroke="oklch(1 0 0 / 0.1)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "oklch(0.7 0.02 270)", fontSize: 12 }} />
                <Radar dataKey="value" stroke="oklch(0.78 0.18 200)" fill="oklch(0.78 0.18 200)" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader icon={TrendingUp} title="Market demand" />
          <div className="flex items-baseline gap-3">
            <p className="font-display text-5xl font-bold text-gradient">{report.market.demand_score}</p>
            <p className="text-sm text-muted-foreground">/ 100</p>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{report.market.reason}</p>
          <ul className="mt-4 space-y-2">
            {report.market.trends.map((t) => (
              <li key={t} className="flex gap-2 text-sm"><span className="text-primary">›</span>{t}</li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Investor Readiness */}
      <Section icon={Award} title="Investor readiness">
        <div className="rounded-2xl border border-border/60 bg-surface/40 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Score</p>
              <p className="font-display text-5xl font-bold text-gradient">{report.investor_readiness.score}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Stage</p>
              <p className="font-display text-2xl font-semibold">{report.investor_readiness.stage}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">{report.investor_readiness.explanation}</p>

          <div className="mt-6 grid gap-3">
            {report.investor_readiness.checklist.map((c) => (
              <div key={c.item} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-start gap-3">
                  <StatusIcon status={c.status} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h4 className="font-display text-base font-semibold">{c.item}</h4>
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.metric}</span>
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-wider text-primary">Why it matters</p>
                    <p className="text-sm text-muted-foreground">{c.why_it_matters}</p>
                    <p className="mt-2 text-xs uppercase tracking-wider text-primary">Evidence</p>
                    <p className="text-sm text-muted-foreground">{c.evidence}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Competitors */}
      <Section icon={Target} title="Competitor analysis">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {report.competitors.map((c) => (
            <div key={c.name} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <h4 className="font-display text-base font-semibold">{c.name}</h4>
              <p className="mt-2 text-xs uppercase tracking-wider text-success">Strengths</p>
              <p className="text-sm text-muted-foreground">{c.strengths}</p>
              <p className="mt-2 text-xs uppercase tracking-wider text-destructive">Weaknesses</p>
              <p className="text-sm text-muted-foreground">{c.weaknesses}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-xs uppercase tracking-wider text-primary">Gap opportunity</p>
          <p className="mt-1 text-sm">{report.gap_opportunity}</p>
        </div>
      </Section>

      {/* SWOT */}
      <Section icon={CheckCircle2} title="SWOT analysis">
        <div className="grid gap-4 sm:grid-cols-2">
          <SwotBox title="Strengths" tone="success" items={report.swot.strengths} />
          <SwotBox title="Weaknesses" tone="destructive" items={report.swot.weaknesses} />
          <SwotBox title="Opportunities" tone="primary" items={report.swot.opportunities} />
          <SwotBox title="Threats" tone="warning" items={report.swot.threats} />
        </div>
      </Section>

      {/* Risks */}
      <Section icon={ShieldAlert} title="Risk assessment">
        <div className="space-y-3">
          {report.risks.map((r) => (
            <div key={r.label} className="rounded-xl border border-border/60 bg-background/40 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.category}</p>
                </div>
                <p className="font-display text-2xl font-bold">{r.score}%</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
                <div
                  className="h-full"
                  style={{
                    width: `${r.score}%`,
                    background: r.score > 60 ? "var(--destructive)" : r.score > 35 ? "var(--warning)" : "var(--success)",
                  }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                <span className="text-xs uppercase tracking-wider text-primary">Mitigation: </span>{r.mitigation}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Revenue */}
      <Section icon={TrendingUp} title="Revenue forecast">
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={report.revenue_forecast}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="year" tick={{ fill: "oklch(0.7 0.02 270)", fontSize: 12 }} />
              <YAxis tick={{ fill: "oklch(0.7 0.02 270)", fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "oklch(0.22 0.03 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
              />
              <Line type="monotone" dataKey="revenue_usd" stroke="oklch(0.78 0.18 200)" strokeWidth={3} dot={{ fill: "oklch(0.68 0.22 305)", r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Recommendations */}
      <Section icon={Lightbulb} title="Next steps">
        <ul className="space-y-2">
          {report.recommendations.map((r, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
              <span className="font-display font-bold text-gradient">{i + 1}.</span>{r}
            </li>
          ))}
        </ul>
      </Section>

      {/* Business Plan */}
      <Section icon={Briefcase} title="AI business plan">
        {!planRow || planRow.status === "failed" ? (
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Generate a complete business plan tailored to this validation — executive summary, marketing,
              operations and financials.
            </p>
            {planRow?.status === "failed" && (
              <p className="mt-2 text-xs text-destructive">{planRow.error}</p>
            )}
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow disabled:opacity-60"
            >
              {generate.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Briefcase className="h-4 w-4" /> Generate business plan</>}
            </button>
          </div>
        ) : planRow.status === "running" ? (
          <div className="rounded-2xl border border-border/60 bg-surface/40 p-6 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            <p className="mt-2 text-sm">Generating business plan…</p>
          </div>
        ) : (
          <BusinessPlanView
            plan={planRow.plan as unknown as BusinessPlan}
            onExport={() =>
              exportBusinessPlanPdf({
                businessName: data.business_name,
                idea: data.idea,
                plan: planRow.plan as unknown as BusinessPlan,
              })
            }
            onRegenerate={() => generate.mutate()}
            regenerating={generate.isPending}
          />
        )}
      </Section>
    </div>
  );
}

function BusinessPlanView({
  plan,
  onExport,
  onRegenerate,
  regenerating,
}: {
  plan: BusinessPlan;
  onExport: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const fmt = (n: number) => "$" + n.toLocaleString();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="rounded-lg border border-border bg-surface/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow"
        >
          <FileDown className="h-4 w-4" /> Export PDF
        </button>
      </div>

      <PlanBlock title="Executive summary">
        <Pair k="Overview" v={plan.executive_summary.overview} />
        <Pair k="Mission" v={plan.executive_summary.mission} />
        <Pair k="Vision" v={plan.executive_summary.vision} />
        <ListPair k="Objectives" items={plan.executive_summary.objectives} />
      </PlanBlock>

      <PlanBlock title="Company">
        <Pair k="Legal structure" v={plan.company_description.legal_structure} />
        <Pair k="Location" v={plan.company_description.location} />
        <Pair k="Stage" v={plan.company_description.stage} />
        <ListPair k="Team needs" items={plan.company_description.team_needs} />
      </PlanBlock>

      <PlanBlock title="Market">
        <Pair k="Industry overview" v={plan.market_analysis.industry_overview} />
        <Pair k="Target market" v={plan.market_analysis.target_market} />
        <Pair k="Market size estimate" v={plan.market_analysis.market_size_estimate} />
        <ListPair k="Customer segments" items={plan.market_analysis.customer_segments} />
      </PlanBlock>

      <PlanBlock title="Marketing">
        <Pair k="Positioning" v={plan.marketing_strategy.positioning} />
        <Pair k="Pricing strategy" v={plan.marketing_strategy.pricing_strategy} />
        <ListPair k="Acquisition channels" items={plan.marketing_strategy.acquisition_channels} />
        <ListPair k="Growth tactics" items={plan.marketing_strategy.growth_tactics} />
      </PlanBlock>

      <PlanBlock title="Operations">
        <ListPair k="Key activities" items={plan.operations_plan.key_activities} />
        <ListPair k="Key resources" items={plan.operations_plan.key_resources} />
        <ListPair k="Tech stack" items={plan.operations_plan.tech_stack} />
        <ListPair k="Suppliers / partners" items={plan.operations_plan.suppliers_partners} />
      </PlanBlock>

      <PlanBlock title="Financial plan">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Startup costs" value={fmt(plan.financial_plan.startup_costs_usd)} />
          <Stat label="Monthly burn" value={fmt(plan.financial_plan.monthly_burn_usd)} />
          <Stat label="Break-even" value={`${plan.financial_plan.breakeven_months} mo`} />
          <Stat label="Funding needed" value={fmt(plan.financial_plan.funding_needed_usd)} />
        </div>
        <ListPair k="Revenue streams" items={plan.financial_plan.revenue_streams} />
        <ListPair k="Key assumptions" items={plan.financial_plan.key_assumptions} />
      </PlanBlock>

      <PlanBlock title="Milestones">
        <ol className="space-y-2">
          {plan.milestones.map((m, i) => (
            <li key={i} className="flex gap-3 rounded-lg border border-border/60 bg-background/40 p-3 text-sm">
              <span className="font-display text-sm font-bold text-gradient">M{m.month}</span>
              {m.goal}
            </li>
          ))}
        </ol>
      </PlanBlock>

      <PlanBlock title="Risks & mitigations">
        <div className="space-y-2">
          {plan.risks_and_mitigations.map((r, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-background/40 p-3">
              <p className="text-sm"><span className="text-destructive">Risk:</span> {r.risk}</p>
              <p className="mt-1 text-sm"><span className="text-primary">Mitigation:</span> {r.mitigation}</p>
            </div>
          ))}
        </div>
      </PlanBlock>
    </div>
  );
}

function PlanBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-6">
      <h4 className="font-display text-lg font-semibold">{title}</h4>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}
function ListPair({ k, items }: { k: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
      <ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">
        {items.map((it) => <li key={it}>{it}</li>)}
      </ul>
    </div>
  );
}
function StatusIcon({ status }: { status: "complete" | "partial" | "missing" }) {
  if (status === "complete") return <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />;
  if (status === "partial") return <CircleDot className="h-5 w-5 shrink-0 text-warning" />;
  return <XCircle className="h-5 w-5 shrink-0 text-destructive" />;
}

function Section({ icon: Icon, title, children }: { icon: typeof Lightbulb; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-display text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-border/60 bg-surface/40 p-6">{children}</div>;
}
function CardHeader({ icon: Icon, title }: { icon: typeof Lightbulb; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="font-display text-base font-semibold">{title}</h3>
    </div>
  );
}
function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{k}</p>
      <p className="mt-1 text-sm">{v}</p>
    </div>
  );
}
function SwotBox({ title, tone, items }: { title: string; tone: "success" | "destructive" | "primary" | "warning"; items: string[] }) {
  const toneClass =
    tone === "success" ? "border-success/40 text-success"
    : tone === "destructive" ? "border-destructive/40 text-destructive"
    : tone === "warning" ? "border-warning/40 text-warning"
    : "border-primary/40 text-primary";
  return (
    <div className={`rounded-xl border bg-background/40 p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wider">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((i) => <li key={i} className="text-sm text-foreground">• {i}</li>)}
      </ul>
    </div>
  );
}
