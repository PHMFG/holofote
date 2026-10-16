// Tipos de domínio do motor. Espelham os nomes de @holofote/shared (contratos.ts) sem depender
// dele em tempo de execução: o motor é puro e não carrega zod.

/** Gerador de números em [0, 1). Entra sempre por parâmetro; o motor nunca usa Math.random. */
export type Rng = () => number;

export type Plano = 'free' | 'plus';

export type Tom = 'fofo' | 'sincero' | 'misterioso' | 'provocativo';

export type Periodo = 'manha' | 'tarde' | 'noite';

export type PapelPersonagem = 'elenco' | 'figurante';

/** Atributos de 0 a 100 de qualquer personagem, inclusive o jogador. */
export type Atributo = 'fama' | 'carisma' | 'polemica';

/** Alvo de um delta, nas mesmas strings do contrato: atributo, seguidores ou relação. */
export type AlvoDelta = Atributo | 'seguidores' | `relacao:${string}`;

export interface Delta {
  alvo: AlvoDelta;
  valor: number;
}

/** Faixa fechada [mínimo, máximo]. */
export type Faixa = readonly [number, number];
