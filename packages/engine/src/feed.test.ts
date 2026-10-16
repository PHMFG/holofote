import { describe, expect, it } from 'vitest';
import { engajamentoDePersonagem, espalharEntregas } from './feed';
import { criarRng, rngFixo } from './rng';

describe('engajamentoDePersonagem', () => {
  it('cresce com os seguidores', () => {
    const pouco = engajamentoDePersonagem({ seguidores: 400, polemica: 10, rng: rngFixo(0.5) });
    const muito = engajamentoDePersonagem({ seguidores: 200_000, polemica: 10, rng: rngFixo(0.5) });
    expect(muito.curtidas).toBeGreaterThan(pouco.curtidas);
  });

  it('a polêmica puxa os reposts e nada fica negativo', () => {
    const calmo = engajamentoDePersonagem({ seguidores: 50_000, polemica: 0, rng: rngFixo(0.9) });
    const quente = engajamentoDePersonagem({
      seguidores: 50_000,
      polemica: 100,
      rng: rngFixo(0.9),
    });
    expect(quente.reposts).toBeGreaterThan(calmo.reposts);
    expect(calmo.curtidas).toBeGreaterThanOrEqual(0);
    expect(calmo.reposts).toBeGreaterThanOrEqual(0);
  });

  it('é determinístico com a mesma semente', () => {
    const a = engajamentoDePersonagem({ seguidores: 9_000, polemica: 30, rng: criarRng('x') });
    const b = engajamentoDePersonagem({ seguidores: 9_000, polemica: 30, rng: criarRng('x') });
    expect(a).toEqual(b);
  });
});

describe('espalharEntregas', () => {
  const inicio = new Date('2026-10-16T12:00:00Z');

  it('devolve instantes crescentes dentro da janela', () => {
    const datas = espalharEntregas(inicio, 60 * 60_000, 6, criarRng('feed'));
    expect(datas).toHaveLength(6);
    for (let i = 1; i < datas.length; i++) {
      expect(datas[i]!.getTime()).toBeGreaterThan(datas[i - 1]!.getTime());
    }
    expect(datas[0]!.getTime()).toBeGreaterThanOrEqual(inicio.getTime());
    expect(datas.at(-1)!.getTime()).toBeLessThanOrEqual(inicio.getTime() + 60 * 60_000);
  });

  it('sem quantidade não devolve nada', () => {
    expect(espalharEntregas(inicio, 1000, 0, rngFixo(0.5))).toEqual([]);
  });
});
