import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  ShieldAlert,
  Target,
  BarChart3,
  Lightbulb,
  Users,
  Rocket,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <LogosStrip />
      <Features />
      <HowItWorks />
      <ScoreShowcase />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-brand-gradient shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            Startup Validator <span className="text-gradient">AI</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
          <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
          <a href="#score" className="text-sm text-muted-foreground hover:text-foreground">Score</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-gradient px-4 py-2 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-radial-glow" aria-hidden />
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-24 text-center sm:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
          AI-powered idea validation · v1.0
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Validate your startup idea <br />
          <span className="text-gradient">before you invest</span> a dollar.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Get an AI-generated validation report on market demand, competition, SWOT, risks,
          revenue forecasts and a final startup score — in under 60 seconds.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Validate my idea <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#how"
            className="rounded-lg border border-border bg-surface/60 px-6 py-3 text-sm font-medium text-foreground backdrop-blur hover:bg-surface"
          >
            See how it works
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="relative mx-auto mt-16 max-w-4xl"
        >
          <div className="glass rounded-2xl p-2 shadow-violet">
            <div className="rounded-xl border border-border/60 bg-background/60 p-6 text-left">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Startup Score</p>
                  <p className="font-display text-3xl font-semibold">SmartCrop AI</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-5xl font-bold text-gradient">83</p>
                  <p className="text-xs text-success">🟢 Strong Idea</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-5 gap-3">
                {[
                  ["Demand", 87],
                  ["Compet.", 70],
                  ["Profit.", 80],
                  ["Scale", 92],
                  ["Innov.", 85],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-lg border border-border/60 bg-surface/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                    <p className="mt-1 font-display text-2xl font-semibold">{v}</p>
                    <div className="mt-2 h-1 overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-brand-gradient"
                        style={{ width: `${v}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function LogosStrip() {
  return (
    <div className="border-y border-border/50 bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-6 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Built for founders, students, incubators and investors
        </p>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: Lightbulb, title: "Idea Understanding", desc: "AI extracts your core problem, solution, audience and unique value proposition." },
  { icon: TrendingUp, title: "Market Demand", desc: "Demand score backed by industry trends, consumer interest and seasonality." },
  { icon: Target, title: "Competitor Analysis", desc: "Real competitors, their strengths and weaknesses, and gaps to exploit." },
  { icon: ShieldAlert, title: "Risk Assessment", desc: "Technical, financial and market risks scored with concrete mitigations." },
  { icon: BarChart3, title: "Revenue Forecast", desc: "Realistic 5-year revenue projections shown as charts you can act on." },
  { icon: Rocket, title: "Final Startup Score", desc: "One number that tells you if your idea is Strong, Promising, Risky or Weak." },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          A full <span className="text-gradient">consulting team</span><br />in one report.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Market analyst, business consultant, risk expert and startup mentor — combined.
        </p>
      </div>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.04 }}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-surface/40 p-6 transition hover:border-primary/40"
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-gradient shadow-glow">
              <f.icon className="h-5 w-5 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", t: "Submit your idea", d: "Tell us the business name, idea, industry, country, audience, budget and model." },
  { n: "02", t: "AI runs validation", d: "We analyze market demand, competitors, risks, revenue and scalability in parallel." },
  { n: "03", t: "Get your report", d: "SWOT, risk matrix, 5-year revenue forecast and a final score with verdict." },
];

function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/50 bg-surface/30">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            From idea to verdict in <span className="text-gradient">3 steps</span>.
          </h2>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-xl border border-border/60 bg-background/40 p-6">
              <p className="font-display text-5xl font-bold text-gradient">{s.n}</p>
              <h3 className="mt-4 font-display text-xl font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ScoreShowcase() {
  const items = [
    "Real competitor benchmarking",
    "SWOT generated from your context",
    "Risk scores with mitigations",
    "5-year revenue projection",
    "Investor-style verdict",
    "Save unlimited validations",
  ];
  return (
    <section id="score" className="mx-auto max-w-7xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            One number. <span className="text-gradient">One clear verdict.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every idea gets a final 0–100 startup score and a verdict — Strong, Promising, Risky or
            Weak — backed by every dimension we measured.
          </p>
          <ul className="mt-8 space-y-3">
            {items.map((i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {i}
              </li>
            ))}
          </ul>
          <Link
            to="/auth"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-6 py-3 text-sm font-medium text-primary-foreground shadow-glow"
          >
            Start validating <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="glass rounded-2xl p-6 shadow-violet">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Verdict</p>
              <p className="mt-1 font-display text-2xl">🟢 Strong Business Idea</p>
            </div>
            <p className="font-display text-7xl font-bold text-gradient">83</p>
          </div>
          <div className="mt-6 space-y-3">
            {[
              ["Demand", 87, "chart-1"],
              ["Competition", 70, "chart-2"],
              ["Profitability", 80, "chart-3"],
              ["Scalability", 92, "chart-1"],
              ["Innovation", 85, "chart-2"],
            ].map(([k, v]) => (
              <div key={k as string}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{k}</span>
                  <span>{v}/100</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-brand-gradient"
                    style={{ width: `${v}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-surface/40 p-10 text-center shadow-violet">
        <div className="absolute inset-0 bg-radial-glow opacity-60" aria-hidden />
        <div className="relative">
          <Users className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop guessing. Start <span className="text-gradient">validating</span>.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Join founders using Startup Validator AI to test ideas before they burn
            time and money.
          </p>
          <Link
            to="/auth"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-8 py-3 text-base font-medium text-primary-foreground shadow-glow"
          >
            Create free account <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/50">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} Startup Validator AI</p>
        <p>Validate your startup idea before you invest your time and money.</p>
      </div>
    </footer>
  );
}
