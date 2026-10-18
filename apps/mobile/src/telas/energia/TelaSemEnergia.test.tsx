import type { Conta, EstadoEnergia, RespostaRecarga } from '@holofote/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { conta, energia } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { DURACAO_ANUNCIO_MS, TelaSemEnergia } from './TelaSemEnergia';
import { msAteRecarga, textoMinutos } from './tempo';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

const AGORA = new Date('2026-10-16T21:00:00Z');
// Próxima unidade em 17 min 30 s: a folha arredonda para cima ("18 min").
const PROXIMA = new Date(AGORA.getTime() + 17.5 * 60_000).toISOString();

const semEnergia: EstadoEnergia = { ...energia(0, 12), proximaEm: PROXIMA };
const cheia = (p: Partial<RespostaRecarga> = {}): RespostaRecarga => ({
  energia: { ...energia(12, 12), proximaEm: null },
  gemas: 30,
  anunciosRestantesHoje: 3,
  ...p,
});

function simular(
  { estado = semEnergia, daConta = {} }: { estado?: EstadoEnergia; daConta?: Partial<Conta> } = {},
  rotas: Record<string, unknown> = {},
) {
  simularApi({
    'GET /energia': estado,
    'GET /conta': conta({ energia: estado, gemas: 40, anunciosRestantesHoje: 2, ...daConta }),
    'POST /energia/recarga': () => cheia(),
    ...rotas,
  });
}

// Nome completo: só existe depois de /conta chegar (antes disso as gemas ficam desabilitadas).
const GEMAS = 'Usar 10 gemas, Enche tudo · você tem 40, 10';

/** Depois da recarga a energia do cache vira a da resposta (cheia) e a conta é relida. */
const recarregada = () => screen.findByRole('header', { name: 'Energia, 12 de 12' });

const recargas = () =>
  chamadas.filter((c) => c.metodo === 'POST' && c.rota === '/energia/recarga').map((c) => c.corpo);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: AGORA,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'hrtime',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
    ],
  });
});
afterEach(() => jest.useRealTimers());

