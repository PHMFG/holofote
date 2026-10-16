import { PedidoCriarMundo } from '@holofote/shared';

/** Sugestões de universo da tela 01; "Criar do zero" abre o texto livre. */
export const UNIVERSOS = [
  'Pop Brasil',
  'Reality show',
  'Faculdade de magia',
  'Startup caótica',
  'Time de vôlei',
] as const;

export interface FormMundo {
  nome: string;
  handle: string;
  descricao: string;
  /** Sugestão escolhida (ignorada quando `livre`). */
  universo: string;
  /** "Criar do zero": o universo vem de `universoLivre`. */
  livre: boolean;
  universoLivre: string;
  /** 0 acolhedor, 100 caótico. */
  tomCaos: number;
}

export const FORM_INICIAL: FormMundo = {
  nome: '',
  handle: '',
  descricao: '',
  universo: UNIVERSOS[0],
  livre: false,
  universoLivre: '',
  tomCaos: 70,
};

/** "@luaprado" a partir do que foi digitado, com ou sem arroba e espaços. */
export function normalizarHandle(digitado: string): string {
  const limpo = digitado.trim().replace(/^@+/, '').replace(/\s+/g, '').toLowerCase();
  return limpo ? `@${limpo}` : '';
}

/**
 * Por que a arroba digitada não vale (o schema de packages/shared aceita 2 a 24 caracteres entre
 * letras, números, ponto e sublinhado); null quando está vazia ou válida.
 */
export function erroDoHandle(digitado: string): string | null {
  const corpo = normalizarHandle(digitado).slice(1);
  if (!corpo) return null;
  if (!/^[a-z0-9_.]+$/.test(corpo)) return 'Use só letras, números, ponto e sublinhado na arroba.';
  if (corpo.length < 2 || corpo.length > 24) return 'A arroba precisa ter de 2 a 24 caracteres.';
  return null;
}

/** Iniciais da persona para o avatar: primeira letra das duas primeiras palavras. */
export function iniciaisDe(nome: string): string {
  const letras = nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0] ?? '');
  return letras.join('').toUpperCase();
}

export function universoEscolhido(form: FormMundo): string {
  return (form.livre ? form.universoLivre : form.universo).trim();
}

/**
 * Pedido de POST /mundos validado pelo mesmo schema do servidor (packages/shared); null enquanto
 * algum campo não passa. O consentimento já foi dado no passo 1.
 */
export function montarPedido(form: FormMundo): PedidoCriarMundo | null {
  const resultado = PedidoCriarMundo.safeParse({
    universo: universoEscolhido(form),
    tomCaos: Math.round(form.tomCaos),
    persona: {
      nome: form.nome.trim(),
      handle: normalizarHandle(form.handle),
      descricao: form.descricao.trim(),
    },
    consentimentoIA: true,
  });
  return resultado.success ? resultado.data : null;
}
