import { describe, expect, it } from 'vitest';
import { ajustarCanais } from './diretor';

const reacao = (personagemId: string, tipo: 'resposta' | 'citacao' | 'dm') => ({
  personagemId,
  tipo,
  texto: 'oi',
  atrasoSeg: 30,
});

describe('ajustarCanais', () => {
  it('numa resposta a comentário, nenhuma reação vai para a DM', () => {
    const saida = ajustarCanais([reacao('a', 'dm'), reacao('b', 'resposta')], 'resposta', true);
    expect(saida.map((r) => r.tipo)).toEqual(['resposta', 'resposta']);
  });

  it('num post, só a primeira DM fica; as outras viram resposta', () => {
    const saida = ajustarCanais(
      [reacao('a', 'dm'), reacao('b', 'dm'), reacao('c', 'citacao')],
      'post',
      true,
    );
    expect(saida.map((r) => r.tipo)).toEqual(['dm', 'resposta', 'citacao']);
  });

  it('sem post do jogador (campanha), a DM extra vira citação', () => {
    const saida = ajustarCanais([reacao('a', 'dm'), reacao('b', 'dm')], 'post', false);
    expect(saida.map((r) => r.tipo)).toEqual(['dm', 'citacao']);
  });
});
