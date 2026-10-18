// Contratos da API /v1 e do WebSocket, compartilhados entre apps/server e apps/mobile.
// Fonte única: o servidor valida a saída com estes schemas e o app tipa as respostas por eles.
// Resumo legível em docs/CONTRATOS.md.
import { z } from 'zod';

// ---------- Domínio ----------

export const Tom = z.enum(['fofo', 'sincero', 'misterioso', 'provocativo']);
export const Periodo = z.enum(['manha', 'tarde', 'noite']);
export const Atributo = z.enum(['fama', 'carisma', 'polemica']);
export const Papel = z.enum(['jogador', 'elenco', 'figurante']);
export const TomAvatar = z.enum(['escuro', 'claro', 'medio']);
export const Plano = z.enum(['free', 'plus']);
export const NomeDestaque = z.enum(['laranja', 'cobalto', 'violeta', 'rosa', 'menta', 'lima']);
export const PreferenciaTema = z.enum(['sistema', 'claro', 'escuro']);
export const TipoAcao = z.enum([
  'post',
  'resposta',
  'dm',
  'historia',
  'campanha',
  'discurso',
  'desfazer',
]);
export const EstadoMundo = z.enum(['criando', 'pronto', 'erro']);
export const TipoAlerta = z.enum([
  'resposta',
  'mencao',
  'dm',
  'marco',
  'evento',
  'seguidores',
  'resumo',
]);
export const EstadoMarco = z.enum(['concluido', 'atual', 'futuro']);
export const TipoEventoAgendado = z.enum(['premio', 'show', 'crise']);
export const EstadoEventoAgendado = z.enum(['anunciado', 'campanha', 'ao_vivo', 'encerrado']);
export const OpcaoDiscursoId = z.enum(['seguro', 'ousado', 'especial']);
export const ViaRecarga = z.enum(['gemas', 'anuncio', 'debug']);

export type Tom = z.infer<typeof Tom>;
export type Periodo = z.infer<typeof Periodo>;
export type Atributo = z.infer<typeof Atributo>;
export type Papel = z.infer<typeof Papel>;
export type TomAvatar = z.infer<typeof TomAvatar>;
export type Plano = z.infer<typeof Plano>;
export type TipoAcao = z.infer<typeof TipoAcao>;

const id = z.uuid();
const instante = z.iso.datetime({ offset: true });
const nota = z.number().int().min(0).max(100);
const faixa = z.tuple([z.number(), z.number()]);
const texto = (max: number) => z.string().trim().min(1).max(max);

/** Para onde o app navega ao tocar num alerta ou pendência (rota do Expo Router). */
export const Destino = z.object({ rota: z.string() });

// ---------- Pessoas ----------

export const PersonagemResumo = z.object({
  id,
  nome: z.string(),
  handle: z.string(),
  iniciais: z.string().max(2),
  tomAvatar: TomAvatar,
  verificado: z.boolean(),
  papel: Papel,
});

export const Relacao = z.object({
  afinidade: nota,
  /** Derivado da faixa pelo motor: Rival, Rivais com respeito, Conhecidos, Parceria, Amizade, Aliança. */
  rotulo: z.string(),
});

export const Personagem = PersonagemResumo.extend({
  /** Personalidade em poucas linhas, gerada pela IA. */
  ficha: z.string(),
  fama: nota,
  carisma: nota,
  polemica: nota,
  seguidores: z.number().int().min(0),
  relacao: Relacao.nullable(),
  /** O que o personagem lembra do jogador (memórias). */
  lembra: z.array(z.string()),
  /** Silenciado pelo jogador: some do feed e da lista de conversas e o elenco não reage por ele. */
  silenciado: z.boolean(),
});

// ---------- Posts e histórias ----------

export const Enquete = z.object({
  pergunta: z.string(),
  opcoes: z.array(z.object({ id: z.string(), texto: z.string(), votos: z.number().int().min(0) })),
  meuVoto: z.string().nullable(),
});

