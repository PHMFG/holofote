// Liga cada fila ao seu job e aplica a política de falha da IA:
// - teto diário estourado: o job espera a virada do dia (UTC), sem gastar tentativas (decisão do
//   dono); criar_mundo não espera: o mundo fica em erro com a mensagem de limite e o jogador tenta
//   de novo depois, em vez de olhar a tela de criação por horas;
// - limite do provedor: espera a dica do adaptador (15 min), até MAX_ADIAMENTOS vezes, e a ação do
//   jogador desiste quando completa 6 h;
// - JSON inválido (o roteador já tentou reparo e reserva): desiste na 3ª tentativa do BullMQ;
// - o resto (rede, 5xx): volta pela espera crescente do BullMQ.
// Nunca entra texto pronto: ao desistir, a ação fica sem reação e o mundo, com erro.
// Erros de banco saem sem consulta nem parâmetros (texto do jogador) no log e no failedReason.
import { acao as tabelaAcao, and, eq, mundo as tabelaMundo } from '@holofote/db';
import { ErroJsonInvalido, ErroLimite, ErroOrcamento } from '@holofote/llm';
import { FILAS, type NomeFila } from '@holofote/shared';
import { DelayedError, UnrecoverableError } from 'bullmq';
import type { ContextoWorker } from './contexto';
import { publicarMundo } from './infra/cena';
import { erroParaLog, sanitizarErro } from './infra/erros';
import { inicioDoDiaUtc } from './infra/ia';
import type { PedidoEntrega } from './infra/entrega';
import { criarMundo, type PedidoCriarMundo } from './jobs/criar-mundo';
import { diretor, type PedidoDiretor } from './jobs/diretor';
import { discurso, type PedidoDiscurso } from './jobs/discurso';
import { dm, type PedidoDm } from './jobs/dm';
import { processarEntrega } from './jobs/entrega';
import { ficha, type PedidoFicha } from './jobs/ficha';
import { agendarLotes, loteDiario, type PedidoLoteDiario } from './jobs/lote-diario';
import { novoAto, type PedidoNovoAto } from './jobs/novo-ato';

/** Quantas vezes um job espera o limite do provedor antes de cair na política normal. */
export const MAX_ADIAMENTOS = 12;
/** Tentativas do BullMQ com JSON inválido antes de desistir (cada uma já faz até 4 chamadas). */
export const TENTATIVAS_JSON_INVALIDO = 3;
/** Idade máxima de uma ação esperando o limite do provedor (o teto diário espera a virada). */
export const IDADE_MAXIMA_ACAO_MS = 6 * 3600_000;
export const MENSAGEM_LIMITE_MUNDO = 'A IA atingiu o limite de hoje. Tente de novo mais tarde.';

const DIA = 24 * 3600_000;

/** O pedaço do Job do BullMQ que a política usa (os testes passam um objeto simples). */
export interface JobDaFila {
  id?: string;
  name: string;
  data: unknown;
  attemptsMade: number;
  opts: { attempts?: number };
  updateData(dados: unknown): Promise<void>;
  moveToDelayed(timestamp: number, token?: string): Promise<void>;
}

export type Processador = (job: JobDaFila, token?: string) => Promise<unknown>;

export interface OpcoesPolitica {
  /** Roda quando o job desiste (última tentativa, JSON inválido repetido, prazo vencido). */
  aoDesistir?: (erro: unknown) => Promise<void>;
  /** Instante (relógio real, ms) depois do qual o job desiste em vez de esperar o limite. */
  prazo?: () => Promise<number | null>;
  /** No teto diário, em vez de adiar: o job termina sem erro (criar_mundo). */
  aoEstourarOrcamento?: (erro: ErroOrcamento) => Promise<void>;
}

export async function comPolitica(
  ctx: ContextoWorker,
  job: JobDaFila,
  token: string | undefined,
  executar: () => Promise<unknown>,
  opcoes: OpcoesPolitica = {},
): Promise<unknown> {
  try {
    return await executar();
  } catch (bruto) {
    const erro = sanitizarErro(bruto);
    if (erro instanceof ErroOrcamento && opcoes.aoEstourarOrcamento) {
      await opcoes.aoEstourarOrcamento(erro);
      return undefined;
    }
    if (erro instanceof ErroOrcamento || erro instanceof ErroLimite) {
      const dados = (job.data ?? {}) as { adiamentos?: number };
      const adiamentos = (dados.adiamentos ?? 0) + 1;
      if (erro instanceof ErroOrcamento || adiamentos <= MAX_ADIAMENTOS) {
        const agora = ctx.agoraReal().getTime();
        // O teto volta a valer na virada do dia UTC do relógio do worker.
        let ate =
          erro instanceof ErroOrcamento
            ? Math.max(agora + 60_000, inicioDoDiaUtc(ctx.agoraReal()).getTime() + DIA)
            : agora + erro.atrasoSugeridoMs;
        // O teto diário sempre espera a virada; o prazo só corta a espera do limite do provedor.
        const prazo = erro instanceof ErroLimite && opcoes.prazo ? await opcoes.prazo() : null;
        if (prazo !== null) {
          if (agora >= prazo) {
            await opcoes.aoDesistir?.(erro);
            return undefined;
          }
          ate = Math.min(ate, prazo);
        }
        await job.updateData({ ...dados, adiamentos });
        await job.moveToDelayed(ate, token);
        ctx.log.warn(
          { job: job.name, jobId: job.id, atrasoMs: ate - agora, motivo: erro.codigo },
          'job de IA adiado',
        );
        throw new DelayedError();
      }
    }
    const ultima = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const jsonDeNovo =
      erro instanceof ErroJsonInvalido && job.attemptsMade + 1 >= TENTATIVAS_JSON_INVALIDO;
    if ((ultima || jsonDeNovo) && opcoes.aoDesistir) await opcoes.aoDesistir(erro);
    // Sem isso o BullMQ seguiria até a 8ª tentativa (até 32 chamadas de JSON quebrado).
    if (jsonDeNovo && !ultima) throw new UnrecoverableError((erro as Error).message);
    throw erro;
  }
}

