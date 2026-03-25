import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { ShieldCheck, Users, Activity, Tractor, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session || session.user.role !== "admin") {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

const adminTabs = [
  { label: "Usuários",    to: "/admin",               icon: Users,     exact: true  },
  { label: "Atividades",  to: "/admin/activities",    icon: Activity,  exact: false },
  { label: "Fazendas",    to: "/admin/fazendas",      icon: Tractor,   exact: false },
  { label: "Talhões",     to: "/admin/talhoes",       icon: Layers,    exact: false },
] as const;

function AdminLayout() {
  const { location } = useRouterState();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Painel Administrativo
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie usuários, permissões e configurações do sistema
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b overflow-x-auto scrollbar-none" style={{ scrollbarWidth: "none" }}>
        {adminTabs.map(({ label, to, icon: Icon, exact }) => {
          const isActive = exact
            ? location.pathname === to
            : location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo da sub-rota */}
      <Outlet />
    </div>
  );
}
