import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Sparkles, LayoutDashboard, PlusCircle, LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(user?.email ?? null);

  useEffect(() => {
    setEmail(user?.email ?? null);
  }, [user]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border/50 bg-surface/40 backdrop-blur md:block">
        <div className="flex h-full flex-col">
          <Link to="/" className="flex items-center gap-2 border-b border-border/50 px-5 py-4">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-brand-gradient shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">Validator AI</span>
          </Link>
          <nav className="flex-1 space-y-1 p-3">
            <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/validate" icon={PlusCircle} label="New validation" />
          </nav>
          <div className="border-t border-border/50 p-3">
            <div className="rounded-lg bg-background/40 p-3 text-xs">
              <p className="truncate text-muted-foreground">{email}</p>
            </div>
            <button
              onClick={signOut}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/70 px-4 py-3 backdrop-blur md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-brand-gradient">
            <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-display text-sm font-semibold">Validator AI</span>
        </Link>
        <button onClick={signOut} className="text-sm text-muted-foreground">
          Sign out
        </button>
      </header>

      <main className="md:pl-60">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-surface hover:text-foreground"
      activeProps={{ className: "bg-surface text-foreground" }}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
