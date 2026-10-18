// Grava no banco o que a IA escreveu para o feed (feed inicial e lote diário): posts com números
// do motor, histórias com enquete, memórias reescritas e a conversa que alguém puxou.
import {
  alerta,
  and,
  conversa,
  eq,
  mensagem,
  memoria,
  post,
  resumoDia,
  sql,
  type LinhaPersonagem,
} from '@holofote/db';
import { engajamentoDePersonagem, type Rng } from '@holofote/engine';
import type { SaidaFeed } from '@holofote/llm';
import type { ContextoWorker } from '../contexto';
import type { Cena } from './cena';
import { agendarEntregaComDigitando, type PedidoEntrega } from './entrega';
import type { Executor } from './relacoes';

const HORA = 3600_000;

export interface Entrega {
  pedido: PedidoEntrega;
  entregarEm: Date;
}

export interface OpcoesFeed {
  /** Instantes de entrega dos posts, em ordem crescente (um por post aceito). */
  instantes: (quantidade: number) => Date[];
  /** Personagens que podem ser autores (os ids que foram no prompt). */
  autores: ReadonlyMap<string, LinhaPersonagem>;
  rng: Rng;
  origem: 'lote';
  /** O motor deixou alguém puxar conversa hoje? Sem isso, `puxaConversa` da IA é descartado. */
  podePuxarConversa: boolean;
  /** Pares "personagemId|sobreId" mandados para resumo; memória de outro par é descartada. */
  memoriasPedidas: ReadonlySet<string>;
}

/** Chave de um par de memória em `memoriasPedidas`. */
export const parDeMemoria = (personagemId: string, sobreId: string) => `${personagemId}|${sobreId}`;

/**
 * Grava a saída do feed numa transação e devolve as entregas a agendar depois do commit
 * (posts, histórias e mensagens com hora no futuro do mundo).
 */
export async function gravarFeed(
  tx: Executor,
  cena: Cena,
  dados: SaidaFeed,
  opcoes: OpcoesFeed,
): Promise<Entrega[]> {
  const entregas: Entrega[] = [];
  const mundoId = cena.mundo.id;
  const agendar = (tipo: PedidoEntrega['tipo'], id: string, entregarEm: Date) => {
    if (entregarEm > cena.agora) entregas.push({ pedido: { tipo, id, mundoId }, entregarEm });
  };

  const posts = dados.posts.filter((p) => opcoes.autores.has(p.autorId));
  const instantes = opcoes.instantes(posts.length);
  const idPorPosicao: string[] = [];
  for (const [i, p] of posts.entries()) {
    const autor = opcoes.autores.get(p.autorId)!;
    const entregarEm = instantes[i]!;
    const respondeA =
      typeof p.respondeA === 'number' ? (idPorPosicao[p.respondeA] ?? null) : (p.respondeA ?? null);
    const numeros = engajamentoDePersonagem({
      seguidores: autor.seguidores,
      polemica: autor.polemica,
      rng: opcoes.rng,
    });
    const [novo] = await tx
      .insert(post)
      .values({
        mundoId,
        autorId: autor.id,
        respondeA,
        texto: p.texto,
        origem: opcoes.origem,
        entregarEm,
        curtidas: respondeA ? Math.round(numeros.curtidas / 4) : numeros.curtidas,
        reposts: respondeA ? 0 : numeros.reposts,
        criadoEm: cena.agora,
      })
      .returning({ id: post.id });
    idPorPosicao.push(novo!.id);
    if (respondeA && entregarEm <= cena.agora) {
      await tx
        .update(post)
        .set({ respostas: sql`${post.respostas} + 1` })
        .where(eq(post.id, respondeA));
    }
    agendar('post', novo!.id, entregarEm);
  }

  for (const h of dados.historias) {
    const autor = opcoes.autores.get(h.autorId);
    if (!autor) continue;
    const [nova] = await tx
      .insert(post)
      .values({
        mundoId,
        autorId: autor.id,
        tipo: 'historia',
        texto: h.texto,
        origem: opcoes.origem,
        enquete: h.enquete
          ? {
              pergunta: h.enquete.pergunta,
              opcoes: h.enquete.opcoes.map((texto, i) => ({ id: `o${i + 1}`, texto })),
            }
          : null,
        entregarEm: cena.agora,
        expiraEm: new Date(cena.agora.getTime() + 24 * HORA),
        criadoEm: cena.agora,
      })
      .returning({ id: post.id });
    agendar('post', nova!.id, cena.agora);
  }

  for (const m of dados.memorias) {
    // Só reescreve o que foi pedido: a IA não pode trocar a memória de um par que não viu.
    if (!opcoes.memoriasPedidas.has(parDeMemoria(m.personagemId, m.sobreId))) continue;
    if (!opcoes.autores.has(m.personagemId)) continue;
    await tx
      .insert(memoria)
      .values({ personagemId: m.personagemId, sobreId: m.sobreId, fatos: m.fatos, dia: cena.dia })
      .onConflictDoUpdate({
        target: [memoria.personagemId, memoria.sobreId],
        set: { fatos: m.fatos, dia: cena.dia, atualizadoEm: cena.agora },
      });
  }

  const puxa = opcoes.podePuxarConversa ? dados.puxaConversa : undefined;
  const quemPuxa = puxa ? opcoes.autores.get(puxa.personagemId) : undefined;
  if (puxa && quemPuxa) {
    const entregarEm = new Date(cena.agora.getTime() + 2 * 60_000);
    await tx.insert(conversa).values({ mundoId, personagemId: quemPuxa.id }).onConflictDoNothing();
    const [c] = await tx
      .update(conversa)
      .set({ puxouConversa: true })
      .where(and(eq(conversa.mundoId, mundoId), eq(conversa.personagemId, quemPuxa.id)))
      .returning({ id: conversa.id });
    const [msg] = await tx
      .insert(mensagem)
      .values({ conversaId: c!.id, autorId: quemPuxa.id, texto: puxa.texto, entregarEm })
      .returning({ id: mensagem.id });
    const [a] = await tx
      .insert(alerta)
      .values({
        mundoId,
        tipo: 'dm',
        texto: `${quemPuxa.nome} puxou conversa`,
        personagemId: quemPuxa.id,
        destino: `/dm/${c!.id}`,
        entregarEm,
      })
      .returning({ id: alerta.id });
    agendar('mensagem', msg!.id, entregarEm);
    agendar('alerta', a!.id, entregarEm);
  }

  return entregas;
}

