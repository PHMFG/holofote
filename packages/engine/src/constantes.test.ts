// Cada tabela da seção "Regras do jogo" de docs/PLANO.md, reproduzida como está no plano.
import { describe, expect, it } from 'vitest';
import {
  AFINIDADE_ALIADO,
  AFINIDADE_EXTREMA,
  ANUNCIO,
  CUSTOS,
  CUSTO_CAMPANHA,
  DESFAZER,
  ENERGIA,
  EVENTO,
  FAIXAS_RELACAO,
  GEMAS,
  LIMITE_DELTA_RELACAO,
  MARCOS_POR_ATO,
  MAX_MARCADOS,
  MAX_REATORES,
  PERIODOS,
  POLEMICA,
} from './constantes';

describe('tabela de energia e custos', () => {
  it('custos por ação', () => {
    expect(CUSTOS).toEqual({
      post: 1,
      resposta: 1,
      dm: 1,
      historia: 1,
      voto: 0,
      curtir: 0,
      seguir: 0,
      desfazer: 2,
      previa: 0,
      discurso: 0,
    });
    expect(CUSTO_CAMPANHA).toEqual({ min: 1, max: 2 });
  });

  it('máximo e recarga por plano', () => {
    expect(ENERGIA.free).toEqual({ max: 12, recargaMinutos: 20 });
    expect(ENERGIA.plus).toEqual({ max: 24, recargaMinutos: 10 });
  });

  it('anúncio e gemas', () => {
    expect(ANUNCIO).toEqual({ energia: 3, porDia: 3 });
    expect(GEMAS).toEqual({
      iniciais: 40,
      encherEnergia: 10,
      marco: 25,
      evento: { min: 10, max: 40 },
    });
  });
});

describe('atributos, relações e desfazer', () => {
  it('polêmica: crise acima de 70 com 20 % ao dia, decai 3 por dia', () => {
    expect(POLEMICA).toEqual({ limiarCrise: 70, chanceCriseDia: 0.2, decaimentoDia: 3 });
  });

  it('limites de delta de relação', () => {
    expect(LIMITE_DELTA_RELACAO).toEqual({ acao: 8, evento: 12 });
  });

  it('faixas de relação cobrem 0 a 100 sem buraco', () => {
    let esperado = 0;
    for (const faixa of FAIXAS_RELACAO) {
      expect(faixa.min).toBe(esperado);
      esperado = faixa.max + 1;
    }
    expect(esperado).toBe(101);
  });

  it('desfazer: 60 minutos, afinidade abaixo de 45 lembra com 25 %', () => {
    expect(DESFAZER).toEqual({ janelaMinutos: 60, afinidadeLembra: 45, chanceLembrar: 0.25 });
  });

  it('reatores, marcos e eventos', () => {
    expect(MAX_REATORES).toBe(5);
    expect(MAX_MARCADOS).toBe(3);
    expect(MARCOS_POR_ATO).toBe(5);
    expect(AFINIDADE_EXTREMA).toEqual({ ate: 24, aPartirDe: 80 });
    expect(AFINIDADE_ALIADO).toBe(80);
    expect(EVENTO).toEqual({ anuncioDiasAntes: 3, segundosAoVivo: 30 });
  });

  it('períodos do dia', () => {
    expect(PERIODOS).toEqual({
      manha: { inicio: 6, fim: 12 },
      tarde: { inicio: 12, fim: 18 },
      noite: { inicio: 18, fim: 6 },
    });
  });
});
