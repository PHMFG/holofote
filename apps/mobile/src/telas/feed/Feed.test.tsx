import type { Jornada, RespostaFeed } from '@holofote/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import Feed from '../../app/(abas)/index';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { conta, energia, mundo, personagem, post, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { ehPostNovoDoFeed, rotuloNovosPosts } from './novosPosts';

jest.mock('../../api/cliente', () =>
  jest.requireActual<typeof import('../../testes/api')>('../../testes/api').moduloClienteSimulado(),
);
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
}));
// O dist do FlashList é ESM e o jest.config não o transforma; no teste a lista vira um FlatList,
// que aceita as mesmas props usadas na tela (dados, cabeçalho, paginação, puxar para atualizar).
jest.mock('@shopify/flash-list', () => ({
  FlashList: jest.requireActual('react-native').FlatList,
}));

const m = mundo({ dia: 6, periodo: 'noite' });
const vic = personagem({ nome: 'Vic Ferraz', handle: '@vicferraz', iniciais: 'VF' });
const duda = personagem({
  nome: 'Duda Marques',
  handle: '@dudamarques',
  iniciais: 'DM',
  verificado: false,
});
const p1 = post({
  autor: vic,
  texto: 'primeiro ensaio da turnê',
  curtidas: 41,
  curtidoPorMim: false,
});
const p2 = post({ autor: duda, texto: 'alguém viu o figurino novo?', curtidas: 7 });

const historiaDaVic = uuid();
const historiaDaDuda = uuid();
const eventoId = uuid();

const respostaFeed = (p: Partial<RespostaFeed> = {}): RespostaFeed => ({
  itens: [p1, p2],
  proximoCursor: null,
  historias: [
    { id: historiaDaVic, autor: vic, vista: false },
    { id: historiaDaDuda, autor: duda, vista: true },
  ],
  ...p,
});

const jornada = (p: Partial<Jornada> = {}): Jornada => ({
  ato: 1,
  objetivo: 'Dominar o pop nacional',
  progressoAto: 0.2,
  marcos: [],
  proximoEvento: {
    id: eventoId,
    titulo: 'Prêmio Holofote',
    quando: { dia: 8, periodo: 'noite' },
    estado: 'anunciado',
  },
  ...p,
});