/** Agenda as entregas depois do commit (antes, o job poderia rodar sem achar a linha). */
export async function agendarEntregas(
  ctx: ContextoWorker,
  cena: Cena,
  entregas: readonly Entrega[],
): Promise<void> {
  for (const e of entregas)
    await agendarEntregaComDigitando(ctx.filas.entrega, e.pedido, e.entregarEm, cena.agora);
}

export interface NumeroResumo {
  rotulo: string;
  valor: string;
  variacao: number | null;
}

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

/** Seguidores como o app mostra: "7,1 mil", "48 mil", "1,2 mi". */
export function formatarSeguidores(valor: number): string {
  return compacto.format(valor);
}

/** Números do jogador para o resumo, com a variação do dia quando houver. */
export function numerosDoResumo(
  jogador: LinhaPersonagem,
  variacao: Partial<Record<'seguidores' | 'fama' | 'carisma' | 'polemica', number>> = {},
): NumeroResumo[] {
  const v = (chave: keyof typeof variacao) => variacao[chave] ?? null;
  return [
    {
      rotulo: 'Seguidores',
      valor: formatarSeguidores(jogador.seguidores),
      variacao: v('seguidores'),
    },
    { rotulo: 'Fama', valor: String(jogador.fama), variacao: v('fama') },
    { rotulo: 'Carisma', valor: String(jogador.carisma), variacao: v('carisma') },
    { rotulo: 'Polêmica', valor: String(jogador.polemica), variacao: v('polemica') },
  ];
}

/** Grava (ou reescreve) o resumo do dia do mundo. Pendência com personagem abre o perfil dele. */
export async function gravarResumo(
  tx: Executor,
  cena: Cena,
  resumo: NonNullable<SaidaFeed['resumo']>,
  numeros: NumeroResumo[],
  autores: ReadonlyMap<string, LinhaPersonagem>,
): Promise<void> {
  const pendencias = resumo.pendencias.map((p) => ({
    texto: p.texto,
    destino: {
      rota:
        p.personagemId && autores.has(p.personagemId)
          ? `/personagem/${p.personagemId}`
          : '/jornada',
    },
  }));
  await tx
    .insert(resumoDia)
    .values({
      mundoId: cena.mundo.id,
      dia: cena.dia,
      manchete: resumo.manchete,
      numeros,
      pendencias,
    })
    .onConflictDoUpdate({
      target: [resumoDia.mundoId, resumoDia.dia],
      set: { manchete: resumo.manchete, numeros, pendencias, criadoEm: cena.agora },
    });
}
