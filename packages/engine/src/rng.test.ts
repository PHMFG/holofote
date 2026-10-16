import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EXTREMOS_PREVIA,
  RNG_MAXIMO,
  criarRng,
  cyrb53,
  entre,
  escolherPonderado,
  inteiroEntre,
  rngFixo,
  sortearSemRepeticao,
} from './rng';

describe('cyrb53', () => {
  it('bate com a implementação de referência', () => {
    expect(cyrb53('a')).toBe(7929297801672961);
    expect(cyrb53('b')).toBe(8684336938537663);
    expect(cyrb53('')).toBe(3338908027751811);
  });

  it('a semente muda o hash', () => {
    expect(cyrb53('a', 1)).not.toBe(cyrb53('a'));
  });
});

describe('criarRng', () => {
  it('é reproduzível: a sequência de uma semente fica congelada', () => {
    const rng = criarRng('evento-1');
    expect([rng(), rng(), rng()]).toEqual([
      0.9934507424477488, 0.7214484489522874, 0.8599174956325442,
    ]);
  });

  it('mesma semente, mesma sequência; sempre em [0, 1)', () => {
    fc.assert(
      fc.property(fc.string(), (semente) => {
        const a = criarRng(semente);
        const b = criarRng(semente);
        for (let i = 0; i < 50; i++) {
          const x = a();
          expect(x).toBe(b());
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(1);
          expect(x).toBeLessThanOrEqual(RNG_MAXIMO);
        }
      }),
    );
  });

  it('sementes diferentes dão sequências diferentes', () => {
    expect(criarRng('evento-1')()).not.toBe(criarRng('evento-2')());
  });

  it('distribui de forma razoável', () => {
    const rng = criarRng('distribuicao');
    let soma = 0;
    for (let i = 0; i < 10_000; i++) soma += rng();
    expect(soma / 10_000).toBeGreaterThan(0.48);
    expect(soma / 10_000).toBeLessThan(0.52);
  });
});

describe('rngFixo', () => {
  it('devolve sempre o mesmo valor, limitado a [0, RNG_MAXIMO]', () => {
    const rng = rngFixo(0.3);
    expect([rng(), rng()]).toEqual([0.3, 0.3]);
    expect(rngFixo(-1)()).toBe(0);
    expect(rngFixo(1)()).toBe(RNG_MAXIMO);
    expect(rngFixo(0.999999)()).toBe(0.999999);
    expect(rngFixo(Number.NaN)()).toBe(0);
  });

  it('os extremos da prévia são 0 e o teto real do gerador', () => {
    expect(EXTREMOS_PREVIA).toEqual([0, RNG_MAXIMO]);
    expect(RNG_MAXIMO).toBeGreaterThan(0.999999);
    expect(RNG_MAXIMO).toBeLessThan(1);
  });
});

describe('inteiroEntre', () => {
  it('é inclusivo nos dois extremos', () => {
    expect(inteiroEntre(rngFixo(0), 3, 7)).toBe(3);
    expect(inteiroEntre(rngFixo(RNG_MAXIMO), 3, 7)).toBe(7);
    expect(inteiroEntre(rngFixo(0.999999), -5, -2)).toBe(-2);
  });

  it('aceita os limites invertidos', () => {
    expect(inteiroEntre(rngFixo(0), 7, 3)).toBe(3);
  });

  it('fica sempre dentro da faixa', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: -1000, max: 1000 }),
        fc.integer({ min: 0, max: 1000 }),
        (semente, min, largura) => {
          const valor = inteiroEntre(criarRng(semente), min, min + largura);
          expect(Number.isInteger(valor)).toBe(true);
          expect(valor).toBeGreaterThanOrEqual(min);
          expect(valor).toBeLessThanOrEqual(min + largura);
        },
      ),
    );
  });
});

describe('entre', () => {
  it('vai de min (inclusivo) a max (exclusivo)', () => {
    expect(entre(rngFixo(0), 0.85, 1.15)).toBe(0.85);
    expect(entre(rngFixo(0.5), 0, 10)).toBe(5);
    expect(entre(rngFixo(RNG_MAXIMO), 0, 10)).toBeLessThan(10);
  });
});

describe('escolherPonderado', () => {
  const itens = [
    { id: 'a', peso: 1 },
    { id: 'b', peso: 0 },
    { id: 'c', peso: 3 },
  ];

  it('escolhe pela soma acumulada dos pesos', () => {
    expect(escolherPonderado(rngFixo(0), itens).id).toBe('a');
    expect(escolherPonderado(rngFixo(0.24), itens).id).toBe('a');
    expect(escolherPonderado(rngFixo(0.25), itens).id).toBe('c');
    expect(escolherPonderado(rngFixo(RNG_MAXIMO), itens).id).toBe('c');
  });

  it('nunca escolhe peso zero ou negativo quando há peso positivo', () => {
    const comNegativo = [{ id: 'x', peso: -5 }, ...itens];
    fc.assert(
      fc.property(fc.string(), (semente) => {
        const id = escolherPonderado(criarRng(semente), comNegativo).id;
        expect(['a', 'c']).toContain(id);
      }),
    );
  });

  it('sem nenhum peso positivo, escolhe com chance igual', () => {
    const nulos = [
      { id: 'a', peso: 0 },
      { id: 'b', peso: 0 },
    ];
    expect(escolherPonderado(rngFixo(0), nulos).id).toBe('a');
    expect(escolherPonderado(rngFixo(RNG_MAXIMO), nulos).id).toBe('b');
  });

  it('com um RNG fora do contrato (1) cai no último item com peso', () => {
    expect(escolherPonderado(() => 1, itens).id).toBe('c');
  });

  it('lista vazia é erro', () => {
    expect(() => escolherPonderado(rngFixo(0), [])).toThrow('lista vazia');
  });

  it('respeita as proporções', () => {
    const rng = criarRng('ponderado');
    let c = 0;
    for (let i = 0; i < 4000; i++) if (escolherPonderado(rng, itens).id === 'c') c++;
    expect(c / 4000).toBeGreaterThan(0.72);
    expect(c / 4000).toBeLessThan(0.78);
  });
});

describe('sortearSemRepeticao', () => {
  it('devolve no máximo a quantidade pedida, sem repetir e sem mexer na entrada', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.uniqueArray(fc.integer(), { maxLength: 20 }),
        fc.integer({ min: -2, max: 25 }),
        (semente, itens, quantidade) => {
          const copia = [...itens];
          const sorteados = sortearSemRepeticao(criarRng(semente), itens, quantidade);
          expect(itens).toEqual(copia);
          expect(sorteados.length).toBe(Math.max(0, Math.min(quantidade, itens.length)));
          expect(new Set(sorteados).size).toBe(sorteados.length);
          for (const s of sorteados) expect(itens).toContain(s);
        },
      ),
    );
  });
});
