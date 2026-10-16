// Schema do banco do Holofote (Drizzle, PostgreSQL 17 com pgvector).
//
// Convenções:
// - Colunas em camelCase no TypeScript e snake_case no banco, pela opção `casing: 'snake_case'`
//   usada no drizzle.config.ts e em criarDb. Não escreva nomes de coluna à mão.
// - Ids uuid gerados no banco (gen_random_uuid) e instantes em timestamptz.
// - Tudo pendura no usuário ou no mundo com ON DELETE CASCADE: excluir a conta apaga tudo,
//   inclusive memórias e chamadas de LLM do mundo (plano, seção de privacidade).
// - Todo texto do jogo é gerado pela IA (bíblia, fichas, posts, marcos); o banco guarda o que
//   ela gerou e os números do motor. Não existe tabela de falas prontas.
// - Energia e gemas são livros-caixa: o saldo é a soma dos lançamentos, nunca um campo editado.
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  vector,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import type { Cartao, Marco, ResumoDia } from '@holofote/shared';

// ---------- Enums (os valores batem com os contratos de @holofote/shared; ver schema.test.ts) ----------

export const planoEnum = pgEnum('plano', ['free', 'plus']);
export const preferenciaTemaEnum = pgEnum('preferencia_tema', ['sistema', 'claro', 'escuro']);
export const destaqueEnum = pgEnum('destaque', [
  'laranja',
  'cobalto',
  'violeta',
  'rosa',
  'menta',
  'lima',
]);
export const estadoMundoEnum = pgEnum('estado_mundo', ['criando', 'pronto', 'erro']);
export const papelEnum = pgEnum('papel', ['jogador', 'elenco', 'figurante']);
export const tomAvatarEnum = pgEnum('tom_avatar', ['escuro', 'claro', 'medio']);
export const tipoVinculoEnum = pgEnum('tipo_vinculo', [
  'rival',
  'amizade',
  'parceria',
  'mentor',
  'interesse',
  'fofoca',
]);
export const tipoPostEnum = pgEnum('tipo_post', ['post', 'historia']);
export const tomEnum = pgEnum('tom', ['fofo', 'sincero', 'misterioso', 'provocativo']);
export const origemPostEnum = pgEnum('origem_post', ['jogador', 'diretor', 'lote', 'discurso']);
export const tipoAcaoEnum = pgEnum('tipo_acao', [
  'post',
  'resposta',
  'dm',
  'historia',
  'campanha',
  'discurso',
  'desfazer',
]);
export const motivoEnergiaEnum = pgEnum('motivo_energia', [
  'inicial',
  'acao',
  'recarga',
  'anuncio',
  'gemas',
  'marco',
  'desfazer',
  'debug',
  'estorno',
]);
export const motivoGemasEnum = pgEnum('motivo_gemas', [
  'inicial',
  'marco',
  'evento',
  'compra',
  'energia',
]);
export const tipoEventoEnum = pgEnum('tipo_evento', ['premio', 'show', 'crise']);
export const periodoEnum = pgEnum('periodo', ['manha', 'tarde', 'noite']);
export const estadoEventoEnum = pgEnum('estado_evento', [
  'anunciado',
  'campanha',
  'ao_vivo',
  'encerrado',
]);
export const opcaoDiscursoEnum = pgEnum('opcao_discurso', ['seguro', 'ousado', 'especial']);
export const tipoAlertaEnum = pgEnum('tipo_alerta', [
  'resposta',
  'mencao',
  'dm',
  'marco',
  'evento',
  'seguidores',
  'resumo',
]);

// ---------- Formatos dos campos jsonb ----------

/** Enquete de uma história. Os votos ficam na tabela `voto`. */
export interface EnqueteGravada {
  pergunta: string;
  opcoes: { id: string; texto: string }[];
}

/** Pedido do jogador como chegou à API (texto, tom, marcados, opção...). Formato por tipo, validado pela API. */
export type EntradaAcao = Record<string, unknown>;

/** Números que o motor calculou para a ação. Os deltas ficam na tabela `delta`. */
export interface ConsequenciaAcao {
  seguidoresGanhos: number;
  curtidasSimuladas: number;
  marcoLiberadoId: string | null;
}

