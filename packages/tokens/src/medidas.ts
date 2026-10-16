// Medidas fixas do sistema Cromo (docs/PLANO.md, seção "Gradientes" e medidas).
// O Figma não tem variáveis de espaçamento; estes números vêm do plano e dos frames.
export const medidas = {
  margemLateral: 16,
  cartaoRaio: 24,
  cartaoPadding: 16,
  botaoSuave: 40,
  botaoMetalAltura: 58,
  avatar: 40,
} as const;

/**
 * Escurecer atrás de folhas e modais. No Figma (19 · Sem energia) é rgba(0,0,0,0.42) sem
 * variável, igual nos dois modos; fica aqui para nenhuma tela escrever a cor à mão.
 */
export const ESCURECER = 'rgba(0,0,0,0.42)';

/** Limite de aumento do Dynamic Type em qualquer texto do app. */
export const MAX_ESCALA_FONTE = 1.3;
