import { describe, expect, it } from 'vitest';
import { lerConfigLlm } from '../src/config';
import { criarProvedorFalso } from '../src/falso';
import { ErroLimite } from '../src/provedor';
import { criarProvedorRoteirizado } from '../src/roteirizado';
import { ACOES_EVAL } from './acoes';
import { executarEvals } from './executar';
import { CRITERIOS, avaliarCriterios, calcularMetricas } from './metricas';

describe('ações de eval', () => {
  it('são 30, com os 4 tons, comentários, DMs, histórias e discurso', () => {
    expect(ACOES_EVAL).toHaveLength(30);
    expect(new Set(ACOES_EVAL.map((a) => a.id)).size).toBe(30);
    const tons = ACOES_EVAL.flatMap((a) =>
      a.job === 'diretor' && a.entrada.acao.tipo === 'post' && a.entrada.acao.tom
        ? [a.entrada.acao.tom]
        : [],
    );
    for (const tom of ['fofo', 'sincero', 'misterioso', 'provocativo']) {
      expect(tons.filter((t) => t === tom)).toHaveLength(3);
    }
    const tipos = ACOES_EVAL.map((a) => (a.job === 'diretor' ? a.entrada.acao.tipo : a.job));
    expect(tipos.filter((t) => t === 'resposta')).toHaveLength(6);
    expect(tipos.filter((t) => t === 'resposta_historia')).toHaveLength(3);
    expect(tipos.filter((t) => t === 'dm')).toHaveLength(7);
    expect(tipos.filter((t) => t === 'discurso')).toHaveLength(2);
  });
});

describe('executarEvals', () => {
  it('passa nos critérios com o provedor falso', async () => {
    const resultados = await executarEvals(ACOES_EVAL, criarProvedorFalso(), lerConfigLlm({}));
    const metricas = calcularMetricas(resultados);
    expect(metricas).toMatchObject({
      acoes: 30,
      chamadas: 30,
      jsonValidoPct: 100,
      portuguesPct: 100,
      textosAcimaDoLimite: 0,
      sucessoPct: 100,
    });
    expect(metricas.custoMedioUsd).toBeLessThanOrEqual(CRITERIOS.custoMedioUsd);
    expect(avaliarCriterios(metricas).every((c) => c.ok)).toBe(true);
  });

  it('mede reparo, texto acima do limite e falha', async () => {
    const acoes = ACOES_EVAL.slice(0, 2);
    const ruim = {
      reacoes: [],
      cartao: { titulo: 'a'.repeat(80), texto: 'ok' },
      moderacao: { ok: true },
    };
    const bom = {
      reacoes: [],
      cartao: { titulo: 'certo', texto: 'agora sim' },
      moderacao: { ok: true },
    };
    const provedor = criarProvedorRoteirizado([
      ruim,
      bom,
      new ErroLimite('a', 429, 'rate limit'),
      new ErroLimite('b', 429, 'rate limit'),
    ]);
    const resultados = await executarEvals(acoes, provedor, lerConfigLlm({}));
    const m = calcularMetricas(resultados);
    expect(m).toMatchObject({ acoes: 2, respostas: 2, jsonValidoPct: 50, textosAcimaDoLimite: 1 });
    expect(m.sucessoPct).toBe(50);
    expect(m.aceitasDePrimeiraPct).toBe(0);
    expect(resultados[1]?.erro).toMatch(/^ErroLimite/);
    const criterios = avaliarCriterios(m);
    expect(criterios.find((c) => c.nome === 'JSON válido')?.ok).toBe(false);
  });
});
