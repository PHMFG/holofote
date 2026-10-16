import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ErroDaApi } from '../../api/cliente';
import { armazenamento } from '../../estado/armazenamento';
import { useAparencia } from '../../estado/aparencia';
import { chamadas, simularApi } from '../../testes/api';
import { conta, mundo } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { useAjustes } from './ajustes';
import { TelaAparencia } from './TelaAparencia';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
}));

const patches = () => chamadas.filter((c) => c.metodo === 'PATCH' && c.rota === '/conta/aparencia');

function simular(extras: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': mundo(),
    'PATCH /conta/aparencia': (corpo: unknown) =>
      conta({ aparencia: corpo as { tema: 'claro'; destaque: 'laranja' } }),
    ...extras,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useAjustes.setState({ reduzirAnimacoes: false });
});

describe('10 · Aparência', () => {
  it('mostra a prévia, o tema e as seis cores com nome', async () => {
    simular();
    await renderizarTela(<TelaAparencia />);

    expect(
      await screen.findByLabelText(
        'Prévia do destaque Laranja no tema claro: barra de progresso, chip, link e botão principal.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Claro' }).props.accessibilityState).toEqual({
      checked: true,
    });
    for (const nome of ['Laranja', 'Cobalto', 'Violeta', 'Rosa', 'Menta', 'Lima']) {
      expect(screen.getByRole('radio', { name: nome })).toBeTruthy();
    }
    expect(screen.getByRole('radio', { name: 'Laranja' }).props.accessibilityState).toEqual({
      checked: true,
    });
  });

  it('trocar o tema vale na hora e salva na conta', async () => {
    simular();
    await renderizarTela(<TelaAparencia />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Escuro' }));

    expect(useAparencia.getState().tema).toBe('escuro');
    await waitFor(() =>
      expect(patches()).toEqual([
        {
          metodo: 'PATCH',
          rota: '/conta/aparencia',
          corpo: { tema: 'escuro', destaque: 'laranja' },
        },
      ]),
    );
    expect(
      screen.getByLabelText(
        'Prévia do destaque Laranja no tema escuro: barra de progresso, chip, link e botão principal.',
      ),
    ).toBeTruthy();
  });

  it('trocar o destaque muda a cor na hora e salva na conta', async () => {
    simular();
    await renderizarTela(<TelaAparencia />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Menta' }));

    expect(useAparencia.getState().destaque).toBe('menta');
    expect(screen.getByRole('radio', { name: 'Menta' }).props.accessibilityState).toEqual({
      checked: true,
    });
    await waitFor(() =>
      expect(patches().at(-1)?.corpo).toEqual({ tema: 'claro', destaque: 'menta' }),
    );
  });

  it('sem rede, a mudança fica no aparelho e avisa', async () => {
    simular({
      'PATCH /conta/aparencia': () => new ErroDaApi(503, 'desconhecido', 'Fora do ar.'),
    });
    await renderizarTela(<TelaAparencia />);

    await fireEvent.press(await screen.findByRole('radio', { name: 'Rosa' }));

    expect(useAparencia.getState().destaque).toBe('rosa');
    expect(
      await screen.findByText(
        'Salvo só neste aparelho por enquanto. A conta atualiza na próxima mudança.',
      ),
    ).toBeTruthy();
  });

  it('reduzir animações liga e fica guardado no MMKV', async () => {
    simular();
    await renderizarTela(<TelaAparencia />);

    const interruptor = await screen.findByRole('switch', { name: 'Reduzir animações' });
    expect(interruptor.props.accessibilityState).toEqual({ checked: false, disabled: false });
    await fireEvent.press(interruptor);

    expect(useAjustes.getState().reduzirAnimacoes).toBe(true);
    expect(JSON.parse(armazenamento.getString('ajustes') ?? '{}').state).toEqual({
      reduzirAnimacoes: true,
    });
    expect(
      screen.getByRole('switch', { name: 'Reduzir animações' }).props.accessibilityState,
    ).toEqual({ checked: true, disabled: false });
  });
});
