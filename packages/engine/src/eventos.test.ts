import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  CATALOGO_CAMPANHA,
  PESO_MINIMO_INDICADO,
  acaoDeCampanha,
  baseIndicado,
  bonusDaCampanha,
  chancesIndicados,
  custoDaCampanha,
  efeitosDiscurso,
  ensaiou,
  opcoesDiscurso,
  sortearVencedor,
} from './eventos';
import { criarRng, RNG_MAXIMO, rngFixo } from './rng';

describe('catálogo de campanha', () => {
  it('quatro ações, custo 1 ou 2, ids únicos; só as que geram post custam 2', () => {
    expect(CATALOGO_CAMPANHA).toHaveLength(4);
    expect(new Set(CATALOGO_CAMPANHA.map((a) => a.id)).size).toBe(4);
    for (const acao of CATALOGO_CAMPANHA) {
      expect([1, 2]).toContain(acao.custo);
      expect(acao.geraPost).toBe(acao.custo === 2);
    }
    expect(acaoDeCampanha('ensaiar')?.efeito).toEqual({ tipo: 'liberaOusado' });
  });

  it('custo, bônus e ensaio a partir das ações feitas', () => {
    expect(custoDaCampanha('ensaiar')).toBe(1);
    expect(custoDaCampanha('entrevista')).toBe(2);
    expect(custoDaCampanha('nao_existe')).toBeNull();
    expect(bonusDaCampanha([])).toBe(0);
    expect(bonusDaCampanha(['ensaiar', 'pedir_votos', 'pedir_votos', 'bastidores', 'xyz'])).toBe(
      16,
    );
    expect(bonusDaCampanha(CATALOGO_CAMPANHA.map((a) => a.id))).toBe(28);
    expect(ensaiou(['pedir_votos'])).toBe(false);
    expect(ensaiou(['pedir_votos', 'ensaiar'])).toBe(true);
  });
});

describe('chances dos indicados', () => {
  it('base: fama; jogador: média de fama e carisma', () => {
    expect(baseIndicado({ fama: 60, carisma: 10 }, false)).toBe(60);
    expect(baseIndicado({ fama: 20, carisma: 50 }, true)).toBe(35);
  });

  it('normaliza com o bônus do jogador e piso de 1', () => {
    const chances = chancesIndicados(
      [
        { id: 'eu', base: 35 },
        { id: 'vic', base: 60 },
        { id: 'zero', base: 0 },
      ],
      15,
      'eu',
    );
    expect(chances.map((c) => c.id)).toEqual(['eu', 'vic', 'zero']);
    expect(chances[0]?.chance).toBeCloseTo(50 / 111);
    expect(chances[1]?.chance).toBeCloseTo(60 / 111);
    expect(chances[2]?.chance).toBeCloseTo(PESO_MINIMO_INDICADO / 111);
  });

  it('propriedade: somam 1, ficam em [0, 1] e o bônus só ajuda o jogador', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({ id: fc.string({ minLength: 1 }), base: fc.integer({ min: -10, max: 100 }) }),
          { selector: (i) => i.id, minLength: 1, maxLength: 8 },
        ),
        fc.integer({ min: 0, max: 40 }),
        (indicados, bonus) => {
          const jogador = indicados[0]?.id as string;
          const sem = chancesIndicados(indicados, 0, jogador);
          const com = chancesIndicados(indicados, bonus, jogador);
          const soma = com.reduce((s, c) => s + c.chance, 0);
          expect(soma).toBeCloseTo(1, 9);
          for (const c of com) {
            expect(c.chance).toBeGreaterThan(0);
            expect(c.chance).toBeLessThanOrEqual(1);
          }
          expect(com[0]?.chance).toBeGreaterThanOrEqual((sem[0]?.chance as number) - 1e-12);
        },
      ),
    );
  });

  it('sorteio ponderado pelas chances', () => {
    const chances = [
      { id: 'eu', chance: 0.25 },
      { id: 'vic', chance: 0.75 },
    ];
    expect(sortearVencedor(chances, rngFixo(0))).toBe('eu');
    expect(sortearVencedor(chances, rngFixo(0.26))).toBe('vic');
    expect(sortearVencedor(chances, rngFixo(RNG_MAXIMO))).toBe('vic');
    fc.assert(
      fc.property(fc.string(), (semente) => {
        expect(['eu', 'vic']).toContain(sortearVencedor(chances, criarRng(semente)));
      }),
    );
  });
});

