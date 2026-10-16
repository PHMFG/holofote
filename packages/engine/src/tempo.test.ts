import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { aplicarDeslocamento, dataLocal, diaDoMundo, periodoDe } from './tempo';

const SP = 'America/Sao_Paulo'; // UTC−3, sem horário de verão
const utc = (iso: string) => new Date(iso);

describe('periodoDe', () => {
  it('manhã 6–12, tarde 12–18, noite 18–6 no fuso do jogador', () => {
    expect(periodoDe(utc('2026-10-16T08:59:00Z'), SP)).toBe('noite'); // 05:59
    expect(periodoDe(utc('2026-10-16T09:00:00Z'), SP)).toBe('manha'); // 06:00
    expect(periodoDe(utc('2026-10-16T14:59:00Z'), SP)).toBe('manha'); // 11:59
    expect(periodoDe(utc('2026-10-16T15:00:00Z'), SP)).toBe('tarde'); // 12:00
    expect(periodoDe(utc('2026-10-16T20:59:00Z'), SP)).toBe('tarde'); // 17:59
    expect(periodoDe(utc('2026-10-16T21:00:00Z'), SP)).toBe('noite'); // 18:00
    expect(periodoDe(utc('2026-10-17T03:00:00Z'), SP)).toBe('noite'); // 00:00
  });

  it('o mesmo instante muda de período com o fuso', () => {
    const instante = utc('2026-10-16T09:00:00Z');
    expect(periodoDe(instante, 'UTC')).toBe('manha');
    expect(periodoDe(instante, 'Asia/Tokyo')).toBe('noite'); // 18:00
    expect(periodoDe(instante, 'America/Los_Angeles')).toBe('noite'); // 02:00
  });

  it('fuso inválido lança erro', () => {
    expect(() => periodoDe(utc('2026-10-16T09:00:00Z'), 'Lugar/Nenhum')).toThrow(RangeError);
  });

  it('propriedade: hora local sempre de 0 a 23', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        fc.constantFrom(SP, 'UTC', 'Asia/Tokyo', 'Europe/Lisbon', 'America/New_York'),
        (ms, fuso) => {
          const { hora } = dataLocal(new Date(ms), fuso);
          expect(hora).toBeGreaterThanOrEqual(0);
          expect(hora).toBeLessThanOrEqual(23);
        },
      ),
    );
  });
});

describe('diaDoMundo', () => {
  const criadoEm = utc('2026-10-16T22:00:00Z'); // 19:00 em São Paulo

  it('1 no dia da criação, conta meias-noites locais', () => {
    expect(diaDoMundo(criadoEm, criadoEm, SP)).toBe(1);
    // 02:00 UTC do dia 17 ainda é 23:00 do dia 16 em São Paulo.
    expect(diaDoMundo(criadoEm, utc('2026-10-17T02:00:00Z'), SP)).toBe(1);
    expect(diaDoMundo(criadoEm, utc('2026-10-17T03:00:00Z'), SP)).toBe(2);
    expect(diaDoMundo(criadoEm, utc('2026-10-26T12:00:00Z'), SP)).toBe(11);
  });

  it('nunca é menor que 1', () => {
    expect(diaDoMundo(criadoEm, utc('2026-10-01T12:00:00Z'), SP)).toBe(1);
  });

  it('atravessa horário de verão sem pular dia', () => {
    const ny = 'America/New_York';
    const antes = utc('2026-03-07T17:00:00Z'); // 12:00 de 7/3, antes da mudança
    expect(diaDoMundo(antes, utc('2026-03-08T16:00:00Z'), ny)).toBe(2); // 12:00 de 8/3, já em EDT
    expect(diaDoMundo(antes, utc('2026-11-01T16:00:00Z'), ny)).toBe(240);
  });
});

describe('aplicarDeslocamento', () => {
  it('soma minutos ao instante, para frente ou para trás', () => {
    const agora = utc('2026-10-16T12:00:00Z');
    expect(aplicarDeslocamento(agora, 90)).toEqual(utc('2026-10-16T13:30:00Z'));
    expect(aplicarDeslocamento(agora, -60 * 24)).toEqual(utc('2026-10-15T12:00:00Z'));
    expect(agora).toEqual(utc('2026-10-16T12:00:00Z'));
  });
});
