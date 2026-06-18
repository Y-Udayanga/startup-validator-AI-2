import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listValidations, deleteValidation } from "@/lib/validations.functions";
import { getBilling } from "@/lib/billing.functions";
import { PlusCircle, FileText, Trash2, Loader2, BookOpen, CreditCard } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const list = useServerFn(listValidations);
  const del = useServerFn(deleteValidation);
  const billing = useServerFn(getBilling);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["validations"],
    queryFn: () => list({}),
  });
  const { data: bill } = useQuery({ queryKey: ["billing"], queryFn: () => billing({}) });

  const remove = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["validations"] });
      toast.success("Validation deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to delete"),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your validations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every idea you've tested, with its score and verdict.
          </p>
          {bill && (
            <p className="mt-2 text-xs text-muted-foreground">
              Plan: <span className="text-foreground">{bill.planName}</span> · {bill.used}
              {" / "}{bill.limit === -1 ? "∞" : bill.limit} validations this month
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/sources" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            <BookOpen className="h-4 w-4" /> Sources
          </Link>
          <Link to="/billing" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            <CreditCard className="h-4 w-4" /> Billing
          </Link>
          <Link
            to="/validate"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow"
          >
            <PlusCircle className="h-4 w-4" /> New validation
          </Link>
        </div>
      </div>

      <div className="mt-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-3">
            {data.map((v) => (
              <Link
                key={v.id}
                to="/validations/$id"
                params={{ id: v.id }}
                className="group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-surface/40 p-5 transition hover:border-primary/40"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-display text-lg font-semibold">{v.business_name}</h3>
                    <StatusBadge status={v.status} verdict={v.verdict} />
                  </div>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{v.idea}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {v.score != null && (
                    <div className="text-right">
                      <p className="font-display text-3xl font-bold text-gradient">{v.score}</p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">score</p>
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      if (confirm("Delete this validation?")) remove.mutate(v.id);
                    }}
                    className="rounded-md p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 p-16 text-center">
      <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
      <h3 className="mt-4 font-display text-xl font-semibold">No validations yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Submit your first startup idea to get a full AI report.
      </p>
      <Link
        to="/validate"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-gradient px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow"
      >
        <PlusCircle className="h-4 w-4" /> Validate an idea
      </Link>
    </div>
  );
}

function StatusBadge({ status, verdict }: { status: string; verdict: string | null }) {
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warning">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </span>
    );
  if (status === "failed")
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-destructive">
        Failed
      </span>
    );
  if (verdict)
    return (
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary">
        {verdict}
      </span>
    );
  return null;
}
