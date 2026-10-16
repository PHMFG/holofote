// Números iniciais de um mundo novo. Nome, ficha e aparência do elenco vêm da IA; daqui saem só
// atributos, seguidores e a afinidade inicial com o jogador.
import { limitarAtributo } from './atributos';
import { arredondarSignificativo } from './marcos';
import { entre, inteiroEntre } from './rng';
import type { Faixa, PapelPersonagem, Rng } from './tipos';

export type TipoVinculo = 'rival' | 'amizade' | 'parceria' | 'mentor' | 'interesse' | 'fofoca';

export interface NumerosIniciais {
  fama: number;
  carisma: number;
  polemica: number;
  seguidores: number;
}

export interface NumerosPersonagem extends NumerosIniciais {
  /** Afinidade inicial com o jogador. */
  afinidade: number;
}

/**
 * Faixas por vínculo (inteiros, inclusivo). Afinidade: rival 15–35, fofoca 15–30, interesse
 * 45–59 (conhecidos), amizade e parceria 60–80, mentor 70–85.
 */
export const PERFIS_VINCULO: Readonly<
  Record<TipoVinculo, { afinidade: Faixa; fama: Faixa; carisma: Faixa; polemica: Faixa }>
> = {
  rival: { afinidade: [15, 35], fama: [35, 70], carisma: [40, 70], polemica: [25, 50] },
  fofoca: { afinidade: [15, 30], fama: [25, 55], carisma: [35, 60], polemica: [35, 60] },
  interesse: { afinidade: [45, 59], fama: [25, 60], carisma: [55, 85], polemica: [10, 35] },
  amizade: { afinidade: [60, 80], fama: [15, 45], carisma: [50, 75], polemica: [5, 25] },
  parceria: { afinidade: [60, 80], fama: [25, 55], carisma: [45, 70], polemica: [10, 30] },
  mentor: { afinidade: [70, 85], fama: [60, 90], carisma: [55, 80], polemica: [5, 20] },
};

/** Figurantes (fãs, críticos, jornalistas) têm fama baixa qualquer que seja o vínculo. */
export const FAMA_FIGURANTE: Faixa = [5, 30];

/** Quanto o tom de caos (0 a 100) pode somar à polêmica: até +30 no caos máximo. */
export const EMPURRAO_CAOS = 0.3;

function sortear(rng: Rng, faixa: Faixa): number {
  return inteiroEntre(rng, faixa[0], faixa[1]);
}

/** Seguidores coerentes com a fama: 10^(2,8 + fama / 25) com ±30 %, em dois significativos. */
export function seguidoresParaFama(fama: number, rng: Rng): number {
  return arredondarSignificativo(10 ** (2.8 + limitarAtributo(fama) / 25) * entre(rng, 0.7, 1.3));
}

/** Jogador recém-criado: fama ~20, carisma ~50, polêmica ~10 e 1 000 a 3 000 seguidores. */
export function numerosDoJogador(rng: Rng): NumerosIniciais {
  return {
    fama: inteiroEntre(rng, 15, 25),
    carisma: inteiroEntre(rng, 45, 55),
    polemica: inteiroEntre(rng, 5, 15),
    seguidores: Math.round(inteiroEntre(rng, 1000, 3000) / 10) * 10,
  };
}

export interface EntradaPersonagem {
  tipoVinculo: TipoVinculo;
  papel: PapelPersonagem;
  /** Tom de caos do mundo, de 0 a 100: puxa a polêmica para cima. */
  tomCaos: number;
  rng: Rng;
}

/**
 * Personagem novo. Ordem dos sorteios: afinidade, fama, carisma, polêmica, empurrão do caos,
 * seguidores. Com o mesmo RNG, mais caos nunca dá menos polêmica.
 */
export function numerosDoPersonagem(entrada: EntradaPersonagem): NumerosPersonagem {
  const perfil = PERFIS_VINCULO[entrada.tipoVinculo];
  const { rng } = entrada;
  const afinidade = sortear(rng, perfil.afinidade);
  const fama = sortear(rng, entrada.papel === 'figurante' ? FAMA_FIGURANTE : perfil.fama);
  const carisma = sortear(rng, perfil.carisma);
  const caos = Math.min(100, Math.max(0, entrada.tomCaos));
  const polemica = limitarAtributo(
    sortear(rng, perfil.polemica) + caos * EMPURRAO_CAOS * entre(rng, 0.6, 1),
  );
  const seguidores = seguidoresParaFama(fama, rng);
  return { fama, carisma, polemica, seguidores, afinidade };
}
