// ficha: um personagem novo entra no mundo quando o jogador resgata um marco. A IA escreve a
// personalidade; o motor dá os números e a afinidade inicial.
import {
  alerta,
  and,
  eq,
  iniciaisDe,
  marco,
  normalizarHandle,
  personagem,
  relacao,
} from '@holofote/db';
import { criarRng, numerosDoPersonagem, rotuloRelacao } from '@holofote/engine';
import type { ContextoWorker } from '../contexto';
import { carregarCena, pessoaCurta } from '../infra/cena';
import { agendarEntrega } from '../infra/entrega';
import { gerar } from '../infra/ia';
import { violouUnicidade } from '../infra/erros';
import { vinculoDoRotulo, type Tx } from '../infra/relacoes';

export interface PedidoFicha {
  mundoId: string;
  marcoId: string;
}

export async function ficha(ctx: ContextoWorker, pedido: PedidoFicha): Promise<void> {
  const cena = await carregarCena(ctx, pedido.mundoId);
  if (!cena || cena.mundo.estado !== 'pronto') return;
  const [m] = await ctx.db
    .select()
    .from(marco)
    .where(and(eq(marco.id, pedido.marcoId), eq(marco.mundoId, cena.mundo.id)));
  if (!m) return;
  // Já criado (job repetido ou duplicado): um personagem por marco.
  const [ja] = await ctx.db
    .select({ id: personagem.id })
    .from(personagem)
    .where(eq(personagem.marcoId, m.id));
  if (ja) return;
  const existentes = await ctx.db
    .select({ nome: personagem.nome, handle: personagem.handle })
    .from(personagem)
    .where(eq(personagem.mundoId, cena.mundo.id));

  const { dados } = await gerar(ctx, {
    job: 'ficha',
    mundo: cena.mundo,
    entrada: {
      motivo: `o jogador conquistou o marco "${m.titulo}": ${m.descricao}`,
      vinculoDesejado: null,
      jogador: pessoaCurta(cena.jogador),
      existentes: existentes.map((e) => ({ nome: e.nome, handle: `@${e.handle}` })),
    },
  });

  const n = numerosDoPersonagem({
    tipoVinculo: dados.tipoVinculo,
    papel: 'elenco',
    tomCaos: cena.mundo.tomCaos,
    rng: criarRng(`ficha:${m.id}`),
  });
  const aviso = await gravarFicha(ctx, m.id, async (tx) => {
    const [novo] = await tx
      .insert(personagem)
      .values({
        mundoId: cena.mundo.id,
        papel: 'elenco',
        nome: dados.nome,
        handle: normalizarHandle(dados.handle),
        iniciais: iniciaisDe(dados.nome),
        tomAvatar: dados.tomAvatar,
        verificado: dados.verificado,
        ficha: dados.ficha,
        tipoVinculo: dados.tipoVinculo,
        perfilFofoca: dados.tipoVinculo === 'fofoca',
        fama: n.fama,
        carisma: n.carisma,
        polemica: n.polemica,
        seguidores: n.seguidores,
        marcoId: m.id,
        criadoEm: cena.agora,
      })
      .onConflictDoNothing({ target: personagem.marcoId })
      .returning();
    // Outro job do mesmo marco chegou antes: não cria ninguém e não avisa.
    if (!novo) return null;
    await tx.insert(relacao).values({
      deId: cena.jogador.id,
      paraId: novo.id,
      afinidade: n.afinidade,
      rotulo: rotuloRelacao(n.afinidade, vinculoDoRotulo(dados.tipoVinculo)),
    });
    const [a] = await tx
      .insert(alerta)
      .values({
        mundoId: cena.mundo.id,
        tipo: 'marco',
        texto: `${novo.nome} entrou no seu mundo`,
        personagemId: novo.id,
        destino: `/personagem/${novo.id}`,
        entregarEm: cena.agora,
      })
      .returning({ id: alerta.id });
    return a!.id;
  });
  if (aviso) {
    await agendarEntrega(
      ctx.filas.entrega,
      { tipo: 'alerta', id: aviso, mundoId: cena.mundo.id },
      cena.agora,
      cena.agora,
    );
  }
}

/**
 * Transação da ficha. Handle repetido (a IA escolheu um que já existe, ou outra ficha do mundo
 * gravou antes) vira erro: a fila tenta de novo e o prompt sai com a lista de existentes nova.
 */
async function gravarFicha(
  ctx: ContextoWorker,
  marcoId: string,
  gravar: (tx: Tx) => Promise<string | null>,
): Promise<string | null> {
  try {
    return await ctx.db.transaction(gravar);
  } catch (erro) {
    if (violouUnicidade(erro, 'personagem_handle_por_mundo')) {
      throw new Error(`handle repetido na ficha do marco ${marcoId}; a fila tenta de novo`);
    }
    throw erro;
  }
}
