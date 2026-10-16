import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ENERGIA, type AcaoComCusto } from './constantes';
import {
  anunciosRestantes,
  calcularEnergia,
  custoDe,
  podeGastar,
  valorRecarga,
  type Lancamento,
} from './energia';
import type { Plano } from './tipos';

const T0 = Date.UTC(2026, 9, 16, 12, 0, 0);
const MIN = 60_000;
const em = (minutos: number) => new Date(T0 + minutos * MIN);
const lanc = (minutos: number, valor: number): Lancamento => ({ valor, criadoEm: em(minutos) });

describe('calcularEnergia', () => {
  it('sem lançamentos a barra é tratada como cheia', () => {
    expect(calcularEnergia([], em(0), 'free')).toEqual({ atual: 12, max: 12, proximaEm: null });
  });

  it('conta nova começa cheia pelo lançamento inicial de +max', () => {
    expect(calcularEnergia([lanc(0, 12)], em(0), 'free')).toEqual({
      atual: 12,
      max: 12,
      proximaEm: null,
    });
  });

  it('gastar abre a recarga a partir do instante do gasto', () => {
    const livro = [lanc(0, 12), lanc(5, -1)];
    expect(calcularEnergia(livro, em(5), 'free')).toEqual({
      atual: 11,
      max: 12,
      proximaEm: em(25),
    });
    expect(calcularEnergia(livro, em(24), 'free').atual).toBe(11);
    expect(calcularEnergia(livro, em(25), 'free')).toEqual({ atual: 12, max: 12, proximaEm: null });
  });

  it('gastar de novo não zera o relógio da recarga', () => {
    const livro = [lanc(0, 12), lanc(0, -1), lanc(15, -1)];
    expect(calcularEnergia(livro, em(15), 'free')).toEqual({
      atual: 10,
      max: 12,
      proximaEm: em(20),
    });
    expect(calcularEnergia(livro, em(20), 'free')).toEqual({
      atual: 11,
      max: 12,
      proximaEm: em(40),
    });
    expect(calcularEnergia(livro, em(40), 'free').proximaEm).toBeNull();
  });

  it('recarga para no máximo, mesmo depois de muito tempo', () => {
    const livro = [lanc(0, 12), lanc(1, -12)];
    expect(calcularEnergia(livro, em(60 * 24 * 30), 'free')).toEqual({
      atual: 12,
      max: 12,
      proximaEm: null,
    });
    expect(calcularEnergia(livro, em(1 + 20 * 5), 'free').atual).toBe(5);
  });

  it('a recarga que encheu a barra antes de um gasto não acumula', () => {
    // Cheia aos 21 min; o gasto aos 100 min reabre a contagem a partir dos 100.
    const livro = [lanc(0, 12), lanc(1, -1), lanc(100, -2)];
    expect(calcularEnergia(livro, em(100), 'free')).toEqual({
      atual: 10,
      max: 12,
      proximaEm: em(120),
    });
  });

  it('saldo nunca fica negativo', () => {
    const livro = [lanc(0, 12), lanc(1, -30)];
    expect(calcularEnergia(livro, em(1), 'free').atual).toBe(0);
    expect(calcularEnergia(livro, em(21), 'free').atual).toBe(1);
  });

  it('Plus: máximo 24 e recarga a cada 10 minutos', () => {
    const livro = [lanc(0, 24), lanc(0, -3)];
    expect(calcularEnergia(livro, em(0), 'plus')).toEqual({
      atual: 21,
      max: 24,
      proximaEm: em(10),
    });
    expect(calcularEnergia(livro, em(30), 'plus').atual).toBe(24);
  });

  it('quem sai do Plus perde o excedente', () => {
    expect(calcularEnergia([lanc(0, 24)], em(0), 'free').atual).toBe(12);
  });

  it('recarga parcial (anúncio) mantém o relógio que já corria', () => {
    const livro = [lanc(0, 12), lanc(0, -5), lanc(10, 3)];
    expect(calcularEnergia(livro, em(10), 'free')).toEqual({
      atual: 10,
      max: 12,
      proximaEm: em(20),
    });
  });

  it('ignora lançamentos depois de agora e aceita a lista fora de ordem', () => {
    const livro = [lanc(30, -4), lanc(5, -1), lanc(0, 12)];
    const copia = [...livro];
    expect(calcularEnergia(livro, em(10), 'free')).toEqual({
      atual: 11,
      max: 12,
      proximaEm: em(25),
    });
    expect(livro).toEqual(copia);
  });

  const arbLivro = fc.record({
    plano: fc.constantFrom<Plano>('free', 'plus'),
    // Minutos desde T0 e valor de cada lançamento depois do inicial.
    passos: fc.array(fc.tuple(fc.integer({ min: 0, max: 600 }), fc.integer({ min: -6, max: 6 })), {
      maxLength: 40,
    }),
    depois: fc.integer({ min: 0, max: 60 * 24 * 3 }),
  });

  function montar({ plano, passos }: { plano: Plano; passos: [number, number][] }) {
    const livro = [lanc(0, ENERGIA[plano].max)];
    let minuto = 0;
    for (const [salto, valor] of passos) {
      minuto += salto;
      livro.push(lanc(minuto, valor));
    }
    return { livro, ultimo: minuto };
  }

  it('propriedade: atual em [0, max]; proximaEm é null só com a barra cheia', () => {
    fc.assert(
      fc.property(arbLivro, (caso) => {
        const { livro, ultimo } = montar(caso);
        const agora = em(ultimo + caso.depois);
        const estado = calcularEnergia(livro, agora, caso.plano);
        const { max, recargaMinutos } = ENERGIA[caso.plano];
        expect(Number.isInteger(estado.atual)).toBe(true);
        expect(estado.atual).toBeGreaterThanOrEqual(0);
        expect(estado.atual).toBeLessThanOrEqual(max);
        expect(estado.max).toBe(max);
        expect(estado.proximaEm === null).toBe(estado.atual === max);
        if (estado.proximaEm) {
          expect(estado.proximaEm.getTime()).toBeGreaterThan(agora.getTime());
          expect(estado.proximaEm.getTime()).toBeLessThanOrEqual(
            agora.getTime() + recargaMinutos * MIN,
          );
        }
      }),
    );
  });

  it('propriedade: mesma entrada, mesma saída', () => {
    fc.assert(
      fc.property(arbLivro, (caso) => {
        const { livro, ultimo } = montar(caso);
        const agora = em(ultimo + caso.depois);
        expect(calcularEnergia(livro, agora, caso.plano)).toEqual(
          calcularEnergia(
            livro.map((l) => ({ ...l, criadoEm: new Date(l.criadoEm) })),
            new Date(agora),
            caso.plano,
          ),
        );
      }),
    );
  });

  it('propriedade: sem lançamentos novos, a energia nunca cai com o tempo', () => {
    fc.assert(
      fc.property(arbLivro, fc.integer({ min: 0, max: 600 }), (caso, mais) => {
        const { livro, ultimo } = montar(caso);
        const antes = calcularEnergia(livro, em(ultimo + caso.depois), caso.plano);
        const depois = calcularEnergia(livro, em(ultimo + caso.depois + mais), caso.plano);
        expect(depois.atual).toBeGreaterThanOrEqual(antes.atual);
      }),
    );
  });
});

