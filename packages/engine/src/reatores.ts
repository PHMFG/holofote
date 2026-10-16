// Escolha de quem reage a uma ação (no máximo 5 por chamada de IA).
import { AFINIDADE_EXTREMA, MAX_REATORES } from './constantes';
import { inteiroEntre, sortearSemRepeticao } from './rng';
import type { PapelPersonagem, Rng } from './tipos';

export interface CandidatoReator {
  id: string;
  papel: PapelPersonagem;
  /** Afinidade com o jogador. */
  afinidade: number;
  perfilFofoca: boolean;
}

export interface EntradaReatores {
  /** Candidatos (em geral quem está "online" no período), sem o jogador. */
  personagens: readonly CandidatoReator[];
  /** Ids marcados no post; entram primeiro, na ordem dada. */
  marcados: readonly string[];
  /** Autor do post comentado, se a ação for uma resposta. */
  autorAlvo?: string;
  rng: Rng;
  maximo?: number;
}

function ehExtrema(afinidade: number): boolean {
  return afinidade <= AFINIDADE_EXTREMA.ate || afinidade >= AFINIDADE_EXTREMA.aPartirDe;
}

/**
 * Ids dos reatores em ordem de prioridade, sem repetição e no máximo `maximo`:
 * 1. marcados; 2. autor alvo; 3. afinidades extremas (≤ 24 ou ≥ 80), da mais distante de 50
 * para a mais próxima; 4. perfis de fofoca; 5. sorteio entre os demais: 1 a 2 figurantes
 * quando houver figurante e vaga, o resto do elenco, e mais figurantes só se faltar elenco.
 * Marcados e autor alvo entram mesmo fora da lista de candidatos: são alvos explícitos.
 */
export function escolherReatores(entrada: EntradaReatores): string[] {
  const maximo = Math.max(0, Math.floor(entrada.maximo ?? MAX_REATORES));
  const escolhidos: string[] = [];
  const incluir = (id: string) => {
    if (escolhidos.length < maximo && !escolhidos.includes(id)) escolhidos.push(id);
  };

  for (const id of entrada.marcados) incluir(id);
  if (entrada.autorAlvo !== undefined) incluir(entrada.autorAlvo);

  const extremos = entrada.personagens
    .map((p, ordem) => ({ p, ordem }))
    .filter(({ p }) => ehExtrema(p.afinidade))
    .sort(
      (a, b) => Math.abs(b.p.afinidade - 50) - Math.abs(a.p.afinidade - 50) || a.ordem - b.ordem,
    );
  for (const { p } of extremos) incluir(p.id);
  for (const p of entrada.personagens) if (p.perfilFofoca) incluir(p.id);

  const vagas = maximo - escolhidos.length;
  if (vagas <= 0) return escolhidos;

  const restantes = entrada.personagens.filter((p) => !escolhidos.includes(p.id));
  const figurantes = restantes.filter((p) => p.papel === 'figurante');
  const elenco = restantes.filter((p) => p.papel === 'elenco');

  // 1 ou 2 figurantes, limitado ao que houver e às vagas.
  const desejados = inteiroEntre(entrada.rng, 1, 2);
  const quantosFigurantes = Math.min(desejados, figurantes.length, vagas);
  const figurantesEscolhidos = sortearSemRepeticao(entrada.rng, figurantes, quantosFigurantes);
  const doElenco = sortearSemRepeticao(entrada.rng, elenco, vagas - quantosFigurantes);
  // Só quando falta elenco entram mais figurantes além dos 1 ou 2.
  const extras = sortearSemRepeticao(
    entrada.rng,
    figurantes.filter((f) => !figurantesEscolhidos.includes(f)),
    vagas - quantosFigurantes - doElenco.length,
  );

  // Elenco antes dos figurantes: quem tem ficha reage primeiro.
  for (const p of [...doElenco, ...figurantesEscolhidos, ...extras]) incluir(p.id);
  return escolhidos;
}
