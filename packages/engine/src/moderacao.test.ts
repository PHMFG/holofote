import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MOTIVOS_MODERACAO,
  PESSOAS_REAIS,
  moderarTexto,
  pareceNomeDePessoaReal,
} from './moderacao';

const categoria = (texto: string) => {
  const r = moderarTexto(texto);
  return r.ok ? null : r.categoria;
};

describe('moderarTexto', () => {
  it('deixa passar provocação, números e textos comuns', () => {
    const ok = [
      'hoje o palco é meu e quem não gostou que lute',
      'você é ridícula, @vic.ferraz',
      'turnê 2025-2026 confirmada, 10 mil seguidores!!!',
      'comida gostosa pra criança no camarim',
      'pelada com a criançada depois do ensaio',
      'essa música me mata de rir',
      'vou matar a saudade do palco',
      '',
    ];
    for (const texto of ok) expect(moderarTexto(texto), texto).toEqual({ ok: true });
  });

  it('barra discurso de ódio, inclusive com acento, maiúsculas e leetspeak', () => {
    expect(categoria('que viado')).toBe('odio');
    expect(categoria('V1AD0 nojento')).toBe('odio');
    expect(categoria('volta pra senzala')).toBe('odio');
    expect(categoria('raça inferior')).toBe('odio');
    expect(categoria('Heil Hitler')).toBe('odio');
  });

  it('barra ameaça e violência explícita', () => {
    expect(categoria('vou te matar amanhã')).toBe('violencia');
    expect(categoria('vou te mataaaaar')).toBe('violencia');
    expect(categoria('eu te mato')).toBe('violencia');
    expect(categoria('vou esfaquear você')).toBe('violencia');
    expect(categoria('quero matar ela')).toBe('violencia');
    expect(categoria('a gente devia te espancar')).toBe('violencia');
    expect(categoria('merece um tiro na cara')).toBe('violencia');
    expect(categoria('falou de estupro')).toBe('violencia');
  });

  it('barra sexualização de menores', () => {
    expect(categoria('pedofilia')).toBe('menores');
    expect(categoria('nudes de menor')).toBe('menores');
    expect(categoria('menina de 12 anos pelado sexo')).toBe('menores');
    expect(categoria('foto sensual de criança')).toBe('menores');
    expect(categoria('14 aninhos e já nua')).toBe('menores');
  });

  it('barra dados pessoais', () => {
    expect(categoria('meu cpf é 123.456.789-09')).toBe('dados_pessoais');
    expect(categoria('cpf 12345678909')).toBe('dados_pessoais');
    expect(categoria('liga (11) 98765-4321')).toBe('dados_pessoais');
    expect(categoria('zap +55 11 98765-4321')).toBe('dados_pessoais');
    expect(categoria('chama no 98765-4321')).toBe('dados_pessoais');
    expect(categoria('fixo 11 3456-7890')).toBe('dados_pessoais');
    expect(categoria('manda pra lua.prado@gmail.com')).toBe('dados_pessoais');
  });

  it('o motivo é uma frase curta para o jogador', () => {
    expect(moderarTexto('vou te matar')).toEqual({
      ok: false,
      categoria: 'violencia',
      motivo: MOTIVOS_MODERACAO.violencia,
    });
    for (const motivo of Object.values(MOTIVOS_MODERACAO)) {
      expect(motivo.length).toBeLessThanOrEqual(80);
      expect(motivo.endsWith('.')).toBe(true);
    }
  });

  it('propriedade: nunca lança e sempre devolve um veredito', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 280 }), (texto) => {
        const r = moderarTexto(texto);
        expect(typeof r.ok).toBe('boolean');
      }),
    );
  });
});

describe('pareceNomeDePessoaReal', () => {
  it('reconhece celebridades com e sem acento, em handle e no meio do nome', () => {
    expect(pareceNomeDePessoaReal('Anitta')).toBe(true);
    expect(pareceNomeDePessoaReal('ANITTA')).toBe(true);
    expect(pareceNomeDePessoaReal('Beyonce')).toBe(true);
    expect(pareceNomeDePessoaReal('Taylor Swift')).toBe(true);
    expect(pareceNomeDePessoaReal('@taylorswift13')).toBe(true);
    expect(pareceNomeDePessoaReal('Neymar Jr')).toBe(true);
    expect(pareceNomeDePessoaReal('Luísa Sonza')).toBe(true);
  });

  it('deixa passar o elenco fictício e nomes parecidos', () => {
    for (const nome of [
      'Lua Prado',
      'Vic Ferraz',
      'Duda Marques',
      'Bento Lima',
      'fofocalizei',
      'Anita',
      'Taylor',
    ]) {
      expect(pareceNomeDePessoaReal(nome), nome).toBe(false);
    }
  });

  it('todos os nomes da lista são reconhecidos', () => {
    for (const nome of PESSOAS_REAIS) expect(pareceNomeDePessoaReal(nome), nome).toBe(true);
  });
});
