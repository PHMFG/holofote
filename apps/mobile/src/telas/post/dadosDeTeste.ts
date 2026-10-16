// Dados de exemplo das telas 03 e 12 para os testes (complementa src/testes/dados.ts).
import type { Consequencia, RespostaRelacoes } from '@holofote/shared';
import { energia, personagem, uuid } from '../../testes/dados';

export const consequencia = (p: Partial<Consequencia> = {}): Consequencia => ({
  eventoId: uuid(),
  deltas: [],
  seguidoresGanhos: 214,
  curtidasSimuladas: 486,
  cartao: null,
  reacoesPendentes: 2,
  energia: energia(7, 12),
  marcoLiberado: null,
  desfazivelAte: new Date(Date.now() + 30 * 60_000).toISOString(),
  ...p,
});

/** Relações com quatro personagens do elenco e um figurante. */
export function relacoes(): RespostaRelacoes {
  const no = (
    nome: string,
    handle: string,
    iniciais: string,
    rotulo: string,
    papel = 'elenco',
  ) => ({
    personagem: personagem({ nome, handle, iniciais, papel: papel as 'elenco' | 'figurante' }),
    relacao: { afinidade: 50, rotulo },
    lembra: [],
  });
  return {
    jogador: personagem({ nome: 'Lua Prado', handle: '@luaprado', papel: 'jogador' }),
    nos: [
      no('Vic Ferraz', '@vicferraz', 'VF', 'Rival'),
      no('Duda Marques', '@dudamarques', 'DM', 'Amizade'),
      no('Bento Lima', '@bentolima', 'BL', 'Parceria'),
      no('Nina Alves', '@ninaalves', 'NA', 'Conhecidos'),
      no('fofocalizei', '@fofocalizei', 'FO', 'Conhecidos', 'figurante'),
    ],
  };
}
