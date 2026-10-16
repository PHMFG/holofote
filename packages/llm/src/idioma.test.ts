import { describe, expect, it } from 'vitest';
import { extrairJson } from './json';
import { parecePortugues, temEmoji } from './idioma';

describe('parecePortugues', () => {
  it.each([
    'não sei se concordo, mas a timeline não fala de outra coisa',
    'URGENTE: Lua e Duda brigaram no estúdio?',
    'kkkkk',
    'Team Vic',
    'o trono do pop tá pequeno pra duas',
    'show lotado, hit do ano, feat com a Vic',
  ])('aceita %s', (texto) => {
    expect(parecePortugues(texto)).toBe(true);
  });

  it.each([
    'I love this song so much, you are the best',
    'this is not what we talked about',
    'el concierto fue muy bueno pero las entradas',
    '¿qué pasó?',
  ])('recusa %s', (texto) => {
    expect(parecePortugues(texto)).toBe(false);
  });
});

describe('temEmoji', () => {
  it.each(['que show 🔥', 'te amo ❤️', 'Brasil 🇧🇷', '✨'])('acha emoji em %s', (texto) => {
    expect(temEmoji(texto)).toBe(true);
  });

  it.each(['kkkk :)', 'é isso... ou não?', 'nota 10/10', 'R$ 29,90'])(
    'não vê emoji em %s',
    (texto) => {
      expect(temEmoji(texto)).toBe(false);
    },
  );
});

describe('extrairJson', () => {
  it('lê JSON puro, com bloco de código e com texto em volta', () => {
    expect(extrairJson('{"a":1}')).toEqual({ ok: true, valor: { a: 1 } });
    expect(extrairJson('```json\n{"a":1}\n```')).toEqual({ ok: true, valor: { a: 1 } });
    expect(extrairJson('Claro! {"a":{"b":2}} Pronto.')).toEqual({
      ok: true,
      valor: { a: { b: 2 } },
    });
  });

  it('falha com texto sem objeto, JSON quebrado ou lista', () => {
    expect(extrairJson('sem json aqui').ok).toBe(false);
    expect(extrairJson('{"a": 1,').ok).toBe(false);
    expect(extrairJson('[1,2]').ok).toBe(false);
  });
});