export const Post = z.object({
  id,
  autor: PersonagemResumo,
  texto: z.string(),
  tipo: z.enum(['post', 'historia']),
  tom: Tom.nullable(),
  respondeA: id.nullable(),
  marcados: z.array(PersonagemResumo),
  curtidas: z.number().int().min(0),
  reposts: z.number().int().min(0),
  respostas: z.number().int().min(0),
  curtidoPorMim: z.boolean(),
  criadoEm: instante,
  enquete: Enquete.nullable(),
  expiraEm: instante.nullable(),
});

export const HistoriaResumo = z.object({ id, autor: PersonagemResumo, vista: z.boolean() });

// ---------- Consequências e energia ----------

export const Delta = z.object({
  /** "fama", "carisma", "polemica", "seguidores" ou "relacao:<personagemId>". */
  alvo: z.string(),
  valor: z.number(),
});

export const EstadoEnergia = z.object({
  atual: z.number().int().min(0),
  max: z.number().int().min(1),
  /** Quando entra a próxima unidade da recarga natural; null com a barra cheia. */
  proximaEm: instante.nullable(),
  plano: Plano,
  /** Regras do motor para o plano atual: o app mostra estes números em vez de repeti-los. */
  regras: z.object({
    recargaMin: z.number().int().positive(),
    gemasParaEncher: z.number().int().positive(),
    anuncioEnergia: z.number().int().positive(),
    anunciosPorDia: z.number().int().min(0),
  }),
});

export const Cartao = z.object({ titulo: z.string(), texto: z.string() });
export const MarcoResumo = z.object({ id, titulo: z.string() });

export const Consequencia = z.object({
  eventoId: id,
  deltas: z.array(Delta),
  seguidoresGanhos: z.number().int(),
  curtidasSimuladas: z.number().int().min(0),
  /** Escrito pela IA; chega depois pelo WebSocket (evento "cartao") e fica null até lá. */
  cartao: Cartao.nullable(),
  reacoesPendentes: z.number().int().min(0),
  energia: EstadoEnergia,
  marcoLiberado: MarcoResumo.nullable(),
  desfazivelAte: instante.nullable(),
});

// ---------- Conta e mundo ----------

export const Aparencia = z.object({ tema: PreferenciaTema, destaque: NomeDestaque });

export const Conta = z.object({
  usuarioId: id,
  plano: Plano,
  gemas: z.number().int().min(0),
  energia: EstadoEnergia,
  aparencia: Aparencia,
  mundoId: id.nullable(),
  anunciosRestantesHoje: z.number().int().min(0),
});

export const Mundo = z.object({
  id,
  universo: z.string(),
  tomCaos: nota,
  dia: z.number().int().min(1),
  periodo: Periodo,
  ato: z.number().int().min(1),
  objetivoAto: z.string().nullable(),
  estado: EstadoMundo,
  jogador: Personagem,
  /**
   * Hora do mundo quando a resposta saiu. Igual à real em produção; adiantada pelo relógio de
   * desenvolvimento (POST /v1/dev/relogio). O app conta idades (curtidas que sobem) por ela.
   */
  agora: instante,
});

// ---------- Mensagens e alertas ----------

export const Conversa = z.object({
  id,
  personagem: PersonagemResumo,
  relacao: Relacao,
  ultima: z.object({ texto: z.string(), criadoEm: instante, minha: z.boolean() }).nullable(),
  naoLidas: z.number().int().min(0),
  puxouConversa: z.boolean(),
  /** O personagem está silenciado: a conversa fica fora da lista de mensagens, mas abre pelo perfil. */
  silenciada: z.boolean(),
});

export const Mensagem = z.object({
  id,
  conversaId: id,
  minha: z.boolean(),
  texto: z.string(),
  criadoEm: instante,
});

export const Alerta = z.object({
  id,
  tipo: TipoAlerta,
  texto: z.string(),
  criadoEm: instante,
  lido: z.boolean(),
  personagem: PersonagemResumo.nullable(),
  destino: Destino,
});

// ---------- Jornada, eventos e resumo ----------

export const Requisito = z.object({
  chave: z.string(),
  rotulo: z.string(),
  atual: z.number(),
  alvo: z.number(),
});