/** Requisito de marco. O valor atual é calculado na leitura pelo motor. */
export type RequisitoMarco = Omit<Marco['requisitos'][number], 'atual'>;
export type RecompensaMarco = Marco['recompensa'];

/**
 * Indicado num evento; `base` é o peso no sorteio na escala da fama (0 a 100, ver baseIndicado do
 * motor). A chance de cada um sai de chancesIndicados, recalculada a cada ação de campanha.
 */
export interface IndicadoEvento {
  personagemId: string;
  base: number;
}

export type NumerosResumo = ResumoDia['numeros'];
export type PendenciasResumo = ResumoDia['pendencias'];

// ---------- Colunas comuns ----------

const id = () => uuid().primaryKey().defaultRandom();
const instante = () => timestamp({ withTimezone: true });
const criadoEm = () => instante().notNull().defaultNow();
const contador = () => integer().notNull().default(0);
/** Atributos e afinidade vão de 0 a 100. */
const faixa0a100 = (nome: string, coluna: AnyPgColumn) =>
  check(nome, sql`${coluna} between 0 and 100`);

// ---------- Conta ----------

export const usuario = pgTable('usuario', {
  id: id(),
  /** Login anônimo por aparelho (identifierForVendor). Sign in with Apple entra na F8. */
  aparelhoId: uuid().notNull().unique('usuario_aparelho_id_unico'),
  plano: planoEnum().notNull().default('free'),
  tema: preferenciaTemaEnum().notNull().default('sistema'),
  destaque: destaqueEnum().notNull().default('laranja'),
  /** Fuso IANA do jogador; o dia e o período do mundo seguem o relógio local. */
  fuso: text().notNull().default('America/Sao_Paulo'),
  criadoEm: criadoEm(),
});

/**
 * Mundo do jogador. O dia e o período não são gravados: saem de `criadoEm`, do fuso do usuário e de
 * `deslocamentoMin` (relógio simulado de desenvolvimento, `POST /v1/dev/relogio`).
 * Um mundo ativo por usuário no MVP (índice único parcial); o Plus poderá guardar outros inativos.
 */
