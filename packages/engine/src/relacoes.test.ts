import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  alvoRelacao,
  aplicarDeltaRelacao,
  idDoAlvoRelacao,
  limitarDeltaRelacao,
  rotuloRelacao,
} from './relacoes';

describe('rotuloRelacao', () => {
  it('reproduz as faixas do plano nas bordas', () => {
    const casos: [number, string][] = [
      [0, 'Rival'],
      [24, 'Rival'],
      [25, 'Rivais com respeito'],
      [44, 'Rivais com respeito'],
      [45, 'Conhecidos'],
      [59, 'Conhecidos'],
      [60, 'Amizade'],
      [79, 'Amizade'],
      [80, 'Aliança'],
      [100, 'Aliança'],
    ];
    for (const [afinidade, rotulo] of casos) {
      expect(rotuloRelacao(afinidade, 'amizade')).toBe(rotulo);
    }
  });

  it('60–79 vira Parceria pelo tipo de vínculo', () => {
    expect(rotuloRelacao(60, 'parceria')).toBe('Parceria');
    expect(rotuloRelacao(79, 'parceria')).toBe('Parceria');
    expect(rotuloRelacao(80, 'parceria')).toBe('Aliança');
    expect(rotuloRelacao(59, 'parceria')).toBe('Conhecidos');
  });

  it('valores fora de 0..100 caem nas pontas', () => {
    expect(rotuloRelacao(-10, 'amizade')).toBe('Rival');
    expect(rotuloRelacao(150, 'amizade')).toBe('Aliança');
    expect(rotuloRelacao(24.9, 'amizade')).toBe('Rival');
  });

  it('sempre devolve um dos seis rótulos', () => {
    const rotulos = [
      'Rival',
      'Rivais com respeito',
      'Conhecidos',
      'Amizade',
      'Parceria',
      'Aliança',
    ];
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 150, noNaN: true }),
        fc.constantFrom('amizade' as const, 'parceria' as const),
        (afinidade, tipo) => {
          expect(rotulos).toContain(rotuloRelacao(afinidade, tipo));
        },
      ),
    );
  });
});

describe('limites de delta', () => {
  it('±8 por ação e ±12 em evento', () => {
    expect(limitarDeltaRelacao(20, 'acao')).toBe(8);
    expect(limitarDeltaRelacao(-20, 'acao')).toBe(-8);
    expect(limitarDeltaRelacao(20, 'evento')).toBe(12);
    expect(limitarDeltaRelacao(-20, 'evento')).toBe(-12);
    expect(limitarDeltaRelacao(3.6, 'acao')).toBe(4);
  });

  it('o delta limitado sempre cabe no teto do contexto', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        fc.constantFrom('acao' as const, 'evento' as const),
        (valor, contexto) => {
          const teto = contexto === 'acao' ? 8 : 12;
          const limitado = limitarDeltaRelacao(valor, contexto);
          expect(Math.abs(limitado)).toBeLessThanOrEqual(teto);
          expect(Number.isInteger(limitado)).toBe(true);
        },
      ),
    );
  });

  it('aplicar mantém a afinidade em 0..100', () => {
    expect(aplicarDeltaRelacao(95, 8)).toBe(100);
    expect(aplicarDeltaRelacao(3, -8)).toBe(0);
    expect(aplicarDeltaRelacao(50, -4)).toBe(46);
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), fc.integer({ min: -50, max: 50 }), (a, d) => {
        const nova = aplicarDeltaRelacao(a, d);
        expect(nova).toBeGreaterThanOrEqual(0);
        expect(nova).toBeLessThanOrEqual(100);
      }),
    );
  });
});

describe('alvo de relação', () => {
  it('usa a string do contrato', () => {
    expect(alvoRelacao('abc')).toBe('relacao:abc');
    expect(idDoAlvoRelacao('relacao:abc')).toBe('abc');
    expect(idDoAlvoRelacao('fama')).toBeNull();
  });
});
