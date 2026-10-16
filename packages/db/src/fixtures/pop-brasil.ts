// SÓ PARA TESTES E DESENVOLVIMENTO. Nunca chame isto em produção nem a partir de uma rota da API.
//
// Recria o mundo de exemplo "Pop Brasil" das telas do Figma (fileKey z4hwlJgPHTikSzQ9yfjAI9):
// jogadora Lua Prado (@luaprado, 7,1 mil seguidores), elenco com Vic Ferraz (rival, 38%),
// Duda Marques (parceria, 72%), Bento Lima (amizade, 88%) e @fofocalizei (fofoca, 20%), figurantes,
// Ato 1 "Dominar o pop nacional" com cinco marcos, o Prêmio Holofote, posts, histórias e DMs.
// No jogo de verdade todo esse texto é escrito pela IA; aqui ele é fixo para os testes serem estáveis.
//
// Estado do recorte: dia 6 do mundo, marco 1 liberado e ainda não resgatado (para testar o resgate),
// marco 2 "Primeiro show lotado" em andamento, Prêmio Holofote no dia 8 em campanha.
// Saldos: energia 11 (+12 inicial, -1 do post da Lua) e gemas 40 (+40 inicial).
import { randomUUID } from 'node:crypto';
import type { Db } from '../cliente';
import {
  acao,
  alerta,
  chamadaLlm,
  conversa,
  curtida,
  delta,
  eventoAgendado,
  historiaVista,
  lancamentoEnergia,
  lancamentoGemas,
  marco,
  memoria,
  mensagem,
  mundo,
  personagem,
  post,
  relacao,
  resumoDia,
  usuario,
  voto,
  type NovaLinhaConversa,
  type NovaLinhaPersonagem,
  type NovaLinhaPost,
} from '../schema';

export interface OpcoesFixturePopBrasil {
  /** Padrão: um uuid novo, para poder criar várias cópias no mesmo banco. */
  aparelhoId?: string;
  /** Instante de referência do recorte (padrão: agora). O mundo começa cinco dias antes. */
  agora?: Date;
}

export interface FixturePopBrasil {
  usuarioId: string;
  mundoId: string;
  jogadorId: string;
  personagens: {
    vic: string;
    duda: string;
    bento: string;
    fofocalizei: string;
    nina: string;
    carol: string;
    pipoca: string;
  };
  /** Ato 1, na ordem (o índice 1 é "Primeiro show lotado"). */
  marcoIds: string[];
  eventoId: string;
  /** Post da Lua que originou a ação, com respostas da Duda, do Bento e da carol. */
  acaoId: string;
  posts: {
    lua: string;
    vic: string;
    fofocalizei: string;
    respostaDuda: string;
    respostaBento: string;
    respostaCarol: string;
    historiaVic: string;
    historiaDuda: string;
  };
  conversas: { vic: string; duda: string };
}

const MINUTO = 60_000;
const DIA = 24 * 60 * MINUTO;

type ChavePersonagem = 'lua' | keyof FixturePopBrasil['personagens'];

