import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { desfazivelAte, inverterDeltas, lembraDoDesfazer, podeDesfazer } from './desfazer';
import { rngFixo } from './rng';
import type { Delta } from './tipos';

const criadaEm = new Date(Date.UTC(2026, 9, 16, 12, 0, 0));
const depois = (minutos: number) => new Date(criadaEm.getTime() + minutos * 60_000);
const base = { criadaEm, ehUltimaAcao: true, jaDesfeita: false };

describe('podeDesfazer', () => {
  it('só a última ação, até 60 minutos inclusive', () => {
    expect(podeDesfazer({ ...base, agora: depois(0) })).toEqual({ ok: true });
    expect(podeDesfazer({ ...base, agora: depois(60) })).toEqual({ ok: true });
    expect(podeDesfazer({ ...base, agora: depois(60.01) })).toEqual({
      ok: false,
      motivo: 'desfazer_expirado',
    });
    expect(podeDesfazer({ ...base, ehUltimaAcao: false, agora: depois(1) })).toEqual({
      ok: false,
      motivo: 'nao_e_ultima',
    });
    expect(podeDesfazer({ ...base, jaDesfeita: true, agora: depois(1) })).toEqual({
      ok: false,
      motivo: 'ja_desfeita',
    });
  });

  it('desfazivelAte é 60 minutos depois', () => {
    expect(desfazivelAte(criadaEm)).toEqual(depois(60));
  });
});

describe('inverterDeltas', () => {
  it('troca o sinal sem mexer na entrada e sem −0', () => {
    const deltas: Delta[] = [
      { alvo: 'fama', valor: 1 },
      { alvo: 'relacao:vic', valor: -4 },
      { alvo: 'polemica', valor: 0 },
    ];
    const invertidos = inverterDeltas(deltas);
    expect(invertidos).toEqual([
      { alvo: 'fama', valor: -1 },
      { alvo: 'relacao:vic', valor: 4 },
      { alvo: 'polemica', valor: 0 },
    ]);
    expect(Object.is(invertidos[2]?.valor, 0)).toBe(true);
    expect(deltas[0]?.valor).toBe(1);
  });

  it('propriedade: inverter duas vezes volta ao original', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -100, max: 100 })), (valores) => {
        const deltas: Delta[] = valores.map((valor) => ({ alvo: 'fama', valor }));
        expect(inverterDeltas(inverterDeltas(deltas))).toEqual(
          deltas.map((d) => ({ ...d, valor: d.valor || 0 })),
        );
      }),
    );
  });
});

describe('lembraDoDesfazer', () => {
  it('afinidade abaixo de 45 ou fofoca: 25 % de chance', () => {
    expect(lembraDoDesfazer({ afinidade: 44, perfilFofoca: false, rng: rngFixo(0.24) })).toBe(true);
    expect(lembraDoDesfazer({ afinidade: 44, perfilFofoca: false, rng: rngFixo(0.25) })).toBe(
      false,
    );
    expect(lembraDoDesfazer({ afinidade: 90, perfilFofoca: true, rng: rngFixo(0) })).toBe(true);
  });

  it('os demais nunca lembram e não consomem o RNG', () => {
    let chamadas = 0;
    const rng = () => {
      chamadas++;
      return 0;
    };
    expect(lembraDoDesfazer({ afinidade: 45, perfilFofoca: false, rng })).toBe(false);
    expect(chamadas).toBe(0);
  });
});
