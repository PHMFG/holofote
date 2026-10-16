import { comSinal, efeitosDosDeltas, formatarNumero, normalizar, primeiroNome } from './formatar';

describe('formatarNumero', () => {
  it('mantém números pequenos', () => {
    expect(formatarNumero(128)).toBe('128');
  });

  it('usa mil e mi como nas telas, sem arredondar para cima', () => {
    expect(formatarNumero(7_100)).toBe('7,1 mil');
    expect(formatarNumero(10_000)).toBe('10 mil');
    expect(formatarNumero(7_199)).toBe('7,1 mil');
    expect(formatarNumero(1_250_000)).toBe('1,2 mi');
  });
});

describe('comSinal', () => {
  it('usa o menos tipográfico e o sufixo colado', () => {
    expect(comSinal(6)).toBe('+6');
    expect(comSinal(-3, '%')).toBe('−3%');
    expect(comSinal(1.25)).toBe('+1,3');
    expect(comSinal(1200)).toBe('+1,2 mil');
    expect(comSinal(0, '%')).toBe('0%');
    expect(comSinal(0.04)).toBe('0');
  });
});

describe('primeiroNome e normalizar', () => {
  it('primeiro nome', () => {
    expect(primeiroNome('Lua Prado')).toBe('Lua');
    expect(primeiroNome('  Lua   Prado ')).toBe('Lua');
    expect(primeiroNome('fofocalizei')).toBe('fofocalizei');
  });

  it('normaliza acento e caixa', () => {
    expect(normalizar('JOÃO Álvaro')).toBe('joao alvaro');
  });
});

describe('efeitosDosDeltas', () => {
  const nomes = new Map([['vic', 'Vic Ferraz']]);
  const deltas = [
    { alvo: 'seguidores', valor: 214 },
    { alvo: 'relacao:vic', valor: -3 },
    { alvo: 'relacao:sumiu', valor: 2 },
    { alvo: 'polemica', valor: 6 },
    { alvo: 'carisma', valor: 0 },
    { alvo: 'fama', valor: 1.2 },
    { alvo: 'gemas', valor: 25 },
  ];

  it('vira chips com nome, sem seguidores, gemas nem zeros', () => {
    const efeitos = efeitosDosDeltas(deltas, nomes);
    expect(efeitos.map((e) => e.texto)).toEqual([
      'Vic · relação −3%',
      'Alguém · relação +2%',
      'Polêmica +6',
      'Fama +1,2',
    ]);
    expect(efeitos.map((e) => [e.tipo, e.direcao])).toEqual([
      ['relacao', 'desce'],
      ['relacao', 'sobe'],
      ['polemica', 'sobe'],
      ['atributo', 'sobe'],
    ]);
  });

  it('com a opção, escreve os seguidores', () => {
    expect(efeitosDosDeltas(deltas, nomes, { seguidores: true })[0]?.texto).toBe('Seguidores +214');
  });
});