export const Marco = z.object({
  id,
  ordem: z.number().int().min(1),
  titulo: z.string(),
  descricao: z.string(),
  estado: EstadoMarco,
  requisitos: z.array(Requisito),
  recompensa: z.object({
    gemas: z.number().int().min(0),
    energiaCheia: z.boolean(),
    acaoNova: z.string().nullable(),
    personagemNovo: z.boolean(),
  }),
  liberadoEm: instante.nullable(),
  resgatado: z.boolean(),
});

export const Quando = z.object({ dia: z.number().int().min(1), periodo: Periodo });

export const EventoResumo = z.object({
  id,
  titulo: z.string(),
  quando: Quando,
  estado: EstadoEventoAgendado,
});

export const Jornada = z.object({
  ato: z.number().int().min(1),
  objetivo: z.string(),
  progressoAto: z.number().min(0).max(1),
  marcos: z.array(Marco),
  proximoEvento: EventoResumo.nullable(),
  /**
   * Presente quando o jogador resgatou os cinco marcos do ato e o ato seguinte ainda está sendo
   * escrito pela IA; some quando o ato novo começa (a jornada passa a mostrar o ato novo).
   */
  proximoAto: z.object({ ato: z.number().int().min(2) }).optional(),
});

export const EventoAgendado = z.object({
  id,
  tipo: TipoEventoAgendado,
  titulo: z.string(),
  categoria: z.string(),
  quando: Quando,
  estado: EstadoEventoAgendado,
  indicados: z.array(z.object({ personagem: PersonagemResumo, chance: z.number().min(0).max(1) })),
  acoes: z.array(
    z.object({
      id: z.string(),
      titulo: z.string(),
      descricao: z.string(),
      custo: z.number().int().min(1).max(2),
      feita: z.boolean(),
    }),
  ),
  discurso: z.array(
    z.object({
      id: OpcaoDiscursoId,
      titulo: z.string(),
      liberada: z.boolean(),
      motivo: z.string().nullable(),
    }),
  ),
  vencedor: PersonagemResumo.nullable(),
  /** Fim dos 30 segundos de escolha no ao vivo. */
  prazoAoVivo: instante.nullable(),
});

export const ResumoDia = z.object({
  dia: z.number().int().min(1),
  manchete: z.string(),
  numeros: z.array(
    z.object({ rotulo: z.string(), valor: z.string(), variacao: z.number().nullable() }),
  ),
  pendencias: z.array(z.object({ texto: z.string(), destino: Destino })),
});

export const ItemRegistro = z.object({
  eventoId: id,
  tipo: TipoAcao,
  resumo: z.string(),
  criadoEm: instante,
  deltas: z.array(Delta),
  desfazivel: z.boolean(),
  desfeito: z.boolean(),
});

// ---------- Pedidos e respostas por rota ----------

export const Erro = z.object({
  /** Código estável: sem_energia, moderacao, nao_encontrado, invalido, desfazer_expirado, ... */
  erro: z.string(),
  mensagem: z.string(),
});

export const PedidoAuth = z.object({ aparelhoId: id });
export const RespostaAuth = z.object({ token: z.string(), usuarioId: id });

export const PedidoCriarMundo = z.object({
  /** Uma das sugestões do app ou texto livre ("Criar do zero"). */
  universo: texto(80),
  tomCaos: nota,
  persona: z.object({
    nome: texto(40),
    handle: z.string().regex(/^@?[a-z0-9_.]{2,24}$/i),
    descricao: texto(140),
  }),
  consentimentoIA: z.literal(true),
});

export const RespostaFeed = z.object({
  itens: z.array(Post),
  proximoCursor: z.string().nullable(),
  historias: z.array(HistoriaResumo),
});

export const PedidoPost = z.object({
  texto: texto(280),
  tom: Tom,
  marcados: z.array(id).max(3),
});

export const RespostaPrevia = z.object({
  custo: z.number().int(),
  alcance: faixa,
  seguidores: faixa,
  polemica: faixa,
  relacoes: z.array(z.object({ personagem: PersonagemResumo, afinidade: faixa })),
});

export const RespostaAcaoComPost = z.object({ post: Post, consequencia: Consequencia });

export const PedidoTexto = z.object({ texto: texto(280) });

