/** Gera o código do talhão: iniciais da fazenda + número zero-padded de 2 dígitos.
 *  Ex: "Água Boa" + 1 → "AB01" */
export function generateCodigoTalhao(fazendaName: string, numero: number): string {
  const initials = fazendaName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .map((w) => w[0].toUpperCase())
    .join("");
  return `${initials}${String(numero).padStart(2, "0")}`;
}
