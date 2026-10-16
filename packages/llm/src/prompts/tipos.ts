// Entradas de cada job: o que o worker junta do banco e do motor antes de chamar a IA.
// Todo número aqui sai de packages/engine; a IA só escreve texto e sugere deltas.
import type { Periodo, Tom } from '@holofote/shared';
import type { TipoVinculo } from '../schemas';

/** Personagem do mundo (elenco ou figurante), como entra no prompt. */
export interface PersonagemPrompt {
  id: string;
  nome: string;
  handle: string;
  papel: 'elenco' | 'figurante';
  /** Personalidade, jeito de escrever e o que quer (gerada pela IA no criar_mundo ou na ficha). */
  ficha: string;
}

export interface RelacaoPrompt {
  afinidade: number;
  /** Rótulo derivado da faixa pelo motor (Rival, Conhecidos, Aliança...). */
  rotulo: string;
  tipoVinculo?: TipoVinculo | null;
}

/** Personagem escolhido pelo motor para reagir, com a relação e as memórias sobre o jogador. */
export interface ReatorPrompt extends PersonagemPrompt {
  relacao?: RelacaoPrompt | null;
  /** Fatos que ele lembra do jogador (memória), já resumidos. */
  memorias?: string[];
  /** Por que o motor o escolheu: marcado, afinidade extrema, fofoca, online... */
  motivo?: string | null;
}

export interface JogadorPrompt {
  id: string;
  nome: string;
  handle: string;
  descricao?: string | null;
  fama: number;
  carisma: number;
  polemica: number;
  seguidores: number;
}

export interface PessoaCurta {
  id: string;
  nome: string;
  handle: string;
}

/** Números calculados pelo motor para a ação (o modelo só cita). */
export interface NumerosMotor {
  seguidoresGanhos?: number;
  curtidas?: number;
  deltas?: { alvo: string; valor: number }[];
  /** Qualquer outro número que valha citar ("chance de vencer": "42%"). */
  outros?: Record<string, string | number>;
}

export interface MomentoPrompt {
  dia: number;
  periodo: Periodo;
}

// ---------- jobs ----------

export interface EntradaCriarMundo {
  /** Sugestão do app ou texto livre do jogador. */
  universo: string;
  /** 0 calmo, 100 caótico. */
  tomCaos: number;
  persona: { nome: string; handle: string; descricao: string };
}

export interface EntradaFeedInicial {
  jogador: JogadorPrompt;
  personagens: PersonagemPrompt[];
  objetivoAto: string;
  marcoAtual?: string | null;
  evento?: { titulo: string; categoria: string; quando: string } | null;
  momento: MomentoPrompt;
  /** Quantos posts pedir (padrão 15). */
  quantidadePosts?: number;
}

export interface EntradaLoteDiario {
  momento: MomentoPrompt;
  resumoEstado?: string | null;
  jogador: JogadorPrompt;
  personagens: (PersonagemPrompt & { relacao?: RelacaoPrompt | null })[];
  /** O que aconteceu no dia anterior, em frases curtas (registro de eventos). */
  ontem: string[];
  /** Números do dia que o motor calculou (aparecem no resumo). */
  numerosDia: { rotulo: string; valor: string }[];
  objetivoAto?: string | null;
  evento?: { titulo: string; categoria: string; quando: string } | null;
  postsRecentes?: { id: string; autorId: string; texto: string }[];
  /** Memórias a reescrever junto do lote (personagens com 8+ eventos novos). */
  memoriasParaResumir?: ItemMemoria[];
  /** O motor decide se alguém puxa conversa hoje (Plus, marco ou evento). */
  podePuxarConversa: boolean;
  /** Quantos posts pedir (padrão 20, plano: 15 a 25). */
  quantidadePosts?: number;
}

export interface AcaoDiretor {
  /** post, comentário (resposta) ou resposta a uma história. */
  tipo: 'post' | 'resposta' | 'resposta_historia';
  texto: string;
  tom?: Tom | null;
  marcados?: PessoaCurta[];
  /** Post, comentário ou história a que o jogador respondeu. */
  emResposta?: { autor: PessoaCurta; texto: string } | null;
}

export interface EntradaDiretor {
  resumoEstado?: string | null;
  momento?: MomentoPrompt | null;
  jogador: JogadorPrompt;
  acao: AcaoDiretor;
  numeros: NumerosMotor;
  /** Até 5, escolhidos pelo motor. */
  reatores: ReatorPrompt[];
}

export interface MensagemDm {
  autor: 'jogador' | 'personagem';
  texto: string;
}

export interface EntradaDm {
  resumoEstado?: string | null;
  jogador: JogadorPrompt;
  personagem: ReatorPrompt;
  /** Resumo da conversa até aqui (vai no lugar do histórico). */
  resumoConversa?: string | null;
  /** Últimas mensagens; só as 4 mais recentes entram no prompt. */
  ultimas: MensagemDm[];
  /** A mensagem nova do jogador. */
  mensagem: string;
  /** Quando a DM nasce de uma resposta a história. */
  historia?: { texto: string } | null;
  numeros?: NumerosMotor | null;
}

export interface EntradaDiscurso {
  resumoEstado?: string | null;
  jogador: JogadorPrompt;
  evento: { tipo: 'premio' | 'show' | 'crise'; titulo: string; categoria: string };
  discurso: { opcao: 'seguro' | 'ousado' | 'especial'; titulo: string };
  /** Resultado já sorteado pelo motor. */
  resultado: { jogadorVenceu: boolean; vencedor?: PessoaCurta | null };
  numeros: NumerosMotor;
  reatores: ReatorPrompt[];
}

export interface ItemMemoria {
  personagem: PessoaCurta;
  sobre: PessoaCurta;
  fatosAtuais?: string | null;
  eventosNovos: string[];
}

export interface EntradaMemoria {
  itens: ItemMemoria[];
}

export interface EntradaFicha {
  /** Por que o personagem entra agora (ex.: marco "Primeiro show lotado" liberado). */
  motivo: string;
  vinculoDesejado?: TipoVinculo | null;
  jogador: PessoaCurta;
  existentes: { nome: string; handle: string }[];
}

export interface EntradasJobs {
  diretor: EntradaDiretor;
  dm: EntradaDm;
  discurso: EntradaDiscurso;
  criar_mundo: EntradaCriarMundo;
  feed_inicial: EntradaFeedInicial;
  lote_diario: EntradaLoteDiario;
  memoria: EntradaMemoria;
  ficha: EntradaFicha;
}