export const mundo = pgTable(
  'mundo',
  {
    id: id(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    /** Texto livre ("Pop Brasil" ou o que o jogador escreveu). */
    universo: text().notNull(),
    tomCaos: integer().notNull(),
    ato: integer().notNull().default(1),
    objetivoAto: text(),
    /** Prefixo fixo do prompt, gerado uma vez. Tem de ficar idêntico byte a byte entre chamadas. */
    biblia: text(),
    /** Estado do mundo em até 200 tokens, reescrito no lote diário. */
    resumoEstado: text(),
    estado: estadoMundoEnum().notNull().default('criando'),
    erro: text(),
    deslocamentoMin: integer().notNull().default(0),
    ativo: boolean().notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex('mundo_ativo_por_usuario')
      .on(t.usuarioId)
      .where(sql`${t.ativo}`),
    index('mundo_usuario_idx').on(t.usuarioId),
    faixa0a100('mundo_tom_caos_faixa', t.tomCaos),
    check('mundo_ato_positivo', sql`${t.ato} >= 1`),
  ],
);

// ---------- Pessoas ----------

/**
 * Jogador, elenco e figurantes. `handle` é guardado sem "@" e em minúsculas (o app acrescenta o "@").
 * `ficha` é a personalidade escrita pela IA; no jogador, a descrição da persona.
 */
export const personagem = pgTable(
  'personagem',
  {
    id: id(),
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    papel: papelEnum().notNull(),
    nome: text().notNull(),
    handle: text().notNull(),
    iniciais: text().notNull(),
    tomAvatar: tomAvatarEnum().notNull().default('escuro'),
    verificado: boolean().notNull().default(false),
    ficha: text().notNull(),
    /** Tipo de vínculo com o jogador; nulo no próprio jogador. */
    tipoVinculo: tipoVinculoEnum(),
    /** Perfis de fofoca reagem mais e "lembram" do que foi desfeito. */
    perfilFofoca: boolean().notNull().default(false),
    fama: integer().notNull().default(0),
    carisma: integer().notNull().default(0),
    polemica: integer().notNull().default(0),
    seguidores: integer().notNull().default(0),
    /** O jogador silenciou o personagem (regra de conteúdo gerado da App Store). */
    silenciado: boolean().notNull().default(false),
    /** Marco cuja recompensa criou o personagem (job `ficha`); um personagem por marco. */
    marcoId: uuid().references((): AnyPgColumn => marco.id, { onDelete: 'set null' }),
    criadoEm: criadoEm(),
  },
  (t) => [
    unique('personagem_handle_por_mundo').on(t.mundoId, t.handle),
    unique('personagem_por_marco').on(t.marcoId),
    uniqueIndex('personagem_um_jogador_por_mundo')
      .on(t.mundoId)
      .where(sql`${t.papel} = 'jogador'`),
    check('personagem_handle_formato', sql`${t.handle} ~ '^[a-z0-9_.]{2,24}$'`),
    check('personagem_iniciais_tamanho', sql`char_length(${t.iniciais}) between 1 and 2`),
    check(
      'personagem_jogador_sem_vinculo',
      sql`${t.papel} <> 'jogador' or ${t.tipoVinculo} is null`,
    ),
    faixa0a100('personagem_fama_faixa', t.fama),
    faixa0a100('personagem_carisma_faixa', t.carisma),
    faixa0a100('personagem_polemica_faixa', t.polemica),
    check('personagem_seguidores_positivo', sql`${t.seguidores} >= 0`),
  ],
);

/**
 * Relação dirigida entre dois personagens. A afinidade do jogador com alguém (mapa de relações,
 * delta "relacao:<personagemId>") é a linha com `deId` = jogador e `paraId` = personagem; a chave
 * primária começa por `deId` e serve de índice para "todas as relações de X".
 */
export const relacao = pgTable(
  'relacao',
  {
    deId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    paraId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    afinidade: integer().notNull(),
    /** Derivado da faixa de afinidade pelo motor (Rival, Rivais com respeito, Parceria criativa...). */
    rotulo: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.deId, t.paraId] }),
    index('relacao_para_idx').on(t.paraId),
    faixa0a100('relacao_afinidade_faixa', t.afinidade),
    check('relacao_sem_laco', sql`${t.deId} <> ${t.paraId}`),
  ],
);

/** O que `personagemId` lembra sobre `sobreId`: uma linha por par, reescrita no lote de memória. */
export const memoria = pgTable(
  'memoria',
  {
    id: id(),
    personagemId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    sobreId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    /** Até ~120 tokens, um fato por linha ("Dia 2 · elogiou o clipe dela"). */
    fatos: text().notNull(),
    /** Gerado só no lote de memória; nulo enquanto não houver modelo de embeddings. */
    embedding: vector({ dimensions: 1024 }),
    /** Dia do mundo da última reescrita. */
    dia: integer().notNull(),
    atualizadoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    unique('memoria_por_par').on(t.personagemId, t.sobreId),
    index('memoria_sobre_idx').on(t.sobreId),
    index('memoria_embedding_hnsw').using('hnsw', t.embedding.op('vector_cosine_ops')),
  ],
);

// ---------- Ações do jogador ----------

/**
 * Uma linha por ação do jogador (é a tabela `evento` do plano, renomeada para não confundir com
 * `evento_agendado`). Alimenta o registro de atividades e o desfazer.
 */