const PERSONAGENS: Record<ChavePersonagem, Omit<NovaLinhaPersonagem, 'mundoId'>> = {
  lua: {
    papel: 'jogador',
    nome: 'Lua Prado',
    handle: 'luaprado',
    iniciais: 'LP',
    tomAvatar: 'escuro',
    ficha: 'cantora em ascensão. escrevo minhas letras e ensaio no quarto até a vizinha reclamar.',
    fama: 24,
    carisma: 61,
    polemica: 18,
    seguidores: 7_100,
  },
  vic: {
    papel: 'elenco',
    nome: 'Vic Ferraz',
    handle: 'vicferraz',
    iniciais: 'VF',
    tomAvatar: 'medio',
    verificado: true,
    tipoVinculo: 'rival',
    ficha:
      'veterana do pop, verificada há anos. competitiva, irônica, nunca perde a pose. acha que a lua copia o estilo dela, mas respeita o talento.',
    fama: 58,
    carisma: 49,
    polemica: 41,
    seguidores: 48_200,
  },
  duda: {
    papel: 'elenco',
    nome: 'Duda Marques',
    handle: 'dudamarques',
    iniciais: 'DM',
    tomAvatar: 'escuro',
    verificado: true,
    tipoVinculo: 'parceria',
    ficha:
      'produtora e compositora. generosa com quem trabalha sério, exigente no estúdio. aposta no refrão da lua.',
    fama: 44,
    carisma: 76,
    polemica: 8,
    seguidores: 23_500,
  },
  bento: {
    papel: 'elenco',
    nome: 'Bento Lima',
    handle: 'bentolima',
    iniciais: 'BL',
    tomAvatar: 'medio',
    tipoVinculo: 'amizade',
    ficha:
      'melhor amigo da lua desde a escola e guitarrista da banda dela. leal, engraçado, sempre o primeiro a comentar.',
    fama: 21,
    carisma: 70,
    polemica: 5,
    seguidores: 5_300,
  },
  fofocalizei: {
    papel: 'elenco',
    nome: 'fofocalizei',
    handle: 'fofocalizei',
    iniciais: 'FO',
    tomAvatar: 'claro',
    tipoVinculo: 'fofoca',
    perfilFofoca: true,
    ficha:
      'perfil de fofoca anônimo. vive de prints, fontes e indiretas. adora uma rivalidade e nunca confirma nada.',
    fama: 38,
    carisma: 27,
    polemica: 76,
    seguidores: 96_000,
  },
  nina: {
    papel: 'figurante',
    nome: 'Nina Costa',
    handle: 'ninacosta',
    iniciais: 'NC',
    tomAvatar: 'claro',
    ficha: 'cantora indie indicada ao prêmio. discreta, próxima da vic.',
    fama: 33,
    carisma: 58,
    polemica: 12,
    seguidores: 15_800,
  },
  carol: {
    papel: 'figurante',
    nome: 'carol_fã',
    handle: 'carol_fa',
    iniciais: 'CF',
    tomAvatar: 'claro',
    ficha: 'fã número um da lua. salva todo pré-save.',
    fama: 2,
    carisma: 40,
    polemica: 0,
    seguidores: 412,
  },
  pipoca: {
    papel: 'figurante',
    nome: 'pipoca',
    handle: 'pipoca',
    iniciais: 'PI',
    tomAvatar: 'medio',
    verificado: true,
    perfilFofoca: true,
    ficha: 'portal de entretenimento. notícia rápida, manchete exagerada.',
    fama: 45,
    carisma: 30,
    polemica: 35,
    seguidores: 210_000,
  },
};

/** Primeira linha de um INSERT ... RETURNING de uma linha só. */
async function uma<T>(consulta: PromiseLike<T[]>, oque: string): Promise<T> {
  const [linha] = await consulta;
  if (!linha) throw new Error(`fixture: ${oque} não criado`);
  return linha;
}

/** Bíblia do mundo: prefixo fixo do prompt, montado uma vez (aqui, a partir do elenco acima). */
function montarBiblia(): string {
  const linha = (p: Omit<NovaLinhaPersonagem, 'mundoId'>) =>
    `- ${p.nome} (@${p.handle}, ${p.papel}${p.tipoVinculo ? `, ${p.tipoVinculo}` : ''}): ${p.ficha}`;
  const { lua, ...outros } = PERSONAGENS;
  return [
    'universo: Pop Brasil. o pop nacional visto pelas redes: lançamentos, rivalidades, fofoca e prêmios.',
    'tom: caos 40 de 100. drama leve, sem violência, sem pessoas reais.',
    `jogadora: ${lua.nome} (@${lua.handle}): ${lua.ficha}`,
    'elenco e figurantes:',
    ...Object.values(outros).map(linha),
  ].join('\n');
}

