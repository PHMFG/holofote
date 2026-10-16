// Energia e gemas como livros-caixa: o saldo é sempre a soma dos lançamentos.
import {
  and,
  asc,
  eq,
  gte,
  lancamentoEnergia,
  lancamentoGemas,
  sql,
  usuario,
  type LinhaUsuario,
} from '@holofote/db';
import {
  ANUNCIO,
  ENERGIA,
  GEMAS,
  anunciosRestantes,
  calcularEnergia,
  dataLocal,
  podeGastar,
  valorRecarga,
  type ViaRecarga,
} from '@holofote/engine';
import type { EstadoEnergia } from '@holofote/shared';
import { ErroApi } from '../infra/erros';
import type { Executor } from './tipos';

export async function estadoEnergia(db: Executor, u: LinhaUsuario, agora: Date) {
  const lancamentos = await db
    .select({ valor: lancamentoEnergia.valor, criadoEm: lancamentoEnergia.criadoEm })
    .from(lancamentoEnergia)
    .where(eq(lancamentoEnergia.usuarioId, u.id))
    .orderBy(asc(lancamentoEnergia.criadoEm));
  return calcularEnergia(lancamentos, agora, u.plano);
}

export function energiaDto(
  estado: ReturnType<typeof calcularEnergia>,
  plano: LinhaUsuario['plano'],
): EstadoEnergia {
  return {
    atual: estado.atual,
    max: estado.max,
    proximaEm: estado.proximaEm ? estado.proximaEm.toISOString() : null,
    plano,
    regras: {
      recargaMin: ENERGIA[plano].recargaMinutos,
      gemasParaEncher: GEMAS.encherEnergia,
      anuncioEnergia: ANUNCIO.energia,
      // No Plus não há anúncio simulado.
      anunciosPorDia: plano === 'plus' ? 0 : ANUNCIO.porDia,
    },
  };
}

/** Trava a linha do usuário até o fim da transação, para débitos concorrentes não furarem o saldo. */
export async function travarUsuario(tx: Executor, usuarioId: string) {
  await tx.execute(sql`select 1 from ${usuario} where ${usuario.id} = ${usuarioId} for update`);
}

/** Debita energia na mesma transação da ação. Sem saldo, nada é gravado e a API responde 409. */
export async function debitarEnergia(
  tx: Executor,
  u: LinhaUsuario,
  custo: number,
  agora: Date,
  motivo: 'acao' | 'desfazer' = 'acao',
) {
  await travarUsuario(tx, u.id);
  const estado = await estadoEnergia(tx, u, agora);
  if (!podeGastar(estado, custo)) {
    throw new ErroApi(409, 'sem_energia', 'Sua energia acabou. Recarregue para continuar.');
  }
  if (custo > 0) {
    await tx
      .insert(lancamentoEnergia)
      .values({ usuarioId: u.id, valor: -custo, motivo, criadoEm: agora });
  }
  return { ...estado, atual: estado.atual - custo };
}

/** Recarga por gemas, anúncio simulado, debug ou marco. Barra cheia não grava nada. */
export async function recarregarEnergia(
  tx: Executor,
  u: LinhaUsuario,
  via: ViaRecarga,
  agora: Date,
) {
  await travarUsuario(tx, u.id);
  const estado = await estadoEnergia(tx, u, agora);
  const valor = valorRecarga(via, estado);
  if (valor > 0) {
    await tx
      .insert(lancamentoEnergia)
      .values({ usuarioId: u.id, valor, motivo: via, criadoEm: agora });
  }
  return valor;
}

export async function saldoGemas(db: Executor, usuarioId: string): Promise<number> {
  const [linha] = await db
    .select({ total: sql<number>`coalesce(sum(${lancamentoGemas.valor}), 0)::int` })
    .from(lancamentoGemas)
    .where(eq(lancamentoGemas.usuarioId, usuarioId));
  return linha?.total ?? 0;
}

export async function moverGemas(
  tx: Executor,
  usuarioId: string,
  valor: number,
  motivo: 'inicial' | 'marco' | 'evento' | 'compra' | 'energia',
  agora: Date,
) {
  if (valor === 0) return;
  await travarUsuario(tx, usuarioId);
  if (valor < 0 && (await saldoGemas(tx, usuarioId)) < -valor) {
    throw new ErroApi(409, 'sem_gemas', 'Gemas insuficientes.');
  }
  await tx.insert(lancamentoGemas).values({ usuarioId, valor, motivo, criadoEm: agora });
}

/** Anúncios simulados vistos hoje no fuso do jogador (até 3 por dia; o Plus não vê anúncio). */
export async function anunciosRestantesHoje(
  db: Executor,
  u: LinhaUsuario,
  agora: Date,
): Promise<number> {
  if (u.plano === 'plus') return 0;
  const hoje = dataLocal(agora, u.fuso);
  const desde = new Date(agora.getTime() - 26 * 3600_000);
  const vistos = await db
    .select({ criadoEm: lancamentoEnergia.criadoEm })
    .from(lancamentoEnergia)
    .where(
      and(
        eq(lancamentoEnergia.usuarioId, u.id),
        eq(lancamentoEnergia.motivo, 'anuncio'),
        gte(lancamentoEnergia.criadoEm, desde),
      ),
    );
  const deHoje = vistos.filter((v) => {
    const d = dataLocal(v.criadoEm, u.fuso);
    return d.ano === hoje.ano && d.mes === hoje.mes && d.dia === hoje.dia;
  }).length;
  return anunciosRestantes(deHoje);
}

export { ENERGIA };
