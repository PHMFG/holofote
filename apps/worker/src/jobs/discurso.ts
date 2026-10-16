// discurso: o mundo reage ao discurso do jogador no evento ao vivo. O vencedor, as gemas e os deltas
// já saíram do sorteio do motor na API; a IA escreve a manchete (vira o cartão da ação) e as
// reações dos personagens, que entram no feed como posts.
import { acao as tabelaAcao, alerta, eq, eventoAgendado, personagem, post } from '@holofote/db';
import {
  criarRng,
  engajamentoDePersonagem,
  escolherReatores,
  opcoesDiscurso,
  type OpcaoDiscurso,
} from '@holofote/engine';
import type { ContextoWorker } from '../contexto';
import { acaoViva, retomarEntregas, travarAcaoPendente } from '../infra/acao';
import {
  carregarCena,
  cenaAtualizada,
  jogadorAtual,
  jogadorPrompt,
  pessoaCurta,
  personagensDoMundo,
  reatoresPrompt,
  relacoesDoJogador,
} from '../infra/cena';
import { agendarEntregas, type Entrega } from '../infra/feed';
import { gerar } from '../infra/ia';
import { publicarSemFalha } from '../infra/publicador';
import { atrasoDaReacao, deltasDaAcao } from './diretor';

export interface PedidoDiscurso {
  acaoId: string;
}

export async function discurso(ctx: ContextoWorker, pedido: PedidoDiscurso): Promise<void> {
  const a = await acaoViva(ctx, pedido.acaoId);
  if (!a) return;
  const entrada = a.entrada as {
    eventoId: string;
    opcao: OpcaoDiscurso;
    venceu: boolean;
    vencedorId: string;
  };
  const cena = await carregarCena(ctx, a.mundoId);
  // Repetição depois do commit: só falta agendar as entregas e avisar o cartão.
  if (cena && a.iaPendente === 0) return retomarEntregas(ctx, cena, a);
  const [e] = await ctx.db
    .select()
    .from(eventoAgendado)
    .where(eq(eventoAgendado.id, entrada.eventoId));
  if (!cena || !e) {
    await ctx.db.update(tabelaAcao).set({ iaPendente: 0 }).where(eq(tabelaAcao.id, a.id));
    return;
  }
  const [vencedor] = await ctx.db
    .select()
    .from(personagem)
    .where(eq(personagem.id, entrada.vencedorId));

  const personagens = await personagensDoMundo(ctx.db, cena.mundo.id);
  const porId = new Map(personagens.map((p) => [p.id, p]));
  const relacoes = await relacoesDoJogador(ctx.db, cena.jogador.id);
  // Os outros indicados reagem primeiro.
  const concorrentes = e.indicados
    .map((i) => i.personagemId)
    .filter((id) => id !== cena.jogador.id && porId.has(id));
  const ids = escolherReatores({
    personagens: personagens.map((p) => ({
      id: p.id,
      papel: p.papel === 'figurante' ? 'figurante' : 'elenco',
      afinidade: relacoes.get(p.id)?.afinidade ?? 50,
      perfilFofoca: p.perfilFofoca,
    })),
    marcados: concorrentes,
    rng: criarRng(`reatores:${a.id}`),
  });
  const reatores = ids.map((id) => porId.get(id)!);
  const motivos = new Map(concorrentes.map((id) => [id, 'concorria no mesmo evento']));
  const titulo =
    opcoesDiscurso({ ensaiou: true, marcoEspecialCumprido: true }).find(
      (o) => o.id === entrada.opcao,
    )?.rotulo ?? entrada.opcao;

  const { dados } = await gerar(ctx, {
    job: 'discurso',
    mundo: cena.mundo,
    acaoId: a.id,
    entrada: {
      resumoEstado: cena.mundo.resumoEstado,
      jogador: jogadorPrompt(await jogadorAtual(ctx.db, cena)),
      evento: { tipo: e.tipo, titulo: e.titulo, categoria: e.categoria },
      discurso: { opcao: entrada.opcao, titulo },
      resultado: {
        jogadorVenceu: entrada.venceu,
        vencedor: vencedor ? pessoaCurta(vencedor) : null,
      },
      numeros: { deltas: await deltasDaAcao(ctx, a.id) },
      reatores: await reatoresPrompt(ctx.db, cena.jogador.id, reatores, motivos),
    },
  });

  const cartao = { titulo: e.titulo, texto: dados.manchete };

  // As reações partem de agora, não de antes da chamada de IA.
  const depois = await cenaAtualizada(ctx, cena);
  const entregas = await ctx.db.transaction(async (tx) => {
    // Linha travada: se a ação sumiu ou já foi atendida (job repetido), não grava nada.
    if (!(await travarAcaoPendente(tx, a.id))) return null;
    const futuras: Entrega[] = [];
    const rng = criarRng(`reacoes:${a.id}`);
    const primeira = Math.min(...dados.reacoes.map((r) => r.atrasoSeg));
    for (const r of dados.reacoes) {
      const autor = porId.get(r.personagemId);
      if (!autor) continue;
      const entregarEm = new Date(depois.agora.getTime() + atrasoDaReacao(r.atrasoSeg, primeira));
      const numeros = engajamentoDePersonagem({
        seguidores: autor.seguidores,
        polemica: autor.polemica,
        rng,
      });
      const [novo] = await tx
        .insert(post)
        .values({
          mundoId: cena.mundo.id,
          autorId: autor.id,
          texto: r.texto,
          origem: 'discurso',
          acaoId: a.id,
          entregarEm,
          curtidas: numeros.curtidas,
          reposts: numeros.reposts,
          criadoEm: depois.agora,
        })
        .returning({ id: post.id });
      futuras.push({ pedido: { tipo: 'post', id: novo!.id, mundoId: cena.mundo.id }, entregarEm });
      const [aviso] = await tx
        .insert(alerta)
        .values({
          mundoId: cena.mundo.id,
          tipo: 'mencao',
          texto: `${autor.nome} comentou o seu discurso`,
          personagemId: autor.id,
          acaoId: a.id,
          destino: `/post/${novo!.id}/respostas`,
          entregarEm,
        })
        .returning({ id: alerta.id });
      futuras.push({
        pedido: { tipo: 'alerta', id: aviso!.id, mundoId: cena.mundo.id },
        entregarEm,
      });
    }
    await tx.update(tabelaAcao).set({ cartao, iaPendente: 0 }).where(eq(tabelaAcao.id, a.id));
    return futuras;
  });
  if (!entregas) return;

  // Entregas antes do cartão: se o Redis falhar aqui, o job se repete e retoma pelas linhas.
  await agendarEntregas(ctx, depois, entregas);
  await publicarSemFalha(ctx, cena.mundo.id, { tipo: 'cartao', eventoId: a.id, cartao });
}
