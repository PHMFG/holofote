import { diaDoMundo, haQuanto, horaCurta, horaMinuto, tempoRelativo } from './tempo';

// 16/10/2026 às 21:07 no fuso do aparelho.
const agora = new Date(2026, 9, 16, 21, 7).getTime();
const antes = (ms: number) => new Date(agora - ms).toISOString();
const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

describe('tempoRelativo', () => {
  it('agora, minutos e horas', () => {
    expect(tempoRelativo(antes(20_000), agora)).toBe('agora');
    expect(tempoRelativo(antes(12 * MIN), agora)).toBe('12 min');
    expect(tempoRelativo(antes(2 * H), agora)).toBe('2 h');
    expect(tempoRelativo(antes(23 * H), agora, 6)).toBe('23 h');
    // Relógio do aparelho um pouco atrás do servidor: não vira tempo negativo.
    expect(tempoRelativo(antes(-5000), agora)).toBe('agora');
  });

  it('depois de um dia, usa o dia do mundo quando ele é conhecido', () => {
    expect(tempoRelativo(antes(D), agora, 6)).toBe('Dia 5');
    expect(tempoRelativo(antes(3 * D), agora, 6)).toBe('Dia 3');
  });

  it('sem o mundo, usa dias e depois a data', () => {
    expect(tempoRelativo(antes(3 * D), agora)).toBe('3 d');
    expect(tempoRelativo(antes(10 * D), agora)).toMatch(/^\d{2}\/\d{2}$/);
  });
});

describe('haQuanto', () => {
  it('"há" nos cabeçalhos de cartão', () => {
    expect(haQuanto(antes(2 * MIN), agora)).toBe('há 2 min');
    expect(haQuanto(antes(2 * H), agora)).toBe('há 2 h');
    expect(haQuanto(antes(1000), agora)).toBe('agora');
  });
});

describe('horaCurta', () => {
  it('mostra a hora no mesmo dia e o dia do mundo antes', () => {
    const hoje = new Date(2026, 9, 16, 9, 5).toISOString();
    expect(horaCurta(hoje, agora, 6)).toBe('09:05');
    expect(horaCurta(antes(2 * D), agora, 6)).toBe('Dia 4');
    expect(horaCurta(antes(20_000), agora, 6)).toBe('agora');
  });

  it('sem o mundo, usa ontem e há N dias', () => {
    expect(horaCurta(antes(D), agora)).toBe('ontem');
    expect(horaCurta(antes(3 * D), agora)).toBe('há 3 dias');
  });
});

describe('dia do mundo e hora', () => {
  it('o dia do mundo nunca fica abaixo de 1 e some sem o mundo', () => {
    expect(diaDoMundo(antes(10 * D), 2, agora)).toBe(1);
    expect(diaDoMundo(antes(D), undefined, agora)).toBeUndefined();
  });

  it('hora e minuto com dois dígitos', () => {
    expect(horaMinuto(new Date(2026, 9, 16, 9, 5).toISOString())).toBe('09:05');
  });
});
