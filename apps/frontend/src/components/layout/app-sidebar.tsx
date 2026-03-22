import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  Settings,
  TreePine,
  LogOut,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "@/lib/auth-client";

const baseNavItems = [
  { label: "Dashboard",   to: "/dashboard",   icon: LayoutDashboard },
  { label: "Relatórios",  to: "/reports",     icon: FileText        },
  { label: "Programação", to: "/programacao", icon: CalendarDays    },
  { label: "Configurações", to: "/settings",  icon: Settings        },
] as const;

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const navigate = useNavigate();
  const { location } = useRouterState();
  const { data: session } = useSession();

  const isAdmin = session?.user?.role === "admin";

  async function handleSignOut() {
    try { localStorage.removeItem("gankyo:session"); } catch {}
    await signOut();
    navigate({ to: "/login" });
  }

  function handleNavClick() {
    onClose();
  }

  return (
    <aside
      className={cn(
        // Mobile: drawer fixo que desliza
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col",
        "bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border",
        "transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Desktop: sempre visível, posição relativa
        "md:relative md:translate-x-0"
      )}
    >
      {/* Logo + botão fechar (mobile) */}
      <div className="flex items-center justify-between gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <TreePine size={20} />
          </div>
          <span className="text-lg font-bold tracking-tight">Gankyo</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-md hover:bg-sidebar-accent/60 transition-colors"
          aria-label="Fechar menu"
        >
          <X size={18} className="text-sidebar-foreground/70" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {baseNavItems.map(({ label, to, icon: Icon }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}

        {/* Admin — apenas para admins */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                Administração
              </p>
            </div>
            <Link
              to="/admin"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <ShieldCheck size={18} />
              Painel Admin
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {session && (
          <div className="px-3 py-2">
            <p className="text-xs font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">
              {session.user.email}
            </p>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut size={18} />
          Sair
        </button>
      </div>
    </aside>
  );
}
