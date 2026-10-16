import { describe, expect, it } from 'vitest';
import { NOMES_DESTAQUE, montarTema, type NomeDestaque } from './tema';

// Tabelas de docs/PLANO.md ("Neutros" e "Destaques"), fonte independente do Figma.
const NEUTROS_PLANO = {
  claro: {
    fundo: '#ececec',
    superficie: '#f6f6f6',
    superficie2: '#e2e3e3',
    linha: '#d6d8d8',
    texto: '#2a2c2c',
    // #676b6b no plano; escurecido para passar de 4,5:1 sobre superficie-2 (docs/DECISOES.md).
    textoSuave: '#5f6363',
    textoFraco: '#b3b6b6',
    primario: '#141515',
    primarioTexto: '#f6f6f6',
  },
  escuro: {
    fundo: '#111213',
    superficie: '#1b1c1e',
    superficie2: '#0b0c0d',
    linha: '#2a2c2f',
    texto: '#ecedee',
    textoSuave: '#8d9196',
    textoFraco: '#55595e',
    primario: '#ecedee',
    primarioTexto: '#141515',
  },
};

// [base, sobre, tinta claro, tinta escuro, suave claro, suave escuro, gráfico claro]
const DESTAQUES_PLANO: Record<NomeDestaque, string[]> = {
  laranja: ['#ff5a1f', '#1a0e08', '#b23a0b', '#ff8a5c', '#ffe3d6', '#3a2117', '#f03f00'],
  cobalto: ['#2f5bff', '#ffffff', '#2443cc', '#8aa4ff', '#dde4ff', '#1c2342', '#2f5bff'],
  violeta: ['#6b4bff', '#ffffff', '#5b3fe0', '#a893ff', '#e7e1ff', '#262043', '#6b4bff'],
  rosa: ['#ff4fa3', '#2a0616', '#b01a67', '#ff8ac4', '#ffdcec', '#3a1a2b', '#fc0078'],
  menta: ['#14a98b', '#04201a', '#0a7461', '#5fe0c4', '#d3f3ec', '#12302a', '#119278'],
  lima: ['#9ccb00', '#1a2100', '#4a6600', '#c8f03c', '#eef8c6', '#2a3210', '#6b8b00'],
};

describe('montarTema', () => {
  it('tem os seis destaques do plano', () => {
    expect(NOMES_DESTAQUE).toEqual(['laranja', 'cobalto', 'violeta', 'rosa', 'menta', 'lima']);
  });

  it.each(['claro', 'escuro'] as const)('neutros do modo %s batem com o plano', (modo) => {
    expect(montarTema(modo, 'laranja').cores).toMatchObject(NEUTROS_PLANO[modo]);
  });

  it.each(NOMES_DESTAQUE)('destaque %s resolve os aliases nos dois modos', (nome) => {
    const [base, sobre, tintaClaro, tintaEscuro, suaveClaro, suaveEscuro, graficoClaro] =
      DESTAQUES_PLANO[nome];
    const claro = montarTema('claro', nome).cores;
    const escuro = montarTema('escuro', nome).cores;
    expect(claro).toMatchObject({
      destaque: base,
      destaqueSobre: sobre,
      destaqueTinta: tintaClaro,
      destaqueSuave: suaveClaro,
      destaqueGrafico: graficoClaro,
      destaqueBrilho: `${base}61`,
    });
    // No escuro, destaque-gráfico usa a própria base.
    expect(escuro).toMatchObject({
      destaque: base,
      destaqueTinta: tintaEscuro,
      destaqueSuave: suaveEscuro,
      destaqueGrafico: base,
    });
  });

  it('o brilho do botão metal segue o destaque escolhido', () => {
    for (const modo of ['claro', 'escuro'] as const) {
      for (const nome of NOMES_DESTAQUE) {
        const tema = montarTema(modo, nome);
        expect(tema.sombras.botaoMetal[0]).toMatchObject({
          offsetY: 16,
          blurRadius: 32,
          color: tema.cores.destaqueBrilho,
        });
        expect(tema.sombras.botaoMetal.some((s) => 'variavel' in s)).toBe(false);
      }
    }
  });

  it('o brilho dos chips em destaque também segue o destaque', () => {
    const tema = montarTema('escuro', 'violeta');
    expect(tema.sombras.brilhoDestaque).toEqual([
      { offsetX: 0, offsetY: 6, blurRadius: 8, spreadDistance: 0, color: '#6b4bff61' },
    ]);
  });

  it('as sombras internas viram inset do React Native', () => {
    const { sombras } = montarTema('claro', 'laranja');
    expect(sombras.elevacao).toEqual([
      { offsetX: 0, offsetY: 10, blurRadius: 24, spreadDistance: 0, color: '#00000012' },
      { offsetX: 0, offsetY: 1, blurRadius: 2, spreadDistance: 0, color: '#0000000d' },
      { offsetX: 0, offsetY: 1, blurRadius: 0, spreadDistance: 0, color: '#ffffffe5', inset: true },
    ]);
  });

  it('a esfera tem a mesma geometria do Figma e inverte o tom no escuro', () => {
    const claro = montarTema('claro', 'laranja').gradientes.esferaPreta;
    const escuro = montarTema('escuro', 'laranja').gradientes.esferaPreta;
    expect(claro).toMatchObject({ tipo: 'radial', centro: { x: 0.35, y: 0.3 }, raioX: 0.625 });
    expect(claro.cores[0]).toBe('#5c6060');
    expect(escuro.cores[0]).toBe('#ffffff');
  });

  it('o metal vai de cima para baixo', () => {
    expect(montarTema('claro', 'laranja').gradientes.metal).toMatchObject({
      tipo: 'linear',
      cores: ['#e3e5e5', '#bcc0c0', '#979c9c'],
      inicio: { x: 0.5, y: 0 },
      fim: { x: 0.5, y: 1 },
    });
  });

  it('a tipografia segue a do plano', () => {
    const { tipografia } = montarTema('claro', 'laranja');
    expect(tipografia.display).toEqual({
      fontFamily: 'PlusJakartaSans-Bold',
      fontSize: 28,
      lineHeight: 34,
      letterSpacing: -0.56,
    });
    expect(tipografia.mini).toMatchObject({ fontSize: 11, lineHeight: 14, letterSpacing: 0.44 });
    expect(Object.keys(tipografia)).toEqual([
      'display',
      'titulo',
      'secao',
      'numero',
      'botao',
      'corpo',
      'corpoForte',
      'legenda',
      'mini',
      'iniciais',
    ]);
  });
});
