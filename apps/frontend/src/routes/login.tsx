import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, TreePine } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const isEmail = username.includes("@");
      const { error } = isEmail
        ? await signIn.email({ email: username, password })
        : await signIn.username({ username, password });
      if (error) throw new Error(error.message ?? "Erro ao entrar");
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Painel decorativo */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between overflow-hidden bg-[oklch(0.17_0.04_145)] p-10">
        {/* Blobs decorativos */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 600 800"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="blob1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.38 0.1 145)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="oklch(0.17 0.04 145)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="blob2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="oklch(0.55 0.12 145)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="oklch(0.17 0.04 145)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="150" cy="200" rx="280" ry="280" fill="url(#blob1)" />
          <ellipse cx="480" cy="600" rx="250" ry="250" fill="url(#blob2)" />
          <ellipse cx="300" cy="450" rx="180" ry="180" fill="url(#blob1)" opacity="0.4" />
        </svg>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[oklch(0.55_0.12_145)] text-white shadow-lg">
            <TreePine size={22} />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">Gankyo</span>
        </div>

        {/* Texto central */}
        <div className="relative z-10">
          <h2 className="text-5xl font-bold text-white leading-tight">
            Bem-vindo<br />de volta!
          </h2>
          <p className="mt-4 text-[oklch(0.75_0.04_145)] text-base max-w-xs">
            Acesse sua conta para gerenciar relatórios e atividades do campo.
          </p>
        </div>

        {/* Rodapé */}
        <p className="relative z-10 text-[oklch(0.45_0.04_145)] text-sm">
          © {new Date().getFullYear()} Gankyo
        </p>
      </div>

      {/* Painel mobile topo */}
      <div className="relative flex md:hidden flex-col items-center justify-center overflow-hidden bg-[oklch(0.17_0.04_145)]" style={{ minHeight: "280px" }}>
        {/* Blobs de fundo */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 400 280"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="mblob1" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2d6a4f" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1b4332" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mblob2" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#52b788" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#1b4332" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Blobs */}
          <ellipse cx="60" cy="60" rx="180" ry="180" fill="url(#mblob1)" />
          <ellipse cx="360" cy="220" rx="160" ry="160" fill="url(#mblob2)" />
          {/* Linhas decorativas tipo folha/espiral */}
          <g stroke="#52b788" strokeWidth="1" fill="none" opacity="0.18">
            <path d="M 200 20 Q 260 80 200 140 Q 140 200 200 260" />
            <path d="M 220 10 Q 290 80 220 150 Q 150 220 220 270" />
            <path d="M 180 10 Q 110 80 180 150 Q 250 220 180 270" />
            <path d="M 160 0 Q 80 80 160 160 Q 240 240 160 280" />
            <path d="M 240 0 Q 320 80 240 160 Q 160 240 240 280" />
            <path d="M 300 30 Q 360 100 300 170 Q 240 240 300 280" />
            <path d="M 100 30 Q 40 100 100 170 Q 160 240 100 280" />
          </g>
          {/* Estrelinhas */}
          <g fill="#95d5b2" opacity="0.3">
            <polygon points="340,40 343,50 353,50 345,56 348,66 340,60 332,66 335,56 327,50 337,50" />
            <polygon points="60,180 62,187 69,187 63,191 65,198 60,194 55,198 57,191 51,187 58,187" />
            <polygon points="370,130 372,136 378,136 373,140 375,146 370,142 365,146 367,140 362,136 368,136" />
          </g>
        </svg>

        {/* Conteúdo */}
        <div className="relative z-10 flex flex-col items-center gap-3 py-14 px-8">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2d6a4f] text-white shadow-lg border border-[#52b788]/30">
            <TreePine size={30} />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Gankyo</h1>
          <p className="text-[#95d5b2] text-sm">Gerenciador de Relatórios</p>
        </div>

        {/* Onda na parte inferior */}
        <svg
          className="absolute bottom-0 left-0 w-full"
          viewBox="0 0 400 60"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,30 C80,60 160,0 240,30 C320,60 370,15 400,30 L400,60 L0,60 Z"
            fill="var(--background)"
          />
        </svg>
      </div>

      {/* Formulário de login */}
      <div className="flex flex-1 items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-3xl font-bold text-foreground mb-1">Login</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Bem-vindo de volta! Por favor, faça login na sua conta.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="username">Usuário ou Email</Label>
              <Input
                id="username"
                type="text"
                placeholder="pedro.gamela ou admin@admin.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={loading}
                className="h-11"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                minLength={8}
                className="h-11"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
              {loading && <Loader2 className="animate-spin mr-2" />}
              Entrar
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
