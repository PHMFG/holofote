import { faixaComSinal, faixaQuantidade, rotuloSeguidores } from './formatar';

describe('formatação das consequências e da prévia', () => {
  it('faixas do motor', () => {
    expect(faixaComSinal([4, 8])).toBe('+4 a +8');
    expect(faixaComSinal([-5, -2], '%')).toBe('−5 a −2%');
    expect(faixaComSinal([3, 3])).toBe('+3');
    expect(faixaQuantidade([2100, 3400])).toBe('2,1 mil a 3,4 mil');
  });

  it('seguidores no singular e no plural', () => {
    expect(rotuloSeguidores(214)).toBe('+214 seguidores');
    expect(rotuloSeguidores(-1)).toBe('−1 seguidor');
    expect(rotuloSeguidores(0)).toBe('0 seguidores');
  });
});