describe('19 · Sem energia', () => {
  it('sem energia: título, próxima carga e as opções do Figma', async () => {
    simular();
    await renderizarTela(<TelaSemEnergia />);

    expect(await screen.findByText('Sua energia acabou')).toBeTruthy();
    expect(screen.getByText(/^A próxima carga chega em 18 min\./)).toBeTruthy();
    expect(
      screen.getByLabelText('Esperar recarga, +1 a cada 20 min · grátis, 18 min'),
    ).toBeTruthy();
    expect(
      await screen.findByRole('button', {
        name: 'Ver um anúncio, +3 de energia · restam 2 hoje, +3',
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Usar 10 gemas, Enche tudo · você tem 40, 10' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Holofote Plus, Energia em dobro e sem anúncios' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Recarregar \(debug\)/ })).toBeEnabled();
    // Esperar só informa: não é botão.
    expect(screen.queryByRole('button', { name: /^Esperar recarga/ })).toBeNull();
  });

  it('com energia: "Energia" e "atual de max"', async () => {
    simular({ estado: { ...energia(8, 12), proximaEm: PROXIMA } });
    await renderizarTela(<TelaSemEnergia />);
    expect(await screen.findByText('8 de 12')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Energia, 8 de 12' })).toBeTruthy();
    expect(screen.queryByText('Sua energia acabou')).toBeNull();
  });

  it('usar 10 gemas chama a recarga por gemas, vibra, enche a barra e só então fecha', async () => {
    simular();
    await renderizarTela(<TelaSemEnergia />);

    await fireEvent.press(await screen.findByRole('button', { name: GEMAS }));
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith('success'));
    expect(recargas()).toEqual([{ via: 'gemas' }]);
    // A folha fica aberta enquanto a energia enche e nada mais recarrega.
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /^Usar 10 gemas/ })).toBeDisabled();
    expect(screen.getByRole('progressbar', { name: 'Energia' })).toBeTruthy();
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await recarregada();
  });

  it('gemas desabilitado com menos de 10 gemas', async () => {
    simular({ daConta: { gemas: 4 } });
    await renderizarTela(<TelaSemEnergia />);

    const botao = await screen.findByRole('button', {
      name: 'Usar 10 gemas, Enche tudo · você tem 4, 10',
    });
    expect(botao).toBeDisabled();
    await fireEvent.press(botao);
    expect(recargas()).toEqual([]);
  });

  it(
    'anúncio simulado: assiste por 2 s e depois recarrega por anúncio',
    async () => {
      simular();
      await renderizarTela(<TelaSemEnergia />);

      await fireEvent.press(
        await screen.findByRole('button', {
          name: 'Ver um anúncio, +3 de energia · restam 2 hoje, +3',
        }),
      );
      expect(await screen.findByText('Assistindo anúncio…')).toBeTruthy();
      // Durante o anúncio, nada mais recarrega.
      expect(screen.getByRole('button', { name: /^Usar 10 gemas/ })).toBeDisabled();
      expect(recargas()).toEqual([]);

      await waitFor(() => expect(recargas()).toEqual([{ via: 'anuncio' }]), {
        timeout: DURACAO_ANUNCIO_MS + 1500,
      });
      await waitFor(() => expect(router.back).toHaveBeenCalled(), { timeout: 3000 });
      await recarregada();
    },
    DURACAO_ANUNCIO_MS + 7000,
  );

  it(
    'toque duplo no anúncio recarrega uma vez só e trava Plus e gemas até terminar',
    async () => {
      simular();
      await renderizarTela(<TelaSemEnergia />);
      const anuncio = await screen.findByRole('button', {
        name: 'Ver um anúncio, +3 de energia · restam 2 hoje, +3',
      });
      await fireEvent.press(anuncio);
      await fireEvent.press(anuncio);
      expect(await screen.findByText('Assistindo anúncio…')).toBeTruthy();
      expect(screen.getByRole('button', { name: /^Holofote Plus/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^Usar 10 gemas/ })).toBeDisabled();
      expect(screen.getByRole('button', { name: /^Recarregar \(debug\)/ })).toBeDisabled();

      await waitFor(() => expect(recargas()).toEqual([{ via: 'anuncio' }]), {
        timeout: DURACAO_ANUNCIO_MS + 1500,
      });
      expect(router.push).not.toHaveBeenCalled();
      await recarregada();
    },
    DURACAO_ANUNCIO_MS + 4000,
  );

  it(
    'sair da folha durante o anúncio cancela a recarga',
    async () => {
      simular();
      const { unmount } = await renderizarTela(<TelaSemEnergia />);
      await fireEvent.press(
        await screen.findByRole('button', { name: /^Ver um anúncio, \+3 de energia · restam 2/ }),
      );
      await unmount();
      await act(
        () => new Promise<void>((resolver) => setTimeout(resolver, DURACAO_ANUNCIO_MS + 200)),
      );
      expect(recargas()).toEqual([]);
      expect(router.back).not.toHaveBeenCalled();
    },
    DURACAO_ANUNCIO_MS + 4000,
  );

  it('antes de /conta chegar, o anúncio diz "Carregando…" e não "volta amanhã"', async () => {
    simular({}, { 'GET /conta': () => new Promise(() => {}) });
    await renderizarTela(<TelaSemEnergia />);
    const anuncio = await screen.findByRole('button', { name: 'Ver um anúncio, Carregando…' });
    expect(anuncio).toBeDisabled();
    expect(screen.queryByText(/volta amanhã/)).toBeNull();
  });

  it('com o relógio do aparelho adiantado, não congela em "1 min"', async () => {
    simular({
      estado: { ...semEnergia, proximaEm: new Date(AGORA.getTime() - 5 * 60_000).toISOString() },
    });
    await renderizarTela(<TelaSemEnergia />);
    expect(await screen.findByText(/^A próxima carga chega em instantes\./)).toBeTruthy();
    expect(screen.queryByText(/1 min/)).toBeNull();
  });

  it('anúncios do dia esgotados deixam a opção desabilitada', async () => {
    simular({ daConta: { anunciosRestantesHoje: 0 } });
    await renderizarTela(<TelaSemEnergia />);
    expect(
      await screen.findByRole('button', {
        name: 'Ver um anúncio, +3 de energia · volta amanhã, +3',
      }),
    ).toBeDisabled();
  });

  it('no Plus o anúncio e a oferta do Plus somem', async () => {
    const plus: EstadoEnergia = { ...energia(0, 24, 'plus'), proximaEm: PROXIMA };
    simular({ estado: plus, daConta: { plano: 'plus' } });
    await renderizarTela(<TelaSemEnergia />);
    expect(await screen.findByText('+1 a cada 10 min · grátis')).toBeTruthy();
    expect(screen.queryByText('Ver um anúncio')).toBeNull();
    expect(screen.queryByText('Holofote Plus')).toBeNull();
  });

  it('recarregar (debug) chama a rota com via debug', async () => {
    simular();
    await renderizarTela(<TelaSemEnergia />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Recarregar \(debug\)/ }));
    await waitFor(() => expect(recargas()).toEqual([{ via: 'debug' }]));
    await waitFor(() => expect(router.back).toHaveBeenCalled(), { timeout: 3000 });
    await recarregada();
  });

  it('Holofote Plus abre a tela 11 e "Agora não" fecha', async () => {
    simular();
    await renderizarTela(<TelaSemEnergia />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Holofote Plus/ }));
    expect(router.push).toHaveBeenCalledWith('/plus');
    await fireEvent.press(screen.getByRole('button', { name: 'Agora não' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('erro da recarga explica o motivo e não fecha', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simular(
      {},
      {
        'POST /energia/recarga': new ErroDaApi(409, 'sem_gemas', 'Você não tem gemas suficientes.'),
      },
    );
    await renderizarTela(<TelaSemEnergia />);
    await fireEvent.press(await screen.findByRole('button', { name: GEMAS }));
    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith('Não deu certo', 'Você não tem gemas suficientes.'),
    );
    expect(router.back).not.toHaveBeenCalled();
    // A mutação termina e as gemas voltam a ficar disponíveis.
    await waitFor(() => expect(screen.getByRole('button', { name: GEMAS })).toBeEnabled());
  });

  it('barra cheia: gemas e anúncio desabilitados, debug continua', async () => {
    simular({ estado: { ...energia(12, 12), proximaEm: null } });
    await renderizarTela(<TelaSemEnergia />);
    expect(await screen.findByText(/Sua barra está cheia/)).toBeTruthy();
    expect(screen.getByText(/desfazer custa 2/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Usar 10 gemas/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Ver um anúncio/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Recarregar \(debug\)/ })).toBeEnabled();
  });
});

describe('contagem da recarga', () => {
  it('arredonda para cima e some com a barra cheia', () => {
    const agora = AGORA.getTime();
    expect(textoMinutos(msAteRecarga(PROXIMA, agora)!)).toBe('18 min');
    expect(textoMinutos(20_000)).toBe('1 min');
    expect(msAteRecarga(null, agora)).toBeNull();
  });
});