export const PedidoSilenciar = z.object({ silenciado: z.boolean() });

export const RespostaThread = z.object({
  post: Post,
  respostas: z.array(Post),
  digitando: z.array(PersonagemResumo),
});

export const RespostaMensagem = z.object({ mensagem: Mensagem, consequencia: Consequencia });

export const PedidoVoto = z.object({ opcao: z.string() });
export const PedidoCampanha = z.object({ acaoId: z.string() });
export const PedidoDiscurso = z.object({ opcao: OpcaoDiscursoId });
export const RespostaEventoComConsequencia = z.object({
  evento: EventoAgendado,
  consequencia: Consequencia,
});

export const PedidoRecarga = z.object({ via: ViaRecarga });
export const RespostaRecarga = z.object({
  energia: EstadoEnergia,
  gemas: z.number().int().min(0),
  anunciosRestantesHoje: z.number().int().min(0),
});

export const RespostaRelacoes = z.object({
  jogador: PersonagemResumo,
  nos: z.array(
    z.object({ personagem: PersonagemResumo, relacao: Relacao, lembra: z.array(z.string()) }),
  ),
});

export const PedidoRelogio = z.object({
  avancarMinutos: z
    .number()
    .int()
    .min(1)
    .max(60 * 24 * 7),
});

// ---------- Tempo real (WS /v1/tempo-real) ----------

export const EventoTempoReal = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('post'), post: Post }),
  z.object({
    tipo: z.literal('digitando'),
    personagem: PersonagemResumo,
    conversaId: id.nullable(),
    postId: id.nullable(),
  }),
  z.object({ tipo: z.literal('mensagem'), mensagem: Mensagem }),
  z.object({ tipo: z.literal('alerta'), alerta: Alerta }),
  z.object({ tipo: z.literal('energia'), energia: EstadoEnergia }),
  z.object({ tipo: z.literal('cartao'), eventoId: id, cartao: Cartao }),
  z.object({ tipo: z.literal('mundo'), mundo: Mundo }),
  z.object({ tipo: z.literal('evento'), evento: EventoAgendado }),
]);

export type PersonagemResumo = z.infer<typeof PersonagemResumo>;
export type Personagem = z.infer<typeof Personagem>;
export type Relacao = z.infer<typeof Relacao>;
export type Post = z.infer<typeof Post>;
export type Enquete = z.infer<typeof Enquete>;
export type HistoriaResumo = z.infer<typeof HistoriaResumo>;
export type Delta = z.infer<typeof Delta>;
export type EstadoEnergia = z.infer<typeof EstadoEnergia>;
export type Cartao = z.infer<typeof Cartao>;
export type Consequencia = z.infer<typeof Consequencia>;
export type Conta = z.infer<typeof Conta>;
export type Mundo = z.infer<typeof Mundo>;
export type Conversa = z.infer<typeof Conversa>;
export type Mensagem = z.infer<typeof Mensagem>;
export type Alerta = z.infer<typeof Alerta>;
export type Marco = z.infer<typeof Marco>;
export type Jornada = z.infer<typeof Jornada>;
export type EventoAgendado = z.infer<typeof EventoAgendado>;
export type ResumoDia = z.infer<typeof ResumoDia>;
export type ItemRegistro = z.infer<typeof ItemRegistro>;
export type EventoTempoReal = z.infer<typeof EventoTempoReal>;
export type PedidoCriarMundo = z.infer<typeof PedidoCriarMundo>;
export type PedidoPost = z.infer<typeof PedidoPost>;
export type PedidoSilenciar = z.infer<typeof PedidoSilenciar>;
export type RespostaPrevia = z.infer<typeof RespostaPrevia>;
export type RespostaFeed = z.infer<typeof RespostaFeed>;
export type RespostaThread = z.infer<typeof RespostaThread>;
export type RespostaAcaoComPost = z.infer<typeof RespostaAcaoComPost>;
export type RespostaMensagem = z.infer<typeof RespostaMensagem>;
export type RespostaRecarga = z.infer<typeof RespostaRecarga>;
export type RespostaRelacoes = z.infer<typeof RespostaRelacoes>;
export type Erro = z.infer<typeof Erro>;
