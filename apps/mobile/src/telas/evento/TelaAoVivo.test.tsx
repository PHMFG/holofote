import type { EventoTempoReal } from '@holofote/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import { chaves } from '../../api/consultas';
import { chamadas, simularApi } from '../../testes/api';
import { conta, mundo, post, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { consequencia, eventoAgendado, lua } from './dadosDeTeste';
import { TelaAoVivo } from './TelaAoVivo';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));
const mockOuvinte: { atual?: (evento: EventoTempoReal) => void } = {};
jest.mock('../../api/tempoReal', () => ({
  ...jest.requireActual('../../api/tempoReal'),
  useTempoReal: (fn: (evento: EventoTempoReal) => void) => {
    mockOuvinte.atual = fn;
  },
}));

const AGORA = new Date('2026-10-16T21:00:00Z');
const PRAZO = new Date(AGORA.getTime() + 30_000).toISOString();

const discursoLiberado = [
  { id: 'seguro' as const, titulo: 'Seguro', liberada: true, motivo: null },
  { id: 'ousado' as const, titulo: 'Ousado', liberada: true, motivo: null },
  {
    id: 'especial' as const,
    titulo: 'Especial',
    liberada: false,
    motivo: 'Libere o marco 2 da jornada.',
  },
];
const evento = eventoAgendado({
  estado: 'ao_vivo',
  prazoAoVivo: PRAZO,
  discurso: discursoLiberado,
});
const rota = `/eventos/${evento.id}`;
const reacao = consequencia({
  deltas: [
    { alvo: 'fama', valor: 3 },
    { alvo: 'polemica', valor: 4 },
  ],
  reacoesPendentes: 2,
});

function simular(extras: Record<string, unknown> = {}) {
  let leiturasDaConta = 0;
  simularApi({
    'GET /mundos/atual': mundo(),
    // Antes do discurso a conta tem 40 gemas; relida depois, 65.
    'GET /conta': () => conta({ gemas: leiturasDaConta++ === 0 ? 40 : 65 }),
    [`GET ${rota}`]: evento,
    [`POST ${rota}/discurso`]: () => ({
      evento: { ...evento, estado: 'encerrado', vencedor: lua, prazoAoVivo: null },
      consequencia: reacao,
    }),
    ...extras,
  });
}

const discursos = () =>
  chamadas.filter((c) => c.metodo === 'POST' && c.rota === `${rota}/discurso`);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ now: AGORA });
});
afterEach(() => jest.useRealTimers());

describe('17 · Evento ao vivo', () => {
  it('conta 30 segundos e anuncia o tempo só nos marcos', async () => {
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    simular();
    await renderizarTela(<TelaAoVivo id={evento.id} />);

    expect(await screen.findByText('decida em 0:30')).toBeTruthy();
    expect(screen.getByText('AO VIVO')).toBeTruthy();
    expect(screen.getByText('Revelação do ano')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Subir ao palco' })).toBeDisabled();

    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByText('decida em 0:20')).toBeTruthy();
    expect(anuncio).toHaveBeenCalledWith('Faltam 20 segundos para escolher.');
    // Não anuncia a cada segundo.
    expect(anuncio).toHaveBeenCalledTimes(1);
  });

  it('escolher e subir ao palco manda o discurso e mostra o resultado do motor', async () => {
    simular();
    const { cliente } = await renderizarTela(<TelaAoVivo id={evento.id} />);

    await fireEvent.press(
      await screen.findByRole('radio', {
        name: 'Discurso Ousado, Arrisca mais',
      }),
    );
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Subir ao palco' }));

    expect(await screen.findByText('Você venceu')).toBeTruthy();
    expect(discursos()).toEqual([
      { metodo: 'POST', rota: `${rota}/discurso`, corpo: { opcao: 'ousado' } },
    ]);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(screen.getByLabelText('O prêmio vai para Lua Prado. Revelação do ano')).toBeTruthy();
    expect(screen.getByLabelText('Fama +3')).toBeTruthy();
    expect(screen.getByLabelText('Polêmica +4')).toBeTruthy();
    expect(await screen.findByLabelText('Ganhou 25 gemas')).toBeTruthy();
    expect(screen.getByText('O mundo está reagindo ao seu discurso…')).toBeTruthy();

    // A plateia chega pelo tempo real e o cartão da IA pela consequência.
    await act(async () =>
      mockOuvinte.atual?.({
        tipo: 'post',
        post: post({ id: uuid(), texto: 'orgulho define' }),
      }),
    );
    expect(await screen.findByText(/orgulho define/)).toBeTruthy();
    await act(async () => {
      cliente.setQueryData(chaves.consequencia(reacao.eventoId), {
        ...reacao,
        reacoesPendentes: 0,
        cartao: { titulo: 'Discurso histórico', texto: 'a internet parou para ver.' },
      });
    });
    expect(await screen.findByText('Discurso histórico')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver o feed' }));
    expect(router.dismissTo).toHaveBeenCalledWith('/');
  });

  it('quando o tempo acaba, destaca o seguro e não escolhe sozinho', async () => {
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    simular();
    await renderizarTela(<TelaAoVivo id={evento.id} />);

    await fireEvent.press(await screen.findByRole('radio', { name: /^Discurso Ousado/ }));
    await act(async () => {
      jest.advanceTimersByTime(31_000);
    });

    expect(screen.getByText('tempo esgotado')).toBeTruthy();
    expect(
      screen.getByText('O tempo acabou, mas o discurso seguro continua disponível.'),
    ).toBeTruthy();
    expect(anuncio).toHaveBeenCalledWith('O tempo acabou. O discurso seguro continua disponível.');
    expect(screen.getByLabelText('Discurso Ousado, bloqueado: O tempo acabou.')).toBeTruthy();
    expect(screen.getByText('Disponível')).toBeTruthy();
    // A escolha ousada pendente caiu e nada foi enviado sozinho.
    expect(screen.getByRole('button', { name: 'Subir ao palco' })).toBeDisabled();
    expect(discursos()).toHaveLength(0);

    await fireEvent.press(screen.getByRole('radio', { name: /^Discurso Seguro/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Subir ao palco' }));
    await waitFor(() => expect(discursos()[0]?.corpo).toEqual({ opcao: 'seguro' }));
  });

  it('antes da hora, avisa que o evento ainda não começou', async () => {
    simular({ [`GET ${rota}`]: eventoAgendado({ id: evento.id, estado: 'campanha' }) });
    await renderizarTela(<TelaAoVivo id={evento.id} />);

    expect(
      await screen.findByText('O evento ainda não começou. A campanha continua aberta.'),
    ).toBeTruthy();
  });
});
