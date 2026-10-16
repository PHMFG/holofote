import { act, renderHook } from '@testing-library/react-native';
import { relogio, useSegundosRestantes } from './relogio';

const AGORA = Date.parse('2026-10-16T12:00:00Z');

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(AGORA);
});
afterEach(() => jest.useRealTimers());

const em = (segundos: number) => new Date(AGORA + segundos * 1000).toISOString();

describe('useSegundosRestantes', () => {
  it('conta os segundos até o prazo e para em zero', async () => {
    const { result } = await renderHook(() => useSegundosRestantes(em(10), 30));
    expect(result.current).toBe(10);
    await act(async () => {
      jest.advanceTimersByTime(4_000);
    });
    expect(result.current).toBe(6);
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(result.current).toBe(0);
  });

  it('sem prazo devolve null', async () => {
    const { result } = await renderHook(() => useSegundosRestantes(null, 30));
    expect(result.current).toBeNull();
  });

  it('com o relógio do mundo adiantado em dias, desconta o desvio e conta a janela', async () => {
    // O servidor marcou o prazo 3 dias à frente da hora real do aparelho.
    const tresDias = 3 * 24 * 3600;
    const { result } = await renderHook(() => useSegundosRestantes(em(tresDias + 30), 30));
    expect(result.current).toBe(30);
    await act(async () => {
      jest.advanceTimersByTime(12_000);
    });
    expect(result.current).toBe(18);
  });

  it('sem janela, usa o prazo como veio', async () => {
    const { result } = await renderHook(() => useSegundosRestantes(em(600)));
    expect(result.current).toBe(600);
  });
});

describe('relogio', () => {
  it('formata minutos e segundos', () => {
    expect(relogio(24)).toBe('0:24');
    expect(relogio(65)).toBe('1:05');
  });
});