describe('custos e recarga', () => {
  it('custoDe reproduz a tabela', () => {
    const tabela: [AcaoComCusto, number][] = [
      ['post', 1],
      ['resposta', 1],
      ['dm', 1],
      ['historia', 1],
      ['voto', 0],
      ['curtir', 0],
      ['seguir', 0],
      ['desfazer', 2],
      ['previa', 0],
      ['discurso', 0],
    ];
    for (const [acao, custo] of tabela) expect(custoDe(acao)).toBe(custo);
  });

  it('podeGastar', () => {
    expect(podeGastar({ atual: 1 }, 1)).toBe(true);
    expect(podeGastar({ atual: 1 }, 2)).toBe(false);
    expect(podeGastar({ atual: 0 }, 0)).toBe(true);
  });

  it('gemas, debug e marco enchem; anúncio soma 3 sem passar do máximo', () => {
    const estado = { atual: 4, max: 12 };
    expect(valorRecarga('gemas', estado)).toBe(8);
    expect(valorRecarga('debug', estado)).toBe(8);
    expect(valorRecarga('marco', estado)).toBe(8);
    expect(valorRecarga('anuncio', estado)).toBe(3);
    expect(valorRecarga('anuncio', { atual: 11, max: 12 })).toBe(1);
    expect(valorRecarga('gemas', { atual: 12, max: 12 })).toBe(0);
  });

  it('propriedade: a recarga nunca leva o saldo além do máximo', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('gemas' as const, 'anuncio' as const, 'debug' as const, 'marco' as const),
        fc.constantFrom<Plano>('free', 'plus'),
        fc.integer({ min: 0, max: 24 }),
        (via, plano, atual) => {
          const max = ENERGIA[plano].max;
          const estado = { atual: Math.min(atual, max), max };
          const valor = valorRecarga(via, estado);
          expect(valor).toBeGreaterThanOrEqual(0);
          expect(estado.atual + valor).toBeLessThanOrEqual(max);
          const livro = [lanc(0, max), lanc(0, estado.atual - max), lanc(0, valor)];
          expect(calcularEnergia(livro, em(0), plano).atual).toBe(estado.atual + valor);
        },
      ),
    );
  });

  it('até 3 anúncios por dia', () => {
    expect(anunciosRestantes(0)).toBe(3);
    expect(anunciosRestantes(2)).toBe(1);
    expect(anunciosRestantes(5)).toBe(0);
    expect(anunciosRestantes(-1)).toBe(3);
  });
});
