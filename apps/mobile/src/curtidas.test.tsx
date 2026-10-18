import { FIM_SUBIDA_CURTIDAS_MS, SUBIDA_CURTIDAS_MS } from '@holofote/engine';
import { act, renderHook } from '@testing-library/react-native';
import { acertarRelogioDoMundo, useCurtidas } from './curtidas';

const agora = new Date('2026-10-18T12:00:00Z').getTime();
const chegou = (msAtras: number) => new Date(agora - msAtras).toISOString();

beforeEach(() => {
  jest.useFakeTimers({ now: agora });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('useCurtidas', () => {
  it('post recém-chegado começa do zero e sobe com o tempo', async () => {
    const { result } = await renderHook(() =>
      useCurtidas({ curtidas: 1000, curtidoPorMim: false, criadoEm: chegou(0) }),
    );
    expect(result.current).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(SUBIDA_CURTIDAS_MS);
    });
    expect(result.current).toBe(632);
  });

  it('post antigo mostra o total, e a curtida do jogador entra na hora', async () => {
    const { result } = await renderHook(() =>
      useCurtidas({ curtidas: 41, curtidoPorMim: false, criadoEm: chegou(FIM_SUBIDA_CURTIDAS_MS) }),
    );
    expect(result.current).toBe(41);
    const { result: novo } = await renderHook(() =>
      useCurtidas({ curtidas: 501, curtidoPorMim: true, criadoEm: chegou(0) }),
    );
    expect(novo.current).toBe(1);
  });
});

describe('relógio do mundo', () => {
  afterEach(() => {
    acertarRelogioDoMundo(new Date().toISOString());
  });

  it('conta a idade pela hora do mundo, adiantada pelo relógio de desenvolvimento', async () => {
    const tresDias = 3 * 86_400_000;
    // Post chegou "agora" no mundo, que está três dias à frente do aparelho.
    const { result } = await renderHook(() =>
      useCurtidas({
        curtidas: 1000,
        curtidoPorMim: false,
        criadoEm: chegou(-tresDias + SUBIDA_CURTIDAS_MS),
      }),
    );
    expect(result.current).toBe(0);
    await act(async () => {
      acertarRelogioDoMundo(new Date(agora + tresDias).toISOString());
    });
    expect(result.current).toBe(632);
  });
});
