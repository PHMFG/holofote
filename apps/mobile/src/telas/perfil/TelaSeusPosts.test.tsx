import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { chamadas, simularApi } from '../../testes/api';
import { jogador, mundo, personagem, post } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { TelaSeusPosts } from './TelaSeusPosts';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));
// A FlashList não roda no Jest; a FlatList tem a mesma API para o que a tela usa.
jest.mock('@shopify/flash-list', () => ({
  FlashList: jest.requireActual('react-native').FlatList,
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

const lua = jogador();
const m = mundo({ jogador: lua });
const autor = personagem({ id: lua.id, nome: lua.nome, handle: lua.handle, papel: 'jogador' });
const rotaFeed = `GET /mundos/${m.id}/feed`;

beforeEach(() => jest.clearAllMocks());

describe('Seus posts', () => {
  it('lista os posts do jogador pedindo só os dele, com a contagem no cabeçalho', async () => {
    const itens = ['single novo sexta.', 'ensaio fechado hoje.', 'primeiro post do mundo.'].map(
      (texto) => post({ autor, texto }),
    );
    simularApi({
      'GET /mundos/atual': m,
      [rotaFeed]: { itens, proximoCursor: null, historias: [] },
    });
    await renderizarTela(<TelaSeusPosts />);

    expect(await screen.findByText('primeiro post do mundo.')).toBeTruthy();
    expect(screen.getByText('single novo sexta.')).toBeTruthy();
    expect(screen.getByLabelText('3 posts')).toBeTruthy();
    expect(chamadas.some((c) => c.rota === `/mundos/${m.id}/feed?autor=${lua.id}`)).toBe(true);
  });

  it('sem posts, convida a escrever', async () => {
    simularApi({
      'GET /mundos/atual': m,
      [rotaFeed]: { itens: [], proximoCursor: null, historias: [] },
    });
    await renderizarTela(<TelaSeusPosts />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Escrever um post' }));
    expect(router.push).toHaveBeenCalledWith('/novo-post');
  });
});
