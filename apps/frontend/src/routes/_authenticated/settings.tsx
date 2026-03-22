import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useSession } from "@/lib/auth-client";
import { apiUrl } from "@/lib/api";
import { Loader2, Settings, Tractor, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type Fazenda = { id: string; name: string };
type Preferences = { defaultFazendaId: string | null };

const fetchFazendas   = (): Promise<Fazenda[]> =>
  fetch(apiUrl("/fazendas"), { credentials: "include" }).then(r => r.json());

const fetchPreferences = (): Promise<Preferences> =>
  fetch(apiUrl("/me/preferences"), { credentials: "include" }).then(r => r.json());

function SettingsPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: fazendas = [] } = useQuery({ queryKey: ["fazendas"], queryFn: fetchFazendas });
  const { data: prefs, isLoading: prefsLoading } = useQuery({
    queryKey: ["me", "preferences"],
    queryFn: fetchPreferences,
  });

  const [defaultFazendaId, setDefaultFazendaId] = useState<string>("none");

  // sincroniza quando as prefs carregam
  useEffect(() => {
    if (prefs) setDefaultFazendaId(prefs.defaultFazendaId ?? "none");
  }, [prefs]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiUrl("/me/preferences"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          defaultFazendaId: defaultFazendaId === "none" ? null : defaultFazendaId,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "preferences"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">Personalize sua experiência no Gankyo</p>
        </div>
      </div>

      {/* Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
              {session?.user.name?.charAt(0).toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="text-sm font-medium">{session?.user.name}</p>
              <p className="text-xs text-muted-foreground">{session?.user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferências */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferências</CardTitle>
          <CardDescription>
            Defina os padrões que serão usados ao abrir as páginas do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Tractor className="h-3.5 w-3.5 text-muted-foreground" />
              Fazenda padrão
            </Label>
            <p className="text-xs text-muted-foreground">
              Será usada como filtro inicial na página de Relatórios.
            </p>
            {prefsLoading ? (
              <div className="h-9 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select
                value={defaultFazendaId}
                onValueChange={setDefaultFazendaId}
                disabled={save.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma (sem filtro padrão)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma (sem filtro padrão)</SelectItem>
                  <Separator className="my-1" />
                  {fazendas.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" /> Salvo com sucesso
              </span>
            )}
            <div className="flex-1" />
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || prefsLoading}
              className="w-full sm:w-auto"
            >
              {save.isPending && <Loader2 className="animate-spin" />}
              Salvar preferências
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