function simular(rotas: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': m,
    [`GET /mundos/${m.id}/feed`]: respostaFeed(),
    'GET /jornada': jornada(),
    'GET /conta': conta(),
    'GET /energia': energia(8, 12),
    ...rotas,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('02 · Feed', () => {
  it('mostra o dia, as histórias, o próximo evento e os posts', async () => {
    simular();
    await renderizarTela(<Feed />);
    expect(await screen.findByText('primeiro ensaio da turnê')).toBeTruthy();
    expect(screen.getByText('alguém viu o figurino novo?')).toBeTruthy();
    expect(screen.getByLabelText('Dia 6, noite')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'História de Vic Ferraz, nova' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'História de Duda Marques' })).toBeTruthy();
    expect(await screen.findByText('Prêmio Holofote em 2 dias')).toBeTruthy();
  });

  it('navega para o post, as respostas, o perfil, a história, o evento e o novo post', async () => {
    simular();
    await renderizarTela(<Feed />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Vic Ferraz, verificado/ }));
    expect(router.push).toHaveBeenCalledWith(`/post/${p1.id}`);
    await fireEvent.press(screen.getAllByRole('button', { name: '12 respostas' })[0]!);
    expect(router.push).toHaveBeenCalledWith(`/post/${p1.id}/respostas`);
    await fireEvent.press(screen.getByRole('button', { name: 'Perfil de Vic Ferraz' }));
    expect(router.push).toHaveBeenCalledWith(`/personagem/${vic.id}`);
    await fireEvent.press(screen.getByRole('button', { name: 'História de Vic Ferraz, nova' }));
    expect(router.push).toHaveBeenLastCalledWith(`/historia/${historiaDaVic}`);
    await fireEvent.press(screen.getByRole('button', { name: 'História de Duda Marques' }));
    expect(router.push).toHaveBeenLastCalledWith(`/historia/${historiaDaDuda}`);
    await fireEvent.press(
      await screen.findByRole('button', { name: /^Prêmio Holofote em 2 dias/ }),
    );
    expect(router.push).toHaveBeenLastCalledWith(`/evento/${eventoId}`);
    const novoPost = screen.getAllByRole('button', { name: 'Novo post' });
    await fireEvent.press(novoPost[novoPost.length - 1]!);
    expect(router.push).toHaveBeenLastCalledWith('/novo-post');
  });

  it('curtir é otimista, vibra leve e chama a rota de curtir', async () => {
    simular({ [`POST /posts/${p1.id}/curtir`]: { ...p1, curtidoPorMim: true, curtidas: 42 } });
    await renderizarTela(<Feed />);
    await fireEvent.press(await screen.findByRole('button', { name: '41 curtidas' }));
    expect(await screen.findByRole('button', { name: '42 curtidas' })).toBeSelected();
    expect(Haptics.impactAsync).toHaveBeenCalledWith('light');
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/posts/${p1.id}/curtir`,
      corpo: undefined,
    });
  });

  it('curtir com erro avisa e desfaz a curtida otimista', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simular({ [`POST /posts/${p1.id}/curtir`]: () => new ErroDaApi(500, 'interno', 'Falhou.') });
    await renderizarTela(<Feed />);
    await fireEvent.press(await screen.findByRole('button', { name: '41 curtidas' }));

    await waitFor(() => expect(alerta).toHaveBeenCalledWith('Não deu certo', 'Falhou.'));
    const curtir = await screen.findByRole('button', { name: '41 curtidas' });
    expect(curtir).not.toBeSelected();
    expect(screen.queryByRole('button', { name: '42 curtidas' })).toBeNull();
  });

  it('feed vazio convida a escrever o primeiro post', async () => {
    simular({ [`GET /mundos/${m.id}/feed`]: respostaFeed({ itens: [], historias: [] }) });
    await renderizarTela(<Feed />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Escrever um post' }));
    expect(router.push).toHaveBeenCalledWith('/novo-post');
  });

  it('erro ao carregar mostra o cartão com tentar de novo', async () => {
    simular({
      [`GET /mundos/${m.id}/feed`]: new ErroDaApi(500, 'interno', 'falhou'),
    });
    await renderizarTela(<Feed />);
    expect(await screen.findByText('Não deu para carregar o feed.')).toBeTruthy();
    simular();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('primeiro ensaio da turnê')).toBeTruthy();
  });

  it('sem evento agendado, não mostra o banner', async () => {
    simular({ 'GET /jornada': jornada({ proximoEvento: null }) });
    await renderizarTela(<Feed />);
    await screen.findByText('primeiro ensaio da turnê');
    expect(screen.queryByText(/Prêmio Holofote/)).toBeNull();
  });
});

describe('novos posts pelo tempo real', () => {
  it('conta só posts de primeiro nível de outros personagens', () => {
    expect(ehPostNovoDoFeed({ tipo: 'post', post: post() })).toBe(true);
    expect(ehPostNovoDoFeed({ tipo: 'post', post: post({ respondeA: uuid() }) })).toBe(false);
    expect(ehPostNovoDoFeed({ tipo: 'post', post: post({ tipo: 'historia' }) })).toBe(false);
    expect(
      ehPostNovoDoFeed({ tipo: 'post', post: post({ autor: personagem({ papel: 'jogador' }) }) }),
    ).toBe(false);
    expect(ehPostNovoDoFeed({ tipo: 'energia', energia: energia() })).toBe(false);
  });

  it('rótulo no singular e no plural', () => {
    expect(rotuloNovosPosts(1)).toBe('1 novo post');
    expect(rotuloNovosPosts(3)).toBe('3 novos posts');
  });
});