export async function criarFixturePopBrasil(
  db: Db,
  opcoes: OpcoesFixturePopBrasil = {},
): Promise<FixturePopBrasil> {
  const agora = opcoes.agora ?? new Date();
  const antes = (minutos: number) => new Date(agora.getTime() - minutos * MINUTO);
  const depois = (minutos: number) => new Date(agora.getTime() + minutos * MINUTO);
  // Dia 1 começou há cinco dias: o recorte é o dia 6.
  const inicio = new Date(agora.getTime() - 5 * DIA);
  const noDia = (dia: number) => new Date(inicio.getTime() + (dia - 1) * DIA);

  return db.transaction(async (tx) => {
    const u = await uma(
      tx
        .insert(usuario)
        .values({ aparelhoId: opcoes.aparelhoId ?? randomUUID(), criadoEm: inicio })
        .returning({ id: usuario.id }),
      'usuário',
    );

    const m = await uma(
      tx
        .insert(mundo)
        .values({
          usuarioId: u.id,
          universo: 'Pop Brasil',
          tomCaos: 40,
          ato: 1,
          objetivoAto: 'Dominar o pop nacional',
          biblia: montarBiblia(),
          resumoEstado:
            'dia 6. a lua soltou o refrão novo e a duda puxou os elogios. a vic insinuou que a lua copia o figurino dela e ofereceu um feat por dm. prêmio holofote no dia 8: lua, vic e nina disputam revelação do ano.',
          estado: 'pronto',
          criadoEm: inicio,
        })
        .returning({ id: mundo.id }),
      'mundo',
    );

    const chaves = Object.keys(PERSONAGENS) as ChavePersonagem[];
    const criados = await tx
      .insert(personagem)
      .values(chaves.map((chave) => ({ ...PERSONAGENS[chave], mundoId: m.id, criadoEm: inicio })))
      .returning({ id: personagem.id, handle: personagem.handle });
    const idPorHandle = new Map(criados.map((c) => [c.handle, c.id]));
    const ids = Object.fromEntries(
      chaves.map((chave) => {
        const id = idPorHandle.get(PERSONAGENS[chave].handle);
        if (!id) throw new Error(`fixture: personagem ${chave} não criado`);
        return [chave, id];
      }),
    ) as Record<ChavePersonagem, string>;

    // Afinidade do jogador com cada um (de = jogador) e dois laços do mapa entre personagens.
    await tx.insert(relacao).values([
      { deId: ids.lua, paraId: ids.vic, afinidade: 38, rotulo: 'Rivais com respeito' },
      { deId: ids.lua, paraId: ids.duda, afinidade: 72, rotulo: 'Parceria criativa' },
      { deId: ids.lua, paraId: ids.bento, afinidade: 88, rotulo: 'Melhor amigo' },
      { deId: ids.lua, paraId: ids.fofocalizei, afinidade: 20, rotulo: 'Perfil de fofoca' },
      { deId: ids.lua, paraId: ids.nina, afinidade: 30, rotulo: 'Rivais com respeito' },
      { deId: ids.vic, paraId: ids.nina, afinidade: 64, rotulo: 'Parceria' },
      { deId: ids.duda, paraId: ids.bento, afinidade: 81, rotulo: 'Aliança' },
    ]);

    await tx.insert(memoria).values([
      {
        personagemId: ids.duda,
        sobreId: ids.lua,
        fatos: 'Dia 2 · elogiou o clipe dela\nDia 6 · topou o estúdio na quinta',
        dia: 6,
        atualizadoEm: antes(30),
      },
      {
        personagemId: ids.vic,
        sobreId: ids.lua,
        fatos: 'Dia 6 · postou indireta sobre figurino copiado',
        dia: 6,
        atualizadoEm: antes(30),
      },
      {
        personagemId: ids.bento,
        sobreId: ids.lua,
        fatos: 'Dia 5 · pediu a setlist do show',
        dia: 5,
        atualizadoEm: noDia(5),
      },
    ]);

    // Energia e gemas: lançamento inicial e o débito do post da Lua.
    await tx.insert(lancamentoEnergia).values([
      { usuarioId: u.id, valor: 12, motivo: 'inicial', criadoEm: inicio },
      { usuarioId: u.id, valor: -1, motivo: 'acao', criadoEm: antes(40) },
    ]);
    await tx.insert(lancamentoGemas).values({
      usuarioId: u.id,
      valor: 40,
      motivo: 'inicial',
      criadoEm: inicio,
    });

    // A ação do jogador: o post do refrão, com o que o motor calculou e o cartão da IA.
    const textoLua = 'o refrão novo saiu da gaveta. sexta tem pré-save e eu tô tremendo';
    const a = await uma(
      tx
        .insert(acao)
        .values({
          mundoId: m.id,
          tipo: 'post',
          entrada: { texto: textoLua, tom: 'sincero', marcados: [ids.duda] },
          consequencia: { seguidoresGanhos: 120, curtidasSimuladas: 128, marcoLiberadoId: null },
          cartao: {
            titulo: 'O refrão pegou',
            texto:
              'a duda puxou a fila de elogios e o pré-save ganhou tração. a vic ficou quieta, por enquanto.',
          },
          iaPendente: 0,
          criadoEm: antes(40),
        })
        .returning({ id: acao.id }),
      'ação',
    );

    await tx.insert(delta).values([
      { acaoId: a.id, alvo: 'seguidores', valor: 120 },
      { acaoId: a.id, alvo: 'carisma', valor: 1 },
      { acaoId: a.id, alvo: `relacao:${ids.duda}`, valor: 2 },
    ]);

    await tx.insert(chamadaLlm).values({
      mundoId: m.id,
      acaoId: a.id,
      job: 'diretor',
      modelo: 'deepseek-v4.1-flash',
      tokensCache: 1_500,
      tokensEntrada: 2_010,
      tokensSaida: 340,
      custoUsd: 0.000832,
      latenciaMs: 2_140,
      ok: true,
      criadoEm: antes(39),
    });

    // Posts do feed e histórias. As respostas vêm do diretor, ligadas à ação.
    const novoPost = async (valores: Omit<NovaLinhaPost, 'mundoId'>) =>
      (
        await uma(
          tx
            .insert(post)
            .values({ ...valores, mundoId: m.id })
            .returning({ id: post.id }),
          'post',
        )
      ).id;

    const pLua = await novoPost({
      autorId: ids.lua,
      texto: textoLua,
      tom: 'sincero',
      origem: 'jogador',
      acaoId: a.id,
      marcados: [ids.duda],
      entregarEm: antes(40),
      curtidas: 128,
      reposts: 4,
      respostas: 12,
      criadoEm: antes(40),
    });
    const pVic = await novoPost({
      autorId: ids.vic,
      texto: 'tem gente copiando meu figurino de novo. coincidência? acho que não',
      tom: 'provocativo',
      origem: 'lote',
      entregarEm: antes(12),
      curtidas: 1_840,
      reposts: 21,
      respostas: 48,
      criadoEm: noDia(6),
    });
    const pFofoca = await novoPost({
      autorId: ids.fofocalizei,
      texto:
        'uma cantora em ascensão e uma veterana verificada com o mesmo figurino na mesma semana. a gente só observa',
      tom: 'provocativo',
      origem: 'lote',
      entregarEm: antes(120),
      curtidas: 960,
      reposts: 87,
      respostas: 133,
      criadoEm: noDia(6),
    });
    const hVic = await novoPost({
      autorId: ids.vic,
      tipo: 'historia',
      texto: 'figurino do prêmio. vocês decidem',
      enquete: {
        pergunta: 'qual figurino pro prêmio?',
        opcoes: [
          { id: 'brilho', texto: 'brilho total' },
          { id: 'couro', texto: 'couro preto' },
        ],
      },
      origem: 'lote',
      entregarEm: antes(60),
      expiraEm: depois(23 * 60),
      visualizacoes: 5_400,
      criadoEm: noDia(6),
    });
    const hDuda = await novoPost({
      autorId: ids.duda,
      tipo: 'historia',
      texto: 'estúdio fechado pra quinta. alguém adivinha com quem?',
      origem: 'lote',
      entregarEm: antes(180),
      expiraEm: depois(21 * 60),
      visualizacoes: 2_100,
      criadoEm: noDia(6),
    });
    const rDuda = await novoPost({
      autorId: ids.duda,
      respondeA: pLua,
      texto: 'lua, o refrão é seu. ninguém canta igual',
      origem: 'diretor',
      acaoId: a.id,
      entregarEm: antes(32),
      curtidas: 312,
      reposts: 2,
      respostas: 4,
      criadoEm: antes(39),
    });
    const rBento = await novoPost({
      autorId: ids.bento,
      respondeA: rDuda,
      texto: 'concordo, e o clipe vai ser maior ainda',
      origem: 'diretor',
      acaoId: a.id,
      entregarEm: antes(29),
      curtidas: 41,
      criadoEm: antes(39),
    });
    const rCarol = await novoPost({
      autorId: ids.carol,
      respondeA: pLua,
      texto: 'já salvei o pré-save',
      origem: 'diretor',
      acaoId: a.id,
      entregarEm: antes(20),
      curtidas: 18,
      criadoEm: antes(39),
    });

    await tx.insert(curtida).values([
      { postId: rDuda, personagemId: ids.lua, criadoEm: antes(31) },
      { postId: pLua, personagemId: ids.duda, criadoEm: antes(33) },
      { postId: pLua, personagemId: ids.bento, criadoEm: antes(30) },
    ]);
    await tx.insert(voto).values({ postId: hVic, personagemId: ids.carol, opcao: 'brilho' });
    await tx.insert(historiaVista).values({ postId: hDuda, personagemId: ids.lua });

    // DM com a Vic (tela 04) e a Duda puxando conversa (tela 14).
    const novaConversa = async (valores: Omit<NovaLinhaConversa, 'mundoId'>) =>
      uma(
        tx
          .insert(conversa)
          .values({ ...valores, mundoId: m.id })
          .returning({ id: conversa.id }),
        'conversa',
      );
    const cVic = await novaConversa({
      personagemId: ids.vic,
      resumo:
        'rivalidade cordial. a vic viu indireta no post do figurino e ofereceu um feat; a lua disse que vai pensar.',
      criadoEm: antes(10),
      atualizadaEm: antes(6),
    });
    const cDuda = await novaConversa({
      personagemId: ids.duda,
      naoLidas: 1,
      puxouConversa: true,
      criadoEm: antes(2),
      atualizadaEm: antes(2),
    });

    const falas: [string, string, number][] = [
      [ids.vic, 'vi a indireta. criativo.', 10],
      [ids.lua, 'indireta? eu só falei do meu figurino novo', 9],
      [ids.vic, 'claro. e eu ensaio seis horas por dia por acaso', 8],
      [ids.vic, 'se um dia quiser um feat de verdade, sabe onde me achar', 7],
      [ids.lua, 'vou pensar. talvez numa terça.', 6],
    ];
    await tx.insert(mensagem).values([
      ...falas.map(([autorId, texto, min]) => ({
        conversaId: cVic.id,
        autorId,
        texto,
        entregarEm: antes(min),
        criadoEm: antes(min),
      })),
      {
        conversaId: cDuda.id,
        autorId: ids.duda,
        texto: 'bora fechar o estúdio quinta?',
        entregarEm: antes(2),
        criadoEm: antes(2),
      },
    ]);

    // Ato 1: marco 1 liberado (sem resgate), marco 2 em andamento.
    const recompensaPadrao = {
      gemas: 25,
      energiaCheia: true,
      acaoNova: null,
      personagemNovo: false,
    };
    const marcos = await tx
      .insert(marco)
      .values([
        {
          mundoId: m.id,
          ato: 1,
          ordem: 1,
          titulo: 'Primeiro hit viral',
          descricao: 'Um post seu passa de mil curtidas e o pop nacional começa a prestar atenção.',
          requisitos: [{ chave: 'curtidas_post', rotulo: 'Curtidas em um post', alvo: 1_000 }],
          recompensa: { ...recompensaPadrao, acaoNova: 'Responder histórias' },
          liberadoEm: noDia(4),
        },
        {
          mundoId: m.id,
          ato: 1,
          ordem: 2,
          titulo: 'Primeiro show lotado',
          descricao: 'Libera a turnê e o personagem Rafa Souza, empresário.',
          requisitos: [
            { chave: 'escandalos', rotulo: 'Escândalos administrados', alvo: 4 },
            { chave: 'carisma', rotulo: 'Carisma', alvo: 70 },
            { chave: 'seguidores', rotulo: 'Seguidores', alvo: 10_000 },
          ],
          recompensa: { ...recompensaPadrao, acaoNova: 'Anunciar a turnê', personagemNovo: true },
        },
        {
          mundoId: m.id,
          ato: 1,
          ordem: 3,
          titulo: 'Primeiro feat',
          descricao: 'Fale com três artistas e feche uma parceria musical.',
          requisitos: [
            { chave: 'artistas_conversados', rotulo: 'Artistas com quem conversou', alvo: 3 },
            { chave: 'parcerias', rotulo: 'Relações acima de 70%', alvo: 2 },
          ],
          recompensa: { ...recompensaPadrao, acaoNova: 'Lançar feat' },
        },
        {
          mundoId: m.id,
          ato: 1,
          ordem: 4,
          titulo: 'Capa de playlist',
          descricao: 'Entre na playlist mais ouvida do país.',
          requisitos: [
            { chave: 'fama', rotulo: 'Fama', alvo: 50 },
            { chave: 'seguidores', rotulo: 'Seguidores', alvo: 25_000 },
          ],
          recompensa: { ...recompensaPadrao, personagemNovo: true },
        },
        {
          mundoId: m.id,
          ato: 1,
          ordem: 5,
          titulo: 'Rainha do pop nacional',
          descricao: 'Vença um prêmio e feche o ato no topo.',
          requisitos: [
            { chave: 'premios', rotulo: 'Prêmios vencidos', alvo: 1 },
            { chave: 'fama', rotulo: 'Fama', alvo: 70 },
            { chave: 'seguidores', rotulo: 'Seguidores', alvo: 50_000 },
          ],
          recompensa: { ...recompensaPadrao, gemas: 40, personagemNovo: true },
        },
      ])
      .returning({ id: marco.id, ordem: marco.ordem });
    const marcoIds = marcos.sort((x, y) => x.ordem - y.ordem).map((x) => x.id);

    const evento = await uma(
      tx
        .insert(eventoAgendado)
        .values({
          mundoId: m.id,
          tipo: 'premio',
          titulo: 'Prêmio Holofote',
          categoria: 'Revelação do ano',
          diaMundo: 8,
          periodo: 'noite',
          indicados: [
            { personagemId: ids.vic, base: 41 },
            { personagemId: ids.lua, base: 34 },
            { personagemId: ids.nina, base: 25 },
          ],
          estado: 'campanha',
          criadoEm: noDia(5),
        })
        .returning({ id: eventoAgendado.id }),
      'evento',
    );

    await tx.insert(resumoDia).values({
      mundoId: m.id,
      dia: 6,
      manchete: 'Lua Prado solta o refrão novo e a Vic responde com indireta',
      numeros: [
        { rotulo: 'Seguidores', valor: '7,1 mil', variacao: 120 },
        { rotulo: 'Carisma', valor: '61%', variacao: 3 },
        { rotulo: 'Polêmica', valor: '18%', variacao: 6 },
      ],
      pendencias: [
        { texto: 'Responder a Vic', destino: { rota: `/dm/${cVic.id}` } },
        {
          texto: 'Fazer campanha para o Prêmio Holofote',
          destino: { rota: `/evento/${evento.id}` },
        },
      ],
      criadoEm: noDia(6),
    });

    await tx.insert(alerta).values([
      {
        mundoId: m.id,
        tipo: 'resposta',
        texto: 'Duda Marques respondeu seu post',
        personagemId: ids.duda,
        destino: `/post/${pLua}/respostas`,
        entregarEm: antes(32),
        criadoEm: antes(39),
      },
      {
        mundoId: m.id,
        tipo: 'evento',
        texto: 'Prêmio Holofote em 2 dias. Você foi indicada.',
        destino: `/evento/${evento.id}`,
        entregarEm: noDia(6),
        lidoEm: antes(120),
        criadoEm: noDia(5),
      },
      {
        mundoId: m.id,
        tipo: 'dm',
        texto: 'Duda Marques puxou conversa',
        personagemId: ids.duda,
        destino: `/dm/${cDuda.id}`,
        entregarEm: antes(2),
        criadoEm: antes(2),
      },
    ]);

    return {
      usuarioId: u.id,
      mundoId: m.id,
      jogadorId: ids.lua,
      personagens: {
        vic: ids.vic,
        duda: ids.duda,
        bento: ids.bento,
        fofocalizei: ids.fofocalizei,
        nina: ids.nina,
        carol: ids.carol,
        pipoca: ids.pipoca,
      },
      marcoIds,
      eventoId: evento.id,
      acaoId: a.id,
      posts: {
        lua: pLua,
        vic: pVic,
        fofocalizei: pFofoca,
        respostaDuda: rDuda,
        respostaBento: rBento,
        respostaCarol: rCarol,
        historiaVic: hVic,
        historiaDuda: hDuda,
      },
      conversas: { vic: cVic.id, duda: cDuda.id },
    };
  });
}