describe('discurso', () => {
  it('seguro sempre; ousado se ensaiou; especial se cumpriu o marco', () => {
    expect(opcoesDiscurso({ ensaiou: false, marcoEspecialCumprido: false })).toEqual([
      { id: 'seguro', rotulo: 'Seguro', liberada: true, motivo: null },
      { id: 'ousado', rotulo: 'Ousado', liberada: false, motivo: 'precisa_ensaiar' },
      { id: 'especial', rotulo: 'Especial', liberada: false, motivo: 'precisa_marco' },
    ]);
    const tudo = opcoesDiscurso({ ensaiou: true, marcoEspecialCumprido: true });
    expect(tudo.every((o) => o.liberada && o.motivo === null)).toBe(true);
  });

  it('seguro: fama +1..2; gemas só para quem venceu', () => {
    expect(efeitosDiscurso('seguro', false, rngFixo(0))).toEqual({
      deltas: [{ alvo: 'fama', valor: 1 }],
      gemas: 0,
    });
    expect(efeitosDiscurso('seguro', true, rngFixo(RNG_MAXIMO))).toEqual({
      deltas: [{ alvo: 'fama', valor: 2 }],
      gemas: 40,
    });
    expect(efeitosDiscurso('seguro', true, rngFixo(0)).gemas).toBe(10);
  });

  it('ousado: fama +2..5 e polêmica +3..6', () => {
    expect(efeitosDiscurso('ousado', false, rngFixo(0)).deltas).toEqual([
      { alvo: 'fama', valor: 2 },
      { alvo: 'polemica', valor: 3 },
    ]);
    expect(efeitosDiscurso('ousado', false, rngFixo(RNG_MAXIMO)).deltas).toEqual([
      { alvo: 'fama', valor: 5 },
      { alvo: 'polemica', valor: 6 },
    ]);
  });

  it('especial: fama +4..8 e relação +2..4 com cada aliado, sem repetir', () => {
    expect(
      efeitosDiscurso('especial', false, rngFixo(0), ['bento', 'duda', 'bento']).deltas,
    ).toEqual([
      { alvo: 'fama', valor: 4 },
      { alvo: 'relacao:bento', valor: 2 },
      { alvo: 'relacao:duda', valor: 2 },
    ]);
    expect(efeitosDiscurso('especial', false, rngFixo(RNG_MAXIMO)).deltas).toEqual([
      { alvo: 'fama', valor: 8 },
    ]);
  });

  it('propriedade: deltas dentro das faixas e relação dentro de ±12', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('seguro' as const, 'ousado' as const, 'especial' as const),
        fc.boolean(),
        fc.string(),
        fc.array(fc.string({ minLength: 1 }), { maxLength: 5 }),
        (opcao, venceu, semente, aliados) => {
          const r = efeitosDiscurso(opcao, venceu, criarRng(semente), aliados);
          const fama = r.deltas.find((d) => d.alvo === 'fama')?.valor as number;
          expect(fama).toBeGreaterThanOrEqual(1);
          expect(fama).toBeLessThanOrEqual(8);
          for (const d of r.deltas.filter((x) => x.alvo.startsWith('relacao:'))) {
            expect(Math.abs(d.valor)).toBeLessThanOrEqual(12);
          }
          if (venceu) {
            expect(r.gemas).toBeGreaterThanOrEqual(10);
            expect(r.gemas).toBeLessThanOrEqual(40);
          } else {
            expect(r.gemas).toBe(0);
          }
          expect(efeitosDiscurso(opcao, venceu, criarRng(semente), aliados)).toEqual(r);
        },
      ),
    );
  });
});
