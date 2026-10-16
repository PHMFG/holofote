// dm: o personagem responde à mensagem do jogador (ou à resposta a uma história dele). O motor já
// aplicou o delta da DM; a IA escreve de 1 a 3 mensagens, reescreve o resumo da conversa e pode
// sugerir um ajuste pequeno na relação.
import {
  acao as tabelaAcao,
  and,
  conversa,
  desc,
  eq,
  isNull,
  lte,
  mensagem,
  ne,
  or,
  personagem,
  personagemResumoDto,
  post,
} from '@holofote/db';
import { criarRng, inteiroEntre } from '@holofote/engine';
import { ULTIMAS_MENSAGENS_DM, type MensagemDm } from '@holofote/llm';
import type { ContextoWorker } from '../contexto';
import { acaoViva, retomarEntregas, travarAcaoPendente } from '../infra/acao';
import {
  carregarCena,
  cenaAtualizada,
  jogadorAtual,
  jogadorPrompt,
  reatoresPrompt,
} from '../infra/cena';
import { agendarEntregas, type Entrega } from '../infra/feed';
import { gerar } from '../infra/ia';
import { publicarSemFalha } from '../infra/publicador';
import { aplicarSugestaoDeRelacao, lembrar } from '../infra/relacoes';
import { deltasDaAcao } from './diretor';

export interface PedidoDm {
  acaoId: string;
}

/** O resumo da conversa entra no prompt cortado em 600 caracteres. */
const MAX_RESUMO = 600;

export async function dm(ctx: ContextoWorker, pedido: PedidoDm): Promise<void> {
  const a = await acaoViva(ctx, pedido.acaoId);
  if (!a) return;
  const entrada = a.entrada as { texto: string; conversaId: string; historiaId?: string };
  const cena = await carregarCena(ctx, a.mundoId);
  // Repetição depois do commit: só falta agendar as entregas.
  if (cena && a.iaPendente === 0) return retomarEntregas(ctx, cena, a);
  const [c] = await ctx.db.select().from(conversa).where(eq(conversa.id, entrada.conversaId));
  const [p] = c
    ? await ctx.db.select().from(personagem).where(eq(personagem.id, c.personagemId))
    : [];
  if (!cena || !c || !p) {
    await ctx.db.update(tabelaAcao).set({ iaPendente: 0 }).where(eq(tabelaAcao.id, a.id));
    return;
  }

  // Histórico curto: as mensagens antes da do jogador (o resumo da conversa cobre o resto).
  const anteriores = await ctx.db
    .select()
    .from(mensagem)
    .where(
      and(
        eq(mensagem.conversaId, c.id),
        eq(mensagem.oculto, false),
        lte(mensagem.entregarEm, cena.agora),
        or(isNull(mensagem.acaoId), ne(mensagem.acaoId, a.id)),
      ),
    )
    .orderBy(desc(mensagem.entregarEm))
    .limit(ULTIMAS_MENSAGENS_DM);
  const ultimas: MensagemDm[] = anteriores.reverse().map((m) => ({
    autor: m.autorId === cena.jogador.id ? 'jogador' : 'personagem',
    texto: m.texto,
  }));

  const [historia] = entrada.historiaId
    ? await ctx.db.select().from(post).where(eq(post.id, entrada.historiaId))
    : [];

  await publicarSemFalha(ctx, cena.mundo.id, {
    tipo: 'digitando',
    personagem: personagemResumoDto(p),
    conversaId: c.id,
    postId: null,
  });

  const [reator] = await reatoresPrompt(ctx.db, cena.jogador.id, [p]);
  const { dados } = await gerar(ctx, {
    job: 'dm',
    mundo: cena.mundo,
    acaoId: a.id,
    entrada: {
      resumoEstado: cena.mundo.resumoEstado,
      jogador: jogadorPrompt(await jogadorAtual(ctx.db, cena)),
      personagem: reator!,
      resumoConversa: c.resumo || null,
      ultimas,
      mensagem: entrada.texto,
      historia: historia ? { texto: historia.texto } : null,
      numeros: { deltas: await deltasDaAcao(ctx, a.id) },
    },
  });

  // As mensagens partem de agora, não de antes da chamada de IA.
  const depois = await cenaAtualizada(ctx, cena);
  const entregas = await ctx.db.transaction(async (tx) => {
    // Linha travada: se o jogador desfez a DM enquanto a IA escrevia, não grava nada.
    if (!(await travarAcaoPendente(tx, a.id))) return null;
    const futuras: Entrega[] = [];
    const rng = criarRng(`dm:${a.id}`);
    // Tempo de "digitar": alguns segundos por mensagem, mais para as longas.
    let instante = depois.agora.getTime();
    for (const texto of dados.mensagens) {
      instante += (inteiroEntre(rng, 4, 9) + Math.ceil(texto.length / 40)) * 1000;
      const entregarEm = new Date(instante);
      const [msg] = await tx
        .insert(mensagem)
        .values({ conversaId: c.id, autorId: p.id, texto, entregarEm, acaoId: a.id })
        .returning({ id: mensagem.id });
      futuras.push({
        pedido: { tipo: 'mensagem', id: msg!.id, mundoId: cena.mundo.id },
        entregarEm,
      });
    }
    // Relê o resumo com a conversa travada: outra DM pode ter reescrito enquanto a IA escrevia.
    // Nesse caso os dois resumos ficam (cortados no tamanho que o prompt usa) e a próxima DM
    // reescreve um só.
    const [atual] = await tx.select().from(conversa).where(eq(conversa.id, c.id)).for('update');
    const resumo =
      !atual || atual.resumo === c.resumo
        ? dados.resumoConversa
        : `${atual.resumo}\n${dados.resumoConversa}`.slice(-MAX_RESUMO);
    await tx.update(conversa).set({ resumo }).where(eq(conversa.id, c.id));
    await aplicarSugestaoDeRelacao(tx, a.id, cena.jogador.id, p, dados.deltaSugerido);
    if (dados.memoria) await lembrar(tx, p.id, cena.jogador.id, dados.memoria, cena.dia);
    await tx.update(tabelaAcao).set({ iaPendente: 0 }).where(eq(tabelaAcao.id, a.id));
    return futuras;
  });
  if (!entregas) return;
  await agendarEntregas(ctx, depois, entregas);
}
