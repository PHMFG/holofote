// Varredor de jobs perdidos. A API grava a ação e só depois do commit enfileira a IA; se o Redis
// falhar nesse instante, a ação ficaria "a caminho" para sempre. A cada minuto (e no boot) o
// varredor procura o que espera a IA há mais de 2 minutos sem job na fila e enfileira de novo com
// o mesmo jobId determinístico (o BullMQ ignora um add com jobId que já existe). Fica na API porque
// é ela que enfileira esses jobs e tem as filas de diretor, dm e discurso.
import {
  acao,
  and,
  eq,
  gt,
  gte,
  isNotNull,
  isNull,
  marco,
  mundo,
  personagem,
  sql,
} from '@holofote/db';
import type { Contexto } from '../contexto';
import { erroParaLog } from './banco';
import { jobIdDaAcao, type FilaDeAcao } from './filas';

/** Tempo que a API tem para enfileirar depois do commit antes de o varredor agir. */
export const ESPERA_VARREDOR_MS = 2 * 60_000;
/** Ação que espera a IA há mais que isso (sem job vivo) desiste: os números já valem. */
export const DESISTE_ACAO_MS = 6 * 3600_000;
/** Intervalo entre varreduras. */
export const INTERVALO_VARREDOR_MS = 60_000;
const LIMITE = 100;

const FILA_DO_TIPO: Partial<Record<string, FilaDeAcao>> = {
  post: 'diretor',
  resposta: 'diretor',
  campanha: 'diretor',
  dm: 'dm',
  historia: 'dm',
  discurso: 'discurso',
};

const ESTADOS_VIVOS = new Set(['waiting', 'delayed', 'active', 'prioritized', 'waiting-children']);

export interface ResultadoVarredura {
  reenfileirados: number;
  desistidos: number;
}

/** Há um job vivo (esperando, adiado ou rodando) com esse id? */
async function jobVivo(ctx: Contexto, fila: keyof Contexto['filas'], jobId: string) {
  const job = await ctx.filas[fila].getJob(jobId);
  if (!job) return { existe: false, vivo: false };
  return { existe: true, vivo: ESTADOS_VIVOS.has(await job.getState()) };
}

export async function varrerPendentes(ctx: Contexto): Promise<ResultadoVarredura> {
  const real = ctx.agoraReal().getTime();
  const resultado: ResultadoVarredura = { reenfileirados: 0, desistidos: 0 };

  // Ações do jogador esperando a IA. `criado_em` está no relógio do mundo (real + deslocamento).
  const acoes = await ctx.db
    .select({
      id: acao.id,
      tipo: acao.tipo,
      criadoEm: acao.criadoEm,
      deslocamentoMin: mundo.deslocamentoMin,
    })
    .from(acao)
    .innerJoin(mundo, eq(mundo.id, acao.mundoId))
    .where(and(gt(acao.iaPendente, 0), isNull(acao.desfeitaEm)))
    .orderBy(acao.criadoEm)
    .limit(LIMITE);
  for (const a of acoes) {
    const fila = FILA_DO_TIPO[a.tipo];
    if (!fila) continue;
    const idade = real + a.deslocamentoMin * 60_000 - a.criadoEm.getTime();
    if (idade < ESPERA_VARREDOR_MS) continue;
    const jobId = jobIdDaAcao(fila, a.id);
    const { existe, vivo } = await jobVivo(ctx, fila, jobId);
    if (vivo) continue;
    if (idade > DESISTE_ACAO_MS) {
      await ctx.db
        .update(acao)
        .set({ iaPendente: 0 })
        .where(and(eq(acao.id, a.id), gt(acao.iaPendente, 0)));
      resultado.desistidos++;
      continue;
    }
    // Job terminado com o mesmo id: um add novo seria ignorado; espera a desistência das 6 h.
    if (existe) continue;
    await ctx.filas[fila].add(fila, { acaoId: a.id }, { jobId });
    resultado.reenfileirados++;
  }

  // Mundos que ficaram em "criando" sem o job criar_mundo.
  const criando = await ctx.db
    .select({ id: mundo.id, criadoEm: mundo.criadoEm })
    .from(mundo)
    .where(eq(mundo.estado, 'criando'))
    .limit(LIMITE);
  for (const m of criando) {
    const idade = real - m.criadoEm.getTime();
    if (idade < ESPERA_VARREDOR_MS) continue;
    const jobId = `criar_mundo-${m.id}`;
    const { existe, vivo } = await jobVivo(ctx, 'lote', jobId);
    if (vivo) continue;
    if (idade > DESISTE_ACAO_MS) {
      await ctx.db
        .update(mundo)
        .set({ estado: 'erro', erro: 'A IA não conseguiu criar o seu mundo agora. Tente de novo.' })
        .where(and(eq(mundo.id, m.id), eq(mundo.estado, 'criando')));
      resultado.desistidos++;
      continue;
    }
    if (existe) continue;
    await ctx.filas.lote.add('criar_mundo', { mundoId: m.id }, { jobId });
    resultado.reenfileirados++;
  }

  // Marcos resgatados com personagem novo e sem a ficha gravada (só nas últimas 6 h: uma ficha
  // que desistiu não volta a gastar IA quando o job antigo sai da fila).
  const desde = new Date(real - DESISTE_ACAO_MS - 24 * 3600_000);
  const marcos = await ctx.db
    .select({
      id: marco.id,
      mundoId: marco.mundoId,
      resgatadoEm: marco.resgatadoEm,
      deslocamentoMin: mundo.deslocamentoMin,
    })
    .from(marco)
    .innerJoin(mundo, eq(mundo.id, marco.mundoId))
    .leftJoin(personagem, eq(personagem.marcoId, marco.id))
    .where(
      and(
        isNotNull(marco.resgatadoEm),
        gte(marco.resgatadoEm, desde),
        sql`(${marco.recompensa}->>'personagemNovo')::boolean`,
        isNull(personagem.id),
      ),
    )
    .limit(LIMITE);
  for (const m of marcos) {
    const idade = real + m.deslocamentoMin * 60_000 - m.resgatadoEm!.getTime();
    if (idade < ESPERA_VARREDOR_MS || idade > DESISTE_ACAO_MS) continue;
    const jobId = `ficha-${m.id}`;
    if ((await jobVivo(ctx, 'lote', jobId)).existe) continue;
    await ctx.filas.lote.add('ficha', { mundoId: m.mundoId, marcoId: m.id }, { jobId });
    resultado.reenfileirados++;
  }

  if (resultado.reenfileirados > 0 || resultado.desistidos > 0) {
    ctx.log?.info({ ...resultado }, 'varredor de jobs');
  }
  return resultado;
}

/** Roda já e a cada minuto; devolve a função que para. Falhas só vão para o log. */
export function iniciarVarredor(ctx: Contexto, intervaloMs = INTERVALO_VARREDOR_MS): () => void {
  let rodando = false;
  const rodar = async () => {
    if (rodando) return;
    rodando = true;
    try {
      await varrerPendentes(ctx);
    } catch (erro) {
      ctx.log?.warn({ ...erroParaLog(erro) }, 'varredor falhou');
    } finally {
      rodando = false;
    }
  };
  void rodar();
  const relogio = setInterval(() => void rodar(), intervaloMs);
  relogio.unref();
  return () => clearInterval(relogio);
}
