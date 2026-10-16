import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FAMA_FIGURANTE,
  PERFIS_VINCULO,
  numerosDoJogador,
  numerosDoPersonagem,
  seguidoresParaFama,
  type TipoVinculo,
} from './elenco';
import { rotuloRelacao } from './relacoes';
import { criarRng, RNG_MAXIMO, rngFixo } from './rng';

const VINCULOS = Object.keys(PERFIS_VINCULO) as TipoVinculo[];

describe('numerosDoJogador', () => {
  it('fama ~20, carisma ~50, polêmica ~10 e 1 000 a 3 000 seguidores', () => {
    expect(numerosDoJogador(rngFixo(0))).toEqual({
      fama: 15,
      carisma: 45,
      polemica: 5,
      seguidores: 1000,
    });
    expect(numerosDoJogador(rngFixo(RNG_MAXIMO))).toEqual({
      fama: 25,
      carisma: 55,
      polemica: 15,
      seguidores: 3000,
    });
    fc.assert(
      fc.property(fc.string(), (semente) => {
        const n = numerosDoJogador(criarRng(semente));
        expect(n.seguidores).toBeGreaterThanOrEqual(1000);
        expect(n.seguidores).toBeLessThanOrEqual(3000);
        expect(Math.abs(n.fama - 20)).toBeLessThanOrEqual(5);
        expect(Math.abs(n.carisma - 50)).toBeLessThanOrEqual(5);
        expect(Math.abs(n.polemica - 10)).toBeLessThanOrEqual(5);
      }),
    );
  });
});

describe('numerosDoPersonagem', () => {
  it('afinidade inicial coerente com o vínculo', () => {
    expect(PERFIS_VINCULO.rival.afinidade).toEqual([15, 35]);
    expect(PERFIS_VINCULO.fofoca.afinidade).toEqual([15, 30]);
    expect(PERFIS_VINCULO.interesse.afinidade).toEqual([45, 59]);
    expect(PERFIS_VINCULO.amizade.afinidade).toEqual([60, 80]);
    expect(PERFIS_VINCULO.parceria.afinidade).toEqual([60, 80]);
    expect(PERFIS_VINCULO.mentor.afinidade).toEqual([70, 85]);
    const interesse = numerosDoPersonagem({
      tipoVinculo: 'interesse',
      papel: 'elenco',
      tomCaos: 50,
      rng: criarRng('x'),
    });
    expect(rotuloRelacao(interesse.afinidade, 'amizade')).toBe('Conhecidos');
  });

  it('propriedade: atributos em 0..100, afinidade na faixa e figurante com fama baixa', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VINCULOS),
        fc.constantFrom('elenco' as const, 'figurante' as const),
        fc.integer({ min: -20, max: 150 }),
        fc.string(),
        (tipoVinculo, papel, tomCaos, semente) => {
          const n = numerosDoPersonagem({ tipoVinculo, papel, tomCaos, rng: criarRng(semente) });
          const perfil = PERFIS_VINCULO[tipoVinculo];
          expect(n.afinidade).toBeGreaterThanOrEqual(perfil.afinidade[0]);
          expect(n.afinidade).toBeLessThanOrEqual(perfil.afinidade[1]);
          for (const a of [n.fama, n.carisma, n.polemica]) {
            expect(a).toBeGreaterThanOrEqual(0);
            expect(a).toBeLessThanOrEqual(100);
            expect(Number.isInteger(a)).toBe(true);
          }
          const fama = papel === 'figurante' ? FAMA_FIGURANTE : perfil.fama;
          expect(n.fama).toBeGreaterThanOrEqual(fama[0]);
          expect(n.fama).toBeLessThanOrEqual(fama[1]);
          expect(n.seguidores).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('propriedade: com o mesmo RNG, mais caos nunca dá menos polêmica', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VINCULOS),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.string(),
        (tipoVinculo, c1, c2, semente) => {
          const [baixo, alto] = c1 <= c2 ? [c1, c2] : [c2, c1];
          const calmo = numerosDoPersonagem({
            tipoVinculo,
            papel: 'elenco',
            tomCaos: baixo,
            rng: criarRng(semente),
          });
          const caos = numerosDoPersonagem({
            tipoVinculo,
            papel: 'elenco',
            tomCaos: alto,
            rng: criarRng(semente),
          });
          expect(caos.polemica).toBeGreaterThanOrEqual(calmo.polemica);
        },
      ),
    );
  });

  it('caos máximo soma até 30 de polêmica', () => {
    const entrada = { tipoVinculo: 'mentor' as const, papel: 'elenco' as const };
    const calmo = numerosDoPersonagem({ ...entrada, tomCaos: 0, rng: rngFixo(RNG_MAXIMO) });
    const caos = numerosDoPersonagem({ ...entrada, tomCaos: 100, rng: rngFixo(RNG_MAXIMO) });
    expect(calmo.polemica).toBe(20);
    expect(caos.polemica).toBe(50);
  });
});

describe('seguidoresParaFama', () => {
  it('cresce com a fama: 10^(2,8 + fama / 25), em dois significativos', () => {
    expect(seguidoresParaFama(0, rngFixo(0.5))).toBe(630);
    expect(seguidoresParaFama(50, rngFixo(0.5))).toBe(63_000);
    expect(seguidoresParaFama(100, rngFixo(0.5))).toBe(6_300_000);
  });
});
