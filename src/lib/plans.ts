// Shared plan config (safe for client + server import — no secrets)
export type PlanId = "free" | "pro" | "business";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: number; // monthly USD
  validationsPerMonth: number; // -1 = unlimited
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    validationsPerMonth: 3,
    features: [
      "3 AI validations / month",
      "Full report + SWOT + risks",
      "Investor readiness scoring",
      "1 RAG source",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 19,
    validationsPerMonth: 25,
    features: [
      "25 validations / month",
      "AI business plan + PDF export",
      "Unlimited RAG sources",
      "Priority AI compute",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    price: 49,
    validationsPerMonth: -1,
    features: [
      "Unlimited validations",
      "Everything in Pro",
      "Team seats (coming soon)",
      "Email support",
    ],
  },
};

export function planLimit(plan: string): number {
  return PLANS[(plan as PlanId) in PLANS ? (plan as PlanId) : "free"].validationsPerMonth;
}

export function isUnlimited(plan: string): boolean {
  return planLimit(plan) === -1;
}
