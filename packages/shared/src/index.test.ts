import { describe, expect, it } from 'vitest';
import { FILAS, PedidoCriarMundo, Post, canalDoMundo } from './index';

describe('FILAS', () => {
  it('tem uma fila por tipo de trabalho, com nome igual à chave', () => {
    expect(Object.keys(FILAS)).toEqual(['diretor', 'dm', 'discurso', 'lote', 'entrega']);
    for (const [chave, nome] of Object.entries(FILAS)) expect(nome).toBe(chave);
  });

  it('o canal Redis é por mundo', () => {
    expect(canalDoMundo('abc')).toBe('mundo:abc');
  });
});

describe('contratos', () => {
  it('criar mundo exige consentimento de IA explícito', () => {
    const base = {
      universo: 'Time de vôlei',
      tomCaos: 40,
      persona: { nome: 'Lua Prado', handle: '@luaprado', descricao: 'levantadora reserva' },
    };
    expect(PedidoCriarMundo.safeParse({ ...base, consentimentoIA: true }).success).toBe(true);
    expect(PedidoCriarMundo.safeParse({ ...base, consentimentoIA: false }).success).toBe(false);
  });

  it('post recusa data sem fuso', () => {
    const autor = {
      id: '00000000-0000-4000-8000-000000000001',
      nome: 'Vic',
      handle: '@vic',
      iniciais: 'VF',
      tomAvatar: 'claro',
      verificado: true,
      papel: 'elenco',
    };
    const post = {
      id: '00000000-0000-4000-8000-000000000002',
      autor,
      texto: 'oi',
      tipo: 'post',
      tom: null,
      respondeA: null,
      marcados: [],
      curtidas: 0,
      reposts: 0,
      respostas: 0,
      curtidoPorMim: false,
      criadoEm: '2026-10-16T12:00:00Z',
      enquete: null,
      expiraEm: null,
    };
    expect(Post.safeParse(post).success).toBe(true);
    expect(Post.safeParse({ ...post, criadoEm: '2026-10-16 12:00' }).success).toBe(false);
  });
});
