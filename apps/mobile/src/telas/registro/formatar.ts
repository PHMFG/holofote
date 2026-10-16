import type { Delta } from '@holofote/shared';
import { comSinal, primeiroNome } from '../../formatar';

/** Handle sempre com arroba (o servidor aceita os dois na criação). */
export const comArroba = (handle: string) => (handle.startsWith('@') ? handle : `@${handle}`);

const ATRIBUTOS: Record<string, string> = {
  fama: 'fama',
  carisma: 'carisma',
  polemica: 'polêmica',
};

// Seguidores primeiro, depois atributos e relações, como no cartão de 09 (27:474).
const ORDEM = (alvo: string) =>
  alvo === 'seguidores' ? 0 : alvo in ATRIBUTOS ? 1 : alvo.startsWith('relacao:') ? 2 : 3;

export interface DeltaFormatado {
  chave: string;
  /** Texto do chip: "+214 seguidores", "+3 fama", "−2 Vic". */
  texto: string;
  /** Lido pelo VoiceOver: "relação com Vic −2". */
  rotulo: string;
  positivo: boolean;
}

/** Deltas do motor em chips legíveis; zeros e alvos desconhecidos ficam de fora. */
export function formatarDeltas(
  deltas: readonly Delta[],
  nomePorId: ReadonlyMap<string, string>,
): DeltaFormatado[] {
  const formatados: DeltaFormatado[] = [];
  for (const { alvo, valor } of [...deltas].sort((a, b) => ORDEM(a.alvo) - ORDEM(b.alvo))) {
    if (valor === 0) continue;
    const positivo = valor > 0;
    if (alvo === 'seguidores') {
      const texto = `${comSinal(valor)} ${Math.abs(valor) === 1 ? 'seguidor' : 'seguidores'}`;
      formatados.push({ chave: alvo, texto, rotulo: texto, positivo });
    } else if (alvo.startsWith('relacao:')) {
      const nome = nomePorId.get(alvo.slice('relacao:'.length));
      const quem = nome ? primeiroNome(nome) : 'alguém';
      formatados.push({
        chave: alvo,
        texto: `${comSinal(valor)} ${quem}`,
        rotulo: `relação com ${quem} ${comSinal(valor)}`,
        positivo,
      });
    } else if (ATRIBUTOS[alvo]) {
      const texto = `${comSinal(valor)} ${ATRIBUTOS[alvo]}`;
      formatados.push({ chave: alvo, texto, rotulo: texto, positivo });
    }
  }
  return formatados;
}