/** Sem reação depois de todas as tentativas: a ação para de esperar e os números continuam. */
async function desistirDaAcao(ctx: ContextoWorker, acaoId: string, erro: unknown) {
  await ctx.db.update(tabelaAcao).set({ iaPendente: 0 }).where(eq(tabelaAcao.id, acaoId));
  ctx.log.error({ acaoId, ...erroParaLog(erro) }, 'IA não respondeu à ação');
}

/** Até quando (relógio real) a ação pode esperar a IA: 6 h depois de criada no relógio do mundo. */
async function prazoDaAcao(ctx: ContextoWorker, acaoId: string): Promise<number | null> {
  const [linha] = await ctx.db
    .select({ criadoEm: tabelaAcao.criadoEm, deslocamentoMin: tabelaMundo.deslocamentoMin })
    .from(tabelaAcao)
    .innerJoin(tabelaMundo, eq(tabelaMundo.id, tabelaAcao.mundoId))
    .where(eq(tabelaAcao.id, acaoId));
  if (!linha) return null;
  return linha.criadoEm.getTime() - linha.deslocamentoMin * 60_000 + IDADE_MAXIMA_ACAO_MS;
}

async function desistirDoMundo(
  ctx: ContextoWorker,
  mundoId: string,
  erro: unknown,
  mensagem = 'A IA não conseguiu criar o seu mundo agora. Tente de novo.',
) {
  await ctx.db
    .update(tabelaMundo)
    .set({ estado: 'erro', erro: mensagem })
    .where(and(eq(tabelaMundo.id, mundoId), eq(tabelaMundo.estado, 'criando')));
  await publicarMundo(ctx, mundoId);
  ctx.log.error({ mundoId, ...erroParaLog(erro) }, 'mundo não foi criado');
}

/** Jobs fora da política da IA (entrega, agendamento) também não vazam consulta no erro. */
async function semDadosNoErro(executar: () => Promise<unknown>): Promise<unknown> {
  try {
    return await executar();
  } catch (erro) {
    throw sanitizarErro(erro);
  }
}

export function processadores(ctx: ContextoWorker): Record<NomeFila, Processador> {
  const daAcao =
    (executar: (ctx: ContextoWorker, pedido: { acaoId: string }) => Promise<void>): Processador =>
    (job, token) => {
      const pedido = job.data as { acaoId: string };
      return comPolitica(ctx, job, token, () => executar(ctx, pedido), {
        aoDesistir: (e) => desistirDaAcao(ctx, pedido.acaoId, e),
        prazo: () => prazoDaAcao(ctx, pedido.acaoId),
      });
    };

  return {
    [FILAS.diretor]: daAcao((c, p) => diretor(c, p as PedidoDiretor)),
    [FILAS.dm]: daAcao((c, p) => dm(c, p as PedidoDm)),
    [FILAS.discurso]: daAcao((c, p) => discurso(c, p as PedidoDiscurso)),
    [FILAS.lote]: (job, token) => {
      switch (job.name) {
        case 'criar_mundo': {
          const pedido = job.data as PedidoCriarMundo;
          return comPolitica(ctx, job, token, () => criarMundo(ctx, pedido), {
            aoDesistir: (e) => desistirDoMundo(ctx, pedido.mundoId, e),
            // Esperar a virada do dia deixaria o jogador horas na tela de criação.
            aoEstourarOrcamento: (e) =>
              desistirDoMundo(ctx, pedido.mundoId, e, MENSAGEM_LIMITE_MUNDO),
          });
        }
        case 'lote_diario':
          return comPolitica(ctx, job, token, () => loteDiario(ctx, job.data as PedidoLoteDiario));
        case 'ficha': {
          const pedido = job.data as PedidoFicha;
          return comPolitica(ctx, job, token, () => ficha(ctx, pedido), {
            aoDesistir: async (e) => {
              ctx.log.error(
                {
                  job: 'ficha',
                  mundoId: pedido.mundoId,
                  marcoId: pedido.marcoId,
                  ...erroParaLog(e),
                },
                'ficha desistiu: o marco fica sem personagem novo',
              );
            },
          });
        }
        case 'novo_ato': {
          const pedido = job.data as PedidoNovoAto;
          return comPolitica(ctx, job, token, () => novoAto(ctx, pedido), {
            // O varredor da API tenta de novo depois (o jogador fica com "o próximo ato está
            // sendo escrito" até a IA responder); texto pronto nunca entra no lugar.
            aoDesistir: async (e) => {
              ctx.log.error(
                { job: 'novo_ato', mundoId: pedido.mundoId, ato: pedido.ato, ...erroParaLog(e) },
                'novo_ato desistiu: a API enfileira de novo mais tarde',
              );
            },
          });
        }
        case 'agendar_lotes':
          return semDadosNoErro(() => agendarLotes(ctx));
        default:
          throw new Error(`job desconhecido na fila lote: ${job.name}`);
      }
    },
    [FILAS.entrega]: (job) =>
      semDadosNoErro(() => processarEntrega(ctx.db, ctx.redis, job.data as PedidoEntrega)),
  } as Record<NomeFila, Processador>;
}
