import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import NovoPost from '../../app/novo-post';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { mundo, post } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { consequencia, relacoes } from './dadosDeTeste';

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

const m = mundo();
const rel = relacoes();
const vic = rel.nos[0]!.personagem;
const publicado = post({ autor: m.jogador, texto: 'single novo sexta' });
const cons = consequencia();

const previa = (corpo: unknown) => {
  const { marcados } = corpo as { marcados: string[] };
  return {
    custo: 1,
    alcance: [2100, 3400],
    seguidores: [21, 68],
    polemica: [4, 8],
    relacoes: marcados.map((id) => ({
      personagem: rel.nos.find((n) => n.personagem.id === id)!.personagem,
      afinidade: [-5, -2],
    })),
  };
};

function simular(rotas: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': m,
    'GET /relacoes': rel,
    'POST /posts/previa': previa,
    'POST /posts': { post: publicado, consequencia: cons },
    ...rotas,
  });
}

/** Abre o compositor e espera o elenco (GET /relacoes) para não sobrar atualização pendente. */
async function abrir() {
  await renderizarTela(<NovoPost />);
  await screen.findByRole('checkbox', { name: 'Vic Ferraz' });
}

const escrever = (texto: string) => fireEvent.changeText(screen.getByLabelText('Seu post'), texto);
const corpos = (rota: string) => chamadas.filter((c) => c.rota === rota).map((c) => c.corpo);

beforeEach(() => jest.clearAllMocks());

describe('12 · Novo post', () => {
  it('mostra o autor, os tons, o elenco para marcar e a prévia vazia', async () => {
    simular();
    await abrir();
    expect(await screen.findByText(m.jogador.nome)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'Sincero' })).toBeChecked();
    expect(await screen.findByRole('checkbox', { name: 'Vic Ferraz' })).toBeTruthy();
    // Figurante não entra na lista de marcar.
    expect(screen.queryByRole('checkbox', { name: 'fofocalizei' })).toBeNull();
    expect(screen.getByText('Escreva para ver a prévia')).toBeTruthy();
    expect(screen.getByText('0/280')).toBeTruthy();
  });

  it('pede a prévia do motor depois de digitar e mostra as faixas', async () => {
    simular();
    await abrir();
    await escrever('single novo sexta');
    expect(await screen.findByText('Alcance provável: 2,1 mil a 3,4 mil pessoas')).toBeTruthy();
    expect(corpos('/posts/previa')).toEqual([
      { texto: 'single novo sexta', tom: 'sincero', marcados: [] },
    ]);
    expect(screen.getByLabelText('Seguidores: +21 a +68')).toBeTruthy();
    expect(screen.getByLabelText('Polêmica: +4 a +8')).toBeTruthy();
    expect(screen.getByText('17/280')).toBeTruthy();
  });

  it('publica com tom e marcados, vibra e abre o post com a consequência', async () => {
    simular();
    await abrir();
    await escrever('  single novo sexta  ');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Provocativo' }));
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Vic Ferraz' }));
    expect(await screen.findByLabelText('Vic · relação: −5 a −2%')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Publicar · 1 energia' }));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/post/${publicado.id}?acao=${cons.eventoId}`),
    );
    expect(corpos('/posts')).toEqual([
      { texto: 'single novo sexta', tom: 'provocativo', marcados: [vic.id] },
    ]);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('marca no máximo 3 personagens', async () => {
    simular();
    await abrir();
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    for (const nome of ['Vic Ferraz', 'Duda Marques', 'Bento Lima', 'Nina Alves']) {
      await fireEvent.press(await screen.findByRole('checkbox', { name: nome }));
    }
    expect(screen.getByRole('checkbox', { name: 'Bento Lima' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Nina Alves' })).not.toBeChecked();
    expect(screen.getByText('3 de 3')).toBeTruthy();
    expect(anuncio).toHaveBeenCalledWith('Dá para marcar até 3 personagens.');
  });

  it('sem texto, publicar fica desabilitado', async () => {
    simular();
    await abrir();
    const publicar = screen.getByRole('button', { name: 'Publicar · 1 energia' });
    expect(publicar).toBeDisabled();
    await fireEvent.press(publicar);
    expect(corpos('/posts')).toEqual([]);
  });

  it('sem energia abre a folha 19 e não sai do compositor', async () => {
    simular({ 'POST /posts': new ErroDaApi(409, 'sem_energia', 'Sem energia.') });
    await abrir();
    await escrever('single novo sexta');
    await fireEvent.press(screen.getByRole('button', { name: 'Publicar · 1 energia' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('prévia com erro não impede publicar', async () => {
    simular({ 'POST /posts/previa': new ErroDaApi(500, 'interno', 'falhou') });
    await abrir();
    await escrever('single novo sexta');
    expect(await screen.findByText('Prévia indisponível agora')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Publicar · 1 energia' })).toBeEnabled();
  });
});
