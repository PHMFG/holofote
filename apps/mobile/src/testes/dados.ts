// Dados de exemplo para testes de tela, no formato dos contratos (packages/shared).
import type {
  Conta,
  EstadoEnergia,
  Mundo,
  Personagem,
  PersonagemResumo,
  Post,
} from '@holofote/shared';

let contador = 0;
/** UUID v4 válido e determinístico para testes. */
export const uuid = () => `00000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`;

export const personagem = (p: Partial<PersonagemResumo> = {}): PersonagemResumo => ({
  id: uuid(),
  nome: 'Vic Ferraz',
  handle: '@vicferraz',
  iniciais: 'VF',
  tomAvatar: 'claro',
  verificado: true,
  papel: 'elenco',
  ...p,
});

export const jogador = (p: Partial<Personagem> = {}): Personagem => ({
  ...personagem({
    nome: 'Lua Prado',
    handle: '@luaprado',
    iniciais: 'LP',
    tomAvatar: 'escuro',
    papel: 'jogador',
  }),
  ficha: 'cantora em ascensão',
  fama: 20,
  carisma: 50,
  polemica: 10,
  seguidores: 7100,
  relacao: null,
  lembra: [],
  silenciado: false,
  ...p,
});

export const post = (p: Partial<Post> = {}): Post => ({
  id: uuid(),
  autor: personagem(),
  texto: 'primeiro ensaio da turnê',
  tipo: 'post',
  tom: null,
  respondeA: null,
  marcados: [],
  curtidas: 128,
  reposts: 4,
  respostas: 12,
  curtidoPorMim: false,
  criadoEm: '2026-10-16T12:00:00Z',
  enquete: null,
  expiraEm: null,
  ...p,
});

export const mundo = (p: Partial<Mundo> = {}): Mundo => ({
  id: uuid(),
  universo: 'Pop Brasil',
  tomCaos: 70,
  dia: 6,
  periodo: 'noite',
  ato: 1,
  objetivoAto: 'Dominar o pop nacional',
  estado: 'pronto',
  jogador: jogador(),
  agora: new Date().toISOString(),
  ...p,
});

export const REGRAS_FREE = {
  recargaMin: 20,
  gemasParaEncher: 10,
  anuncioEnergia: 3,
  anunciosPorDia: 3,
};
export const REGRAS_PLUS = {
  recargaMin: 10,
  gemasParaEncher: 10,
  anuncioEnergia: 3,
  anunciosPorDia: 0,
};

export const energia = (atual = 8, max = 12, plano: 'free' | 'plus' = 'free'): EstadoEnergia => ({
  atual,
  max,
  proximaEm: atual < max ? '2026-10-16T12:20:00Z' : null,
  plano,
  regras: plano === 'plus' ? REGRAS_PLUS : REGRAS_FREE,
});

export const conta = (p: Partial<Conta> = {}): Conta => ({
  usuarioId: uuid(),
  plano: 'free',
  gemas: 40,
  energia: energia(),
  aparencia: { tema: 'sistema', destaque: 'laranja' },
  mundoId: uuid(),
  anunciosRestantesHoje: 3,
  ...p,
});
