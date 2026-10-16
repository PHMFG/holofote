import type { Delta } from '@holofote/shared';

/** Números do jogo no estilo das telas: 128, 7,1 mil, 1,2 mi. */
export function formatarNumero(n: number): string {
  const absoluto = Math.abs(n);
  const curto = (valor: number, sufixo: string) =>
    `${(Math.trunc(valor * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${sufixo}`;
  if (absoluto >= 1_000_000) return curto(n / 1_000_000, 'mi');
  if (absoluto >= 1_000) return curto(n / 1_000, 'mil');
  return String(n);
}

/** Sinal de menos tipográfico, como nas telas do Figma ("relação −3%"). */
const MENOS = '−';

/** "+6", "−3", "+1,2", "+1,2 mil"; o sufixo vai colado ("−3%") e zero sai sem sinal. */
export function comSinal(valor: number, sufixo = ''): string {
  const absoluto = Math.abs(valor);
  const texto =
    absoluto >= 1000
      ? formatarNumero(absoluto)
      : absoluto.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (texto === '0') return `0${sufixo}`;
  return `${valor > 0 ? '+' : MENOS}${texto}${sufixo}`;
}

/** Primeiro nome ("Lua Prado" vira "Lua"); sem espaço, o próprio texto. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || nome;
}

/** Compara nomes sem acento nem caixa (busca no elenco). */
export const normalizar = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export type DirecaoEfeito = 'sobe' | 'desce';

export interface EfeitoFormatado {
  chave: string;
  texto: string;
  /** Polêmica tem ícone próprio (chama); o resto usa a tendência. */
  tipo: 'atributo' | 'polemica' | 'relacao';
  direcao: DirecaoEfeito;
}

const NOME_ATRIBUTO: Record<string, string> = {
  fama: 'Fama',
  carisma: 'Carisma',
  polemica: 'Polêmica',
};

/**
 * Deltas do motor em chips legíveis (Figma 17:218): "Polêmica +6", "Vic · relação −3%".
 * Deltas nulos e alvos desconhecidos (ex.: gemas) não aparecem. Seguidores ficam de fora por
 * padrão (vão no número grande do cartão); `seguidores: true` os escreve como "Seguidores +214".
 */
export function efeitosDosDeltas(
  deltas: readonly Delta[],
  nomePorId: ReadonlyMap<string, string>,
  { seguidores = false }: { seguidores?: boolean } = {},
): EfeitoFormatado[] {
  const efeitos: EfeitoFormatado[] = [];
  for (const { alvo, valor } of deltas) {
    if (valor === 0) continue;
    const direcao: DirecaoEfeito = valor > 0 ? 'sobe' : 'desce';
    if (alvo.startsWith('relacao:')) {
      const nome = nomePorId.get(alvo.slice('relacao:'.length));
      efeitos.push({
        chave: alvo,
        texto: `${nome ? primeiroNome(nome) : 'Alguém'} · relação ${comSinal(valor, '%')}`,
        tipo: 'relacao',
        direcao,
      });
      continue;
    }
    if (alvo === 'seguidores') {
      if (seguidores)
        efeitos.push({
          chave: alvo,
          texto: `Seguidores ${comSinal(valor)}`,
          tipo: 'atributo',
          direcao,
        });
      continue;
    }
    const nome = NOME_ATRIBUTO[alvo];
    if (!nome) continue;
    efeitos.push({
      chave: alvo,
      texto: `${nome} ${comSinal(valor)}`,
      tipo: alvo === 'polemica' ? 'polemica' : 'atributo',
      direcao,
    });
  }
  return efeitos;
}
