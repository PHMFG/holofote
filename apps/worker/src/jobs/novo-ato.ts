// novo_ato: o jogador resgatou o último marco do ato, então o mundo ganha o ato seguinte. A IA
// escreve o objetivo e os cinco marcos; o motor dá os requisitos (a partir dos números atuais do
// jogador, mais difíceis a cada ato) e as recompensas. Idempotente: se o ato novo já existe, não
// gera de novo; e o ato só avança na mesma transação que grava os marcos.
import { alerta, and, asc, eq, marco, mundo as tabelaMundo } from '@holofote/db';
import { ACOES_NOVAS, criarRng, recompensaDoMarco, requisitosDoMarco } from '@holofote/engine';
import type { ContextoWorker } from '../contexto';
import { carregarCena, jogadorAtual, jogadorPrompt, publicarMundo } from '../infra/cena';
import { agendarEntrega } from '../infra/entrega';
import { gerar } from '../infra/ia';
import { estadoInicialDoAto } from '../infra/marcos';

export interface PedidoNovoAto {
  mundoId: string;
  /** Número do ato que começa (o ato atual do mundo + 1). */
  ato: number;
}

export async function novoAto(ctx: ContextoWorker, pedido: PedidoNovoAto): Promise<void> {
  const cena = await carregarCena(ctx, pedido.mundoId);
  if (!cena || cena.mundo.estado !== 'pronto') return;
  // O ato novo já existe (job repetido) ou o pedido não é o do ato seguinte: nada a fazer.
  if (cena.mundo.ato !== pedido.ato - 1) return;
  const anteriores = await ctx.db
    .select()
    .from(marco)
    .where(and(eq(marco.mundoId, cena.mundo.id), eq(marco.ato, cena.mundo.ato)))
    .orderBy(asc(marco.ordem));
  // Só vira o ato quando todos os marcos do ato atual foram resgatados.
  if (anteriores.length === 0 || anteriores.some((m) => !m.resgatadoEm)) return;
  const [jaTem] = await ctx.db
    .select({ id: marco.id })
    .from(marco)
    .where(and(eq(marco.mundoId, cena.mundo.id), eq(marco.ato, pedido.ato)))
    .limit(1);
  if (jaTem) return;

  const { dados } = await gerar(ctx, {
    job: 'novo_ato',
    mundo: cena.mundo,
    entrada: {
      ato: pedido.ato,
      objetivoAnterior: cena.mundo.objetivoAto ?? '',
      marcosCumpridos: anteriores.map((m) => m.titulo),
      resumoEstado: cena.mundo.resumoEstado,
      jogador: jogadorPrompt(cena.jogador),
    },
  });

  // Os requisitos partem dos números de agora, não dos de antes da chamada de IA.
  const jogador = await jogadorAtual(ctx.db, cena);
  const rng = criarRng(`novo_ato:${cena.mundo.id}:${pedido.ato}`);
  const alertaId = await ctx.db.transaction(async (tx) => {
    // O ato só avança uma vez: quem perder a corrida não encontra o ato anterior e sai sem gravar.
    const [avancou] = await tx
      .update(tabelaMundo)
      .set({ ato: pedido.ato, objetivoAto: dados.objetivoAto })
      .where(and(eq(tabelaMundo.id, cena.mundo.id), eq(tabelaMundo.ato, pedido.ato - 1)))
      .returning({ id: tabelaMundo.id });
    if (!avancou) return null;
    const inicial = await estadoInicialDoAto(tx, cena.mundo.id, jogador);
    await tx.insert(marco).values(
      dados.marcos.map((g, i) => {
        const ordem = i + 1;
        const recompensa = recompensaDoMarco(ordem);
        return {
          mundoId: cena.mundo.id,
          ato: pedido.ato,
          ordem,
          titulo: g.titulo,
          descricao: g.descricao,
          requisitos: requisitosDoMarco(ordem, inicial, rng, pedido.ato),
          recompensa: {
            gemas: recompensa.gemas,
            energiaCheia: recompensa.energiaCheia,
            personagemNovo: recompensa.personagemNovo,
            acaoNova: ACOES_NOVAS.find((a) => a.id === recompensa.acaoNova)?.rotulo ?? null,
          },
        };
      }),
    );
    const [aviso] = await tx
      .insert(alerta)
      .values({
        mundoId: cena.mundo.id,
        tipo: 'marco',
        texto: `Ato ${pedido.ato} começou`,
        destino: '/jornada',
        entregarEm: cena.agora,
      })
      .returning({ id: alerta.id });
    return aviso!.id;
  });
  if (!alertaId) return;

  await agendarEntrega(
    ctx.filas.entrega,
    { tipo: 'alerta', id: alertaId, mundoId: cena.mundo.id },
    cena.agora,
    cena.agora,
  );
  await publicarMundo(ctx, cena.mundo.id);
  ctx.log.info({ mundoId: cena.mundo.id, ato: pedido.ato }, 'ato novo');
}