export const acao = pgTable(
  'acao',
  {
    id: id(),
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    tipo: tipoAcaoEnum().notNull(),
    entrada: jsonb().$type<EntradaAcao>().notNull(),
    /** Nulo até o motor calcular. */
    consequencia: jsonb().$type<ConsequenciaAcao>(),
    /** Cartão de consequência escrito pela IA; chega depois do 201. */
    cartao: jsonb().$type<Cartao>(),
    /** Reações da IA ainda não geradas. */
    iaPendente: integer().notNull().default(0),
    desfeitaEm: instante(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('acao_mundo_criado_idx').on(t.mundoId, t.criadoEm.desc()),
    // O varredor da API procura ações esperando a IA sem job na fila.
    index('acao_ia_pendente_idx')
      .on(t.criadoEm)
      .where(sql`${t.iaPendente} > 0`),
    check('acao_ia_pendente_positivo', sql`${t.iaPendente} >= 0`),
  ],
);

/** Delta aplicado por uma ação. Desfazer aplica os deltas invertidos. */
export const delta = pgTable(
  'delta',
  {
    id: id(),
    acaoId: uuid()
      .notNull()
      .references(() => acao.id, { onDelete: 'cascade' }),
    /** "fama", "carisma", "polemica", "seguidores" ou "relacao:<personagemId>". */
    alvo: text().notNull(),
    valor: integer().notNull(),
  },
  (t) => [
    index('delta_acao_idx').on(t.acaoId),
    check(
      'delta_alvo_formato',
      sql`${t.alvo} ~ '^(fama|carisma|polemica|seguidores|relacao:[0-9a-f-]{36})$'`,
    ),
  ],
);

// ---------- Posts e histórias ----------

/** Posts, respostas e histórias. Itens com `entregarEm` no futuro ficam invisíveis até a hora. */
export const post = pgTable(
  'post',
  {
    id: id(),
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    autorId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    respondeA: uuid().references((): AnyPgColumn => post.id, { onDelete: 'cascade' }),
    tipo: tipoPostEnum().notNull().default('post'),
    texto: text().notNull(),
    tom: tomEnum(),
    enquete: jsonb().$type<EnqueteGravada>(),
    origem: origemPostEnum().notNull(),
    /** Ação do jogador que originou o post (o próprio post ou a reação a ele). */
    acaoId: uuid().references(() => acao.id, { onDelete: 'set null' }),
    /** Ids de personagens marcados (sem chave estrangeira; o mundo é o mesmo). */
    marcados: uuid()
      .array()
      .notNull()
      .default(sql`'{}'::uuid[]`),
    entregarEm: instante().notNull().defaultNow(),
    expiraEm: instante(),
    /** Escondido pelo desfazer. */
    oculto: boolean().notNull().default(false),
    /** Quando a fila `entrega` publicou o item e somou os contadores (marca de idempotência). */
    entregueEm: instante(),
    curtidas: contador(),
    reposts: contador(),
    respostas: contador(),
    visualizacoes: contador(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('post_mundo_entregar_idx').on(t.mundoId, t.entregarEm.desc()),
    index('post_responde_a_idx').on(t.respondeA),
    index('post_autor_idx').on(t.autorId),
    index('post_acao_idx')
      .on(t.acaoId)
      .where(sql`${t.acaoId} is not null`),
  ],
);

export const curtida = pgTable(
  'curtida',
  {
    postId: uuid()
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    personagemId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    criadoEm: criadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.personagemId] }),
    index('curtida_personagem_idx').on(t.personagemId),
  ],
);

/** Voto em enquete de história. Votar não gera job de IA. */
export const voto = pgTable(
  'voto',
  {
    postId: uuid()
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    personagemId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    /** Id da opção em `post.enquete.opcoes`. */
    opcao: text().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.personagemId] }),
    index('voto_personagem_idx').on(t.personagemId),
  ],
);

export const historiaVista = pgTable(
  'historia_vista',
  {
    postId: uuid()
      .notNull()
      .references(() => post.id, { onDelete: 'cascade' }),
    personagemId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.personagemId] }),
    index('historia_vista_personagem_idx').on(t.personagemId),
  ],
);

// ---------- Mensagens diretas ----------

/** Uma conversa por personagem. O `resumo` entra no prompt no lugar do histórico. */
export const conversa = pgTable(
  'conversa',
  {
    id: id(),
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    personagemId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    resumo: text().notNull().default(''),
    naoLidas: contador(),
    /** O personagem começou a conversa (grátis: uma vez por dia, depois de marco ou evento). */
    puxouConversa: boolean().notNull().default(false),
    criadoEm: criadoEm(),
    atualizadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    unique('conversa_por_personagem').on(t.mundoId, t.personagemId),
    index('conversa_personagem_idx').on(t.personagemId),
    check('conversa_nao_lidas_positivo', sql`${t.naoLidas} >= 0`),
  ],
);

