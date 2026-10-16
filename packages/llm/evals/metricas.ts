// Métricas dos evals e os critérios do plano para trocar prompt ou modelo.
import type { NomeJob } from '../src/jobs';
import type { ChamadaLlm } from '../src/roteador';
import type { AnaliseResposta } from '../src/validacao';

export interface ResultadoAcao {
  id: string;
  job: NomeJob;
  descricao: string;
  /** chamarJob devolveu dados. */
  ok: boolean;
  erro?: string;
  /** Uma análise por resposta bruta recebida (inicial, reparo, reserva). */
  analises: AnaliseResposta[];
  chamadas: ChamadaLlm[];
}

export interface Metricas {
  acoes: number;
  chamadas: number;
  respostas: number;
  /** % das respostas que parseiam e passam no schema Zod. */
  jsonValidoPct: number;
  /** % das ações aceitas na primeira resposta, sem reparo nem reserva. */
  aceitasDePrimeiraPct: number;
  /** % das ações que terminaram com dados. */
  sucessoPct: number;
  /** % dos textos livres que parecem português. */
  portuguesPct: number;
  textosAcimaDoLimite: number;
  textosComEmoji: number;
  idsInvalidos: number;
  custoTotalUsd: number;
  custoMedioUsd: number;
  latenciaMediaMs: number;
  latenciaP95Ms: number;
}

/** Critérios do plano (docs/PLANO.md, "Avaliação dos prompts"). */
export const CRITERIOS = {
  jsonValidoPct: 99,
  portuguesPct: 100,
  textosAcimaDoLimite: 0,
  custoMedioUsd: 0.001,
} as const;

const pct = (parte: number, todo: number) => (todo === 0 ? 100 : (parte / todo) * 100);

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[Math.max(0, indice)] ?? 0;
}

export function calcularMetricas(resultados: ResultadoAcao[]): Metricas {
  const analises = resultados.flatMap((r) => r.analises);
  const chamadas = resultados.flatMap((r) => r.chamadas);
  const textos = analises.reduce((n, a) => n + a.contagem.textos, 0);
  const fora = analises.reduce((n, a) => n + a.contagem.foraDoPortugues, 0);
  const custoTotal = chamadas.reduce((n, c) => n + c.custoUsd, 0);
  const latencias = chamadas.map((c) => c.latenciaMs);
  const dePrimeira = resultados.filter((r) => r.ok && r.analises.length === 1 && r.analises[0]?.ok);
  return {
    acoes: resultados.length,
    chamadas: chamadas.length,
    respostas: analises.length,
    jsonValidoPct: pct(analises.filter((a) => a.schemaOk).length, analises.length),
    aceitasDePrimeiraPct: pct(dePrimeira.length, resultados.length),
    sucessoPct: pct(resultados.filter((r) => r.ok).length, resultados.length),
    portuguesPct: pct(textos - fora, textos),
    textosAcimaDoLimite: analises.reduce((n, a) => n + a.contagem.acimaDoLimite, 0),
    textosComEmoji: analises.reduce((n, a) => n + a.contagem.comEmoji, 0),
    idsInvalidos: analises.reduce((n, a) => n + a.contagem.idsInvalidos, 0),
    custoTotalUsd: custoTotal,
    custoMedioUsd: chamadas.length === 0 ? 0 : custoTotal / chamadas.length,
    latenciaMediaMs:
      latencias.length === 0 ? 0 : latencias.reduce((a, b) => a + b, 0) / latencias.length,
    latenciaP95Ms: percentil(latencias, 95),
  };
}

export interface Criterio {
  nome: string;
  valor: string;
  alvo: string;
  ok: boolean;
}

export function avaliarCriterios(m: Metricas): Criterio[] {
  return [
    {
      nome: 'JSON válido',
      valor: `${m.jsonValidoPct.toFixed(1)} %`,
      alvo: `>= ${CRITERIOS.jsonValidoPct} %`,
      ok: m.jsonValidoPct >= CRITERIOS.jsonValidoPct,
    },
    {
      nome: 'Em português',
      valor: `${m.portuguesPct.toFixed(1)} %`,
      alvo: `${CRITERIOS.portuguesPct} %`,
      ok: m.portuguesPct >= CRITERIOS.portuguesPct,
    },
    {
      nome: 'Textos acima do limite',
      valor: String(m.textosAcimaDoLimite),
      alvo: String(CRITERIOS.textosAcimaDoLimite),
      ok: m.textosAcimaDoLimite <= CRITERIOS.textosAcimaDoLimite,
    },
    {
      nome: 'Custo médio por chamada',
      valor: `US$ ${m.custoMedioUsd.toFixed(6)}`,
      alvo: `<= US$ ${CRITERIOS.custoMedioUsd}`,
      ok: m.custoMedioUsd <= CRITERIOS.custoMedioUsd,
    },
  ];
}
