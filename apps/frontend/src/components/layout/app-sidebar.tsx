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
  { label: "Dashboard",    to: "/dashboard",   icon: LayoutDashboard },
  { label: "Relatórios",   to: "/reports",     icon: FileText        },
  { label: "Programação",  to: "/programacao", icon: CalendarDays    },
  { label: "Configurações", to: "/settings",   icon: Settings        },
] as const;

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function getInitials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
        "fixed inset-y-0 left-0 z-50 flex w-60 flex-col",
        "bg-sidebar-background text-sidebar-foreground border-r border-sidebar-border",
        "transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "-translate-x-full",
        "md:relative md:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary/20 text-sidebar-primary">
            <TreePine size={17} />
          </div>
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            Gankyo
          </span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-md hover:bg-sidebar-accent/60 transition-colors text-sidebar-foreground/50 hover:text-sidebar-foreground"
          aria-label="Fechar menu"
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {baseNavItems.map(({ label, to, icon: Icon }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              onClick={handleNavClick}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground font-normal"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-sidebar-primary" />
              )}
              <Icon size={16} className={cn(isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
              {label}
            </Link>
          );
        })}

        {/* Admin */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30">
                Administração
              </p>
            </div>
            <Link
              to="/admin"
              onClick={handleNavClick}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                location.pathname.startsWith("/admin")
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground font-normal"
              )}
            >
              {location.pathname.startsWith("/admin") && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-sidebar-primary" />
              )}
              <ShieldCheck size={16} className={cn(location.pathname.startsWith("/admin") ? "text-sidebar-primary" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80")} />
              Painel Admin
            </Link>
          </>
        )}
      </nav>

      {/* Footer — usuário */}
      <div className="px-3 pb-4 pt-3 border-t border-sidebar-border">
        {session && (
          <div className="flex items-center gap-3 px-2 py-2 mb-1 rounded-lg">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sidebar-primary/20 text-sidebar-primary text-xs font-bold shrink-0">
              {getInitials(session.user.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                {session.user.name}
              </p>
              <p className="text-[11px] text-sidebar-foreground/40 truncate leading-tight mt-0.5">
                {session.user.email}
              </p>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
        >
          <LogOut size={15} />
          Sair
        </button>
      </div>
    </aside>
  );
}