export const mensagem = pgTable(
  'mensagem',
  {
    id: id(),
    conversaId: uuid()
      .notNull()
      .references(() => conversa.id, { onDelete: 'cascade' }),
    autorId: uuid()
      .notNull()
      .references(() => personagem.id, { onDelete: 'cascade' }),
    texto: text().notNull(),
    entregarEm: instante().notNull().defaultNow(),
    acaoId: uuid().references(() => acao.id, { onDelete: 'set null' }),
    oculto: boolean().notNull().default(false),
    /** Quando a fila `entrega` publicou a mensagem e somou as não lidas (marca de idempotência). */
    entregueEm: instante(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('mensagem_conversa_entregar_idx').on(t.conversaId, t.entregarEm),
    index('mensagem_autor_idx').on(t.autorId),
    index('mensagem_acao_idx')
      .on(t.acaoId)
      .where(sql`${t.acaoId} is not null`),
  ],
);

// ---------- Energia e gemas (livros-caixa) ----------

/**
 * Lançamentos de energia: o saldo é a soma, e a recarga natural é calculada na leitura a partir
 * do último lançamento (sem cron). Valor negativo gasta.
 */
export const lancamentoEnergia = pgTable(
  'lancamento_energia',
  {
    id: id(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    valor: integer().notNull(),
    motivo: motivoEnergiaEnum().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('lancamento_energia_usuario_criado_idx').on(t.usuarioId, t.criadoEm),
    check('lancamento_energia_valor_nao_nulo', sql`${t.valor} <> 0`),
  ],
);

/**
 * Lançamentos de gemas. O saldo (soma) nunca fica negativo: regra da API, que trava a linha do
 * usuário (SELECT ... FOR UPDATE) e confere o saldo antes de gravar um débito, na mesma transação.
 */
export const lancamentoGemas = pgTable(
  'lancamento_gemas',
  {
    id: id(),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id, { onDelete: 'cascade' }),
    valor: integer().notNull(),
    motivo: motivoGemasEnum().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('lancamento_gemas_usuario_criado_idx').on(t.usuarioId, t.criadoEm),
    check('lancamento_gemas_valor_nao_nulo', sql`${t.valor} <> 0`),
  ],
);

// ---------- Jornada, eventos e resumo ----------

/** Cinco marcos por ato, gerados pela IA na criação do mundo ou na virada de ato. */
export const marco = pgTable(
  'marco',
  {
    id: id(),
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    ato: integer().notNull(),
    ordem: integer().notNull(),
    titulo: text().notNull(),
    descricao: text().notNull(),
    requisitos: jsonb().$type<RequisitoMarco[]>().notNull(),
    recompensa: jsonb().$type<RecompensaMarco>().notNull(),
    liberadoEm: instante(),
    resgatadoEm: instante(),
  },
  (t) => [
    unique('marco_por_ordem').on(t.mundoId, t.ato, t.ordem),
    check('marco_ordem_positiva', sql`${t.ato} >= 1 and ${t.ordem} >= 1`),
  ],
);

export const eventoAgendado = pgTable(
  'evento_agendado',
  {
    id: id(),
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    tipo: tipoEventoEnum().notNull(),
    titulo: text().notNull(),
    categoria: text().notNull(),
    diaMundo: integer().notNull(),
    periodo: periodoEnum().notNull(),
    indicados: jsonb().$type<IndicadoEvento[]>().notNull(),
    /** Ids do catálogo de ações de campanha já feitas (ex.: "ensaiar"); o detalhe fica em `acao`. */
    campanha: jsonb().$type<string[]>().notNull().default([]),
    estado: estadoEventoEnum().notNull().default('anunciado'),
    vencedorId: uuid().references(() => personagem.id, { onDelete: 'set null' }),
    /** Fim dos 30 segundos de escolha do discurso no ao vivo. */
    prazoAoVivo: instante(),
    discursoEscolhido: opcaoDiscursoEnum(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('evento_agendado_mundo_dia_idx').on(t.mundoId, t.diaMundo),
    index('evento_agendado_vencedor_idx')
      .on(t.vencedorId)
      .where(sql`${t.vencedorId} is not null`),
  ],
);

/** Resumo gerado no lote da madrugada, lido pela tela 20. */
export const resumoDia = pgTable(
  'resumo_dia',
  {
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    dia: integer().notNull(),
    manchete: text().notNull(),
    numeros: jsonb().$type<NumerosResumo>().notNull(),
    pendencias: jsonb().$type<PendenciasResumo>().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [primaryKey({ columns: [t.mundoId, t.dia] })],
);

export const alerta = pgTable(
  'alerta',
  {
    id: id(),
    mundoId: uuid()
      .notNull()
      .references(() => mundo.id, { onDelete: 'cascade' }),
    tipo: tipoAlertaEnum().notNull(),
    texto: text().notNull(),
    personagemId: uuid().references(() => personagem.id, { onDelete: 'set null' }),
    /** Ação do jogador que gerou o alerta (reações da IA); o desfazer apaga ou marca como lido. */
    acaoId: uuid().references(() => acao.id, { onDelete: 'set null' }),
    /** Rota do Expo Router para onde o app navega ao tocar. */
    destino: text().notNull(),
    entregarEm: instante().notNull().defaultNow(),
    lidoEm: instante(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('alerta_mundo_entregar_idx').on(t.mundoId, t.entregarEm.desc()),
    index('alerta_personagem_idx')
      .on(t.personagemId)
      .where(sql`${t.personagemId} is not null`),
    index('alerta_acao_idx')
      .on(t.acaoId)
      .where(sql`${t.acaoId} is not null`),
  ],
);

// ---------- Custo de IA ----------

/** Uma linha por chamada ao provedor. Base do painel de custo e do teto diário. */
export const chamadaLlm = pgTable(
  'chamada_llm',
  {
    id: id(),
    mundoId: uuid().references(() => mundo.id, { onDelete: 'cascade' }),
    acaoId: uuid().references(() => acao.id, { onDelete: 'set null' }),
    /** diretor, dm, discurso, lote, memoria, ficha... */
    job: text().notNull(),
    modelo: text().notNull(),
    tokensCache: contador(),
    tokensEntrada: contador(),
    tokensSaida: contador(),
    custoUsd: numeric({ precision: 12, scale: 6, mode: 'number' }).notNull().default(0),
    latenciaMs: integer().notNull(),
    ok: boolean().notNull(),
    erro: text(),
    criadoEm: criadoEm(),
  },
  (t) => [
    index('chamada_llm_criado_idx').on(t.criadoEm),
    index('chamada_llm_mundo_idx')
      .on(t.mundoId)
      .where(sql`${t.mundoId} is not null`),
    index('chamada_llm_acao_idx')
      .on(t.acaoId)
      .where(sql`${t.acaoId} is not null`),
  ],
);

// ---------- Relações do Drizzle (consultas com `with`) ----------

export const usuarioRelacoes = relations(usuario, ({ many }) => ({
  mundos: many(mundo),
  lancamentosEnergia: many(lancamentoEnergia),
  lancamentosGemas: many(lancamentoGemas),
}));

export const mundoRelacoes = relations(mundo, ({ one, many }) => ({
  usuario: one(usuario, { fields: [mundo.usuarioId], references: [usuario.id] }),
  personagens: many(personagem),
  posts: many(post),
  acoes: many(acao),
  conversas: many(conversa),
  marcos: many(marco),
  eventos: many(eventoAgendado),
  resumos: many(resumoDia),
  alertas: many(alerta),
  chamadas: many(chamadaLlm),
}));

export const personagemRelacoes = relations(personagem, ({ one, many }) => ({
  mundo: one(mundo, { fields: [personagem.mundoId], references: [mundo.id] }),
  posts: many(post),
  relacoesDe: many(relacao, { relationName: 'relacao_de' }),
  relacoesPara: many(relacao, { relationName: 'relacao_para' }),
  memorias: many(memoria, { relationName: 'memoria_de' }),
  memoriasSobre: many(memoria, { relationName: 'memoria_sobre' }),
  curtidas: many(curtida),
  votos: many(voto),
  historiasVistas: many(historiaVista),
  conversas: many(conversa),
  mensagens: many(mensagem),
  eventosVencidos: many(eventoAgendado),
  alertas: many(alerta),
}));

export const relacaoRelacoes = relations(relacao, ({ one }) => ({
  de: one(personagem, {
    fields: [relacao.deId],
    references: [personagem.id],
    relationName: 'relacao_de',
  }),
  para: one(personagem, {
    fields: [relacao.paraId],
    references: [personagem.id],
    relationName: 'relacao_para',
  }),
}));

export const memoriaRelacoes = relations(memoria, ({ one }) => ({
  personagem: one(personagem, {
    fields: [memoria.personagemId],
    references: [personagem.id],
    relationName: 'memoria_de',
  }),
  sobre: one(personagem, {
    fields: [memoria.sobreId],
    references: [personagem.id],
    relationName: 'memoria_sobre',
  }),
}));

export const acaoRelacoes = relations(acao, ({ one, many }) => ({
  mundo: one(mundo, { fields: [acao.mundoId], references: [mundo.id] }),
  deltas: many(delta),
  posts: many(post),
  mensagens: many(mensagem),
  chamadas: many(chamadaLlm),
}));

export const deltaRelacoes = relations(delta, ({ one }) => ({
  acao: one(acao, { fields: [delta.acaoId], references: [acao.id] }),
}));

export const postRelacoes = relations(post, ({ one, many }) => ({
  mundo: one(mundo, { fields: [post.mundoId], references: [mundo.id] }),
  autor: one(personagem, { fields: [post.autorId], references: [personagem.id] }),
  original: one(post, {
    fields: [post.respondeA],
    references: [post.id],
    relationName: 'respostas',
  }),
  respostasDiretas: many(post, { relationName: 'respostas' }),
  acao: one(acao, { fields: [post.acaoId], references: [acao.id] }),
  curtidasDe: many(curtida),
  votos: many(voto),
  vistas: many(historiaVista),
}));

export const curtidaRelacoes = relations(curtida, ({ one }) => ({
  post: one(post, { fields: [curtida.postId], references: [post.id] }),
  personagem: one(personagem, { fields: [curtida.personagemId], references: [personagem.id] }),
}));

export const votoRelacoes = relations(voto, ({ one }) => ({
  post: one(post, { fields: [voto.postId], references: [post.id] }),
  personagem: one(personagem, { fields: [voto.personagemId], references: [personagem.id] }),
}));

export const historiaVistaRelacoes = relations(historiaVista, ({ one }) => ({
  post: one(post, { fields: [historiaVista.postId], references: [post.id] }),
  personagem: one(personagem, {
    fields: [historiaVista.personagemId],
    references: [personagem.id],
  }),
}));

export const conversaRelacoes = relations(conversa, ({ one, many }) => ({
  mundo: one(mundo, { fields: [conversa.mundoId], references: [mundo.id] }),
  personagem: one(personagem, { fields: [conversa.personagemId], references: [personagem.id] }),
  mensagens: many(mensagem),
}));

export const mensagemRelacoes = relations(mensagem, ({ one }) => ({
  conversa: one(conversa, { fields: [mensagem.conversaId], references: [conversa.id] }),
  autor: one(personagem, { fields: [mensagem.autorId], references: [personagem.id] }),
  acao: one(acao, { fields: [mensagem.acaoId], references: [acao.id] }),
}));

export const lancamentoEnergiaRelacoes = relations(lancamentoEnergia, ({ one }) => ({
  usuario: one(usuario, { fields: [lancamentoEnergia.usuarioId], references: [usuario.id] }),
}));

export const lancamentoGemasRelacoes = relations(lancamentoGemas, ({ one }) => ({
  usuario: one(usuario, { fields: [lancamentoGemas.usuarioId], references: [usuario.id] }),
}));

export const marcoRelacoes = relations(marco, ({ one }) => ({
  mundo: one(mundo, { fields: [marco.mundoId], references: [mundo.id] }),
}));

export const eventoAgendadoRelacoes = relations(eventoAgendado, ({ one }) => ({
  mundo: one(mundo, { fields: [eventoAgendado.mundoId], references: [mundo.id] }),
  vencedor: one(personagem, { fields: [eventoAgendado.vencedorId], references: [personagem.id] }),
}));

export const resumoDiaRelacoes = relations(resumoDia, ({ one }) => ({
  mundo: one(mundo, { fields: [resumoDia.mundoId], references: [mundo.id] }),
}));

export const alertaRelacoes = relations(alerta, ({ one }) => ({
  mundo: one(mundo, { fields: [alerta.mundoId], references: [mundo.id] }),
  personagem: one(personagem, { fields: [alerta.personagemId], references: [personagem.id] }),
}));

export const chamadaLlmRelacoes = relations(chamadaLlm, ({ one }) => ({
  mundo: one(mundo, { fields: [chamadaLlm.mundoId], references: [mundo.id] }),
  acao: one(acao, { fields: [chamadaLlm.acaoId], references: [acao.id] }),
}));

// ---------- Tipos inferidos (Linha = o que sai do SELECT; NovaLinha = o que o INSERT aceita) ----------
// Os nomes evitam colidir com os DTOs de @holofote/shared (Mundo, Post, Personagem...).

export type LinhaUsuario = typeof usuario.$inferSelect;
export type NovaLinhaUsuario = typeof usuario.$inferInsert;
export type LinhaMundo = typeof mundo.$inferSelect;
export type NovaLinhaMundo = typeof mundo.$inferInsert;
export type LinhaPersonagem = typeof personagem.$inferSelect;
export type NovaLinhaPersonagem = typeof personagem.$inferInsert;
export type LinhaRelacao = typeof relacao.$inferSelect;
export type NovaLinhaRelacao = typeof relacao.$inferInsert;
export type LinhaMemoria = typeof memoria.$inferSelect;
export type NovaLinhaMemoria = typeof memoria.$inferInsert;
export type LinhaAcao = typeof acao.$inferSelect;
export type NovaLinhaAcao = typeof acao.$inferInsert;
export type LinhaDelta = typeof delta.$inferSelect;
export type NovaLinhaDelta = typeof delta.$inferInsert;
export type LinhaPost = typeof post.$inferSelect;
export type NovaLinhaPost = typeof post.$inferInsert;
export type LinhaCurtida = typeof curtida.$inferSelect;
export type NovaLinhaCurtida = typeof curtida.$inferInsert;
export type LinhaVoto = typeof voto.$inferSelect;
export type NovaLinhaVoto = typeof voto.$inferInsert;
export type LinhaHistoriaVista = typeof historiaVista.$inferSelect;
export type NovaLinhaHistoriaVista = typeof historiaVista.$inferInsert;
export type LinhaConversa = typeof conversa.$inferSelect;
export type NovaLinhaConversa = typeof conversa.$inferInsert;
export type LinhaMensagem = typeof mensagem.$inferSelect;
export type NovaLinhaMensagem = typeof mensagem.$inferInsert;
export type LinhaLancamentoEnergia = typeof lancamentoEnergia.$inferSelect;
export type NovaLinhaLancamentoEnergia = typeof lancamentoEnergia.$inferInsert;
export type LinhaLancamentoGemas = typeof lancamentoGemas.$inferSelect;
export type NovaLinhaLancamentoGemas = typeof lancamentoGemas.$inferInsert;
export type LinhaMarco = typeof marco.$inferSelect;
export type NovaLinhaMarco = typeof marco.$inferInsert;
export type LinhaEventoAgendado = typeof eventoAgendado.$inferSelect;
export type NovaLinhaEventoAgendado = typeof eventoAgendado.$inferInsert;
export type LinhaResumoDia = typeof resumoDia.$inferSelect;
export type NovaLinhaResumoDia = typeof resumoDia.$inferInsert;
export type LinhaAlerta = typeof alerta.$inferSelect;
export type NovaLinhaAlerta = typeof alerta.$inferInsert;
export type LinhaChamadaLlm = typeof chamadaLlm.$inferSelect;
export type NovaLinhaChamadaLlm = typeof chamadaLlm.$inferInsert;
