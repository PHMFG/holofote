import type { Marco } from '@holofote/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { conta } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { jornada, marcosDoAto } from '../jornada/dadosDeTeste';
import { TelaMarco } from './TelaMarco';

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

/** Ato com o marco 2 liberado; `resgatado` decide se as recompensas já foram pegas. */
function atoComMarco2Liberado(resgatado: boolean): Marco[] {
  const marcos = marcosDoAto();
  marcos[1] = {
    ...marcos[1]!,
    estado: 'concluido',
    descricao: 'Ingressos esgotados em 4 minutos. A cidade inteira está falando de você.',
    liberadoEm: '2026-10-16T20:00:00Z',
    resgatado,
  };
  marcos[2] = { ...marcos[2]!, estado: 'atual' };
  return marcos;
}

function simular(marcos: Marco[], rotas: Record<string, unknown> = {}) {
  simularApi({
    'GET /jornada': jornada({ marcos }),
    [`POST /marcos/${marcos[1]!.id}/resgatar`]: conta({ gemas: 65 }),
    ...rotas,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('18 · Marco liberado', () => {
  it('mostra o marco, as recompensas e o próximo marco', async () => {
    const marcos = atoComMarco2Liberado(false);
    simular(marcos);
    await renderizarTela(<TelaMarco id={marcos[1]!.id} />);

    expect(await screen.findByText('Marco 2 de 5 · liberado')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Primeiro show lotado' })).toBeTruthy();
    expect(screen.getByText(/^Ingressos esgotados em 4 minutos/)).toBeTruthy();
    expect(screen.getByLabelText('Gemas: +25')).toBeTruthy();
    expect(screen.getByLabelText('Novo no elenco: 1 personagem')).toBeTruthy();
    expect(screen.getByLabelText('Ação liberada: Anunciar a turnê')).toBeTruthy();
    expect(screen.getByLabelText('Energia: recarga completa')).toBeTruthy();
    expect(screen.getByText('Próximo: Primeiro feat')).toBeTruthy();
  });

  it('resgatar chama a rota, vibra com sucesso e fecha', async () => {
    const marcos = atoComMarco2Liberado(false);
    simular(marcos);
    await renderizarTela(<TelaMarco id={marcos[1]!.id} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Resgatar recompensas' }));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/marcos/${marcos[1]!.id}/resgatar`,
      corpo: undefined,
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    // A mutação termina e o botão volta ao rótulo normal (o modal real já fechou).
    await screen.findByRole('button', { name: 'Resgatar recompensas' });
  });

  it('já resgatado mostra o aviso e um botão para fechar', async () => {
    const marcos = atoComMarco2Liberado(true);
    simular(marcos);
    await renderizarTela(<TelaMarco id={marcos[1]!.id} />);

    expect(await screen.findByText('Recompensas resgatadas')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resgatar recompensas' })).toBeNull();
    const fechar = screen.getAllByRole('button', { name: 'Fechar' });
    await fireEvent.press(fechar[fechar.length - 1]!);
    expect(router.back).toHaveBeenCalled();
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('marco já resgatado (marco_resgatado) vira "Recompensas resgatadas", sem alerta', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const aberto = atoComMarco2Liberado(false);
    const resgatado = aberto.map((m, i) => (i === 1 ? { ...m, resgatado: true } : m));
    let leituras = 0;
    simular(aberto, {
      'GET /jornada': () => jornada({ marcos: ++leituras === 1 ? aberto : resgatado }),
      [`POST /marcos/${aberto[1]!.id}/resgatar`]: new ErroDaApi(
        409,
        'marco_resgatado',
        'Você já resgatou esse marco.',
      ),
    });
    await renderizarTela(<TelaMarco id={aberto[1]!.id} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Resgatar recompensas' }));
    expect(await screen.findByText('Recompensas resgatadas')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resgatar recompensas' })).toBeNull();
    expect(alerta).not.toHaveBeenCalled();
    expect(leituras).toBe(2);
  });

  it('outro erro ao resgatar explica o motivo e não fecha', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const marcos = atoComMarco2Liberado(false);
    simular(marcos, {
      [`POST /marcos/${marcos[1]!.id}/resgatar`]: new ErroDaApi(500, 'interno', 'Algo deu errado.'),
    });
    await renderizarTela(<TelaMarco id={marcos[1]!.id} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Resgatar recompensas' }));
    await waitFor(() => expect(alerta).toHaveBeenCalledWith('Não deu certo', 'Algo deu errado.'));
    expect(router.back).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Resgatar recompensas' })).toBeEnabled();
  });

  it('marco ainda bloqueado não deixa resgatar', async () => {
    const marcos = marcosDoAto();
    simular(marcos);
    await renderizarTela(<TelaMarco id={marcos[2]!.id} />);
    expect(await screen.findByText('Este marco ainda não foi liberado.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Resgatar recompensas' })).toBeNull();
  });

  it('erro ao carregar mostra o cartão com tentar de novo', async () => {
    simularApi({ 'GET /jornada': new ErroDaApi(500, 'interno', 'falhou') });
    await renderizarTela(<TelaMarco id="00000000-0000-4000-8000-000000000000" />);
    expect(await screen.findByText('Não deu para abrir o marco.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });
});
