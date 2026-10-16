import type { AlertButton } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';
import PostDetalhe from '../../app/post/[id]/index';
import { ErroDaApi } from '../../api/cliente';
import { chaves } from '../../api/consultas';
import { chamadas, simularApi } from '../../testes/api';
import { mundo, personagem, post, uuid } from '../../testes/dados';
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
const duda = rel.nos[1]!.personagem;
const principal = post({
  autor: m.jogador,
  texto: 'single novo sexta. sem feat, sem desculpa.',
  tom: 'provocativo',
  curtidas: 486,
  respostas: 37,
  reposts: 15,
});
const respostas = [vic, duda, rel.nos[2]!.personagem, rel.nos[3]!.personagem].map((autor, i) =>
  post({ autor, respondeA: principal.id, texto: `resposta ${i + 1}`, curtidas: 3 }),
);
const acao = uuid();
const cons = consequencia({
  eventoId: acao,
  deltas: [
    { alvo: 'seguidores', valor: 214 },
    { alvo: `relacao:${vic.id}`, valor: -3 },
    { alvo: 'polemica', valor: 6 },
    { alvo: 'fama', valor: 1.2 },
    { alvo: `relacao:${duda.id}`, valor: 5 },
  ],
});

function simular(rotas: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': m,
    'GET /relacoes': rel,
    [`GET /posts/${principal.id}`]: principal,
    [`GET /posts/${principal.id}/respostas`]: { post: principal, respostas, digitando: [] },
    ...rotas,
  });
}

async function abrir({ comAcao = true } = {}) {
  jest
    .mocked(useLocalSearchParams)
    .mockReturnValue(comAcao ? { id: principal.id, acao } : { id: principal.id });
  const tela = await renderizarTela(<PostDetalhe />);
  await screen.findByText(principal.texto);
  if (comAcao) {
    await act(async () => {
      tela.cliente.setQueryData(chaves.consequencia(acao), cons);
    });
    // O TanStack Query avisa os observadores num setTimeout: espera o cartão aparecer.
    await screen.findByText('Consequência');
  }
  return tela;
}

/** Confirma o Alert de desfazer tocando no botão destrutivo. */
async function confirmarAlerta() {
  const botoes = jest.mocked(Alert.alert).mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => botoes.find((b) => b.style === 'destructive')?.onPress?.());
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('03 · Post e consequências', () => {
  it('mostra o post, os contadores e as primeiras respostas', async () => {
    simular();
    await abrir({ comAcao: false });
    expect(screen.getByText(`${m.jogador.handle} · você`)).toBeTruthy();
    expect(screen.getByRole('button', { name: '37 respostas' })).toBeTruthy();
    expect(screen.getByRole('text', { name: '15 reposts' })).toBeTruthy();
    expect(await screen.findByText('resposta 1')).toBeTruthy();
    expect(screen.getByText('resposta 3')).toBeTruthy();
    expect(screen.queryByText('resposta 4')).toBeNull();
    expect(screen.queryByText('Consequência')).toBeNull();
  });

  it('com a ação na URL, mostra a consequência com nomes e o aviso de reações chegando', async () => {
    simular();
    const { cliente } = await abrir();
    expect(await screen.findByText('Consequência')).toBeTruthy();
    expect(screen.getByText('+214 seguidores')).toBeTruthy();
    expect(screen.getByLabelText('+486 curtidas')).toBeTruthy();
    expect(await screen.findByLabelText('Vic · relação −3%')).toBeTruthy();
    expect(screen.getByLabelText('Duda · relação +5%')).toBeTruthy();
    expect(screen.getByLabelText('Polêmica +6')).toBeTruthy();
    expect(screen.getByLabelText('Fama +1,2')).toBeTruthy();
    expect(
      screen.getByLabelText('As reações estão chegando: 2 personagens estão escrevendo.'),
    ).toBeTruthy();

    // O cartão da IA chega pelo tempo real (api/tempoReal grava no mesmo cache).
    await act(async () => {
      cliente.setQueryData(chaves.consequencia(acao), {
        ...cons,
        cartao: { titulo: 'Indireta lida', texto: 'Os fãs da Vic invadiram a thread.' },
        reacoesPendentes: 0,
      });
    });
    expect(await screen.findByText('Indireta lida')).toBeTruthy();
    expect(screen.getByText('Os fãs da Vic invadiram a thread.')).toBeTruthy();
    expect(screen.queryByText(/As reações estão chegando/)).toBeNull();
  });

  it('desfazer confirma, chama a rota da ação e volta', async () => {
    simular({ [`POST /acoes/${acao}/desfazer`]: consequencia({ eventoId: uuid() }) });
    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer, custa 2 de energia' }));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Desfazer este post?',
      expect.stringContaining('2 de energia'),
      expect.any(Array),
    );
    await confirmarAlerta();
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/acoes/${acao}/desfazer`,
      corpo: undefined,
    });
  });

  it('desfazer sem energia abre a folha 19', async () => {
    simular({
      [`POST /acoes/${acao}/desfazer`]: new ErroDaApi(409, 'sem_energia', 'Sem energia.'),
    });
    await abrir();
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer, custa 2 de energia' }));
    await confirmarAlerta();
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('passado o prazo, o desfazer some', async () => {
    simular();
    const { cliente } = await abrir();
    await act(async () => {
      cliente.setQueryData(chaves.consequencia(acao), {
        ...cons,
        desfazivelAte: new Date(Date.now() - 1000).toISOString(),
      });
    });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Desfazer, custa 2 de energia' })).toBeNull(),
    );
    expect(screen.getByText('Consequência')).toBeTruthy();
  });

  it('curtir o post e abrir todas as respostas', async () => {
    simular({
      [`POST /posts/${principal.id}/curtir`]: { ...principal, curtidoPorMim: true, curtidas: 487 },
    });
    await abrir({ comAcao: false });
    await fireEvent.press(screen.getByRole('button', { name: '486 curtidas' }));
    expect(await screen.findByRole('button', { name: '487 curtidas' })).toBeSelected();
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/posts/${principal.id}/curtir`,
      corpo: undefined,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todas' }));
    expect(router.push).toHaveBeenCalledWith(`/post/${principal.id}/respostas`);
  });

  it('responder pelo compositor manda o texto; sem energia abre a folha', async () => {
    simular({
      [`POST /posts/${principal.id}/respostas`]: new ErroDaApi(409, 'sem_energia', 'Sem energia.'),
    });
    await abrir({ comAcao: false });
    await fireEvent.changeText(screen.getByLabelText('Responder como Lua…'), 'obrigada, gente');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/posts/${principal.id}/respostas`,
      corpo: { texto: 'obrigada, gente' },
    });
  });

  it('post que não existe mais mostra o aviso e volta', async () => {
    simularApi({ 'GET /mundos/atual': m, 'GET /relacoes': rel });
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: uuid() });
    await renderizarTela(<PostDetalhe />);
    expect(await screen.findByText('Este post não está mais aqui.')).toBeTruthy();
    // O último "Voltar" é a ação do cartão (o primeiro é o do cabeçalho).
    await fireEvent.press(screen.getAllByRole('button', { name: 'Voltar' }).at(-1)!);
    expect(router.back).toHaveBeenCalled();
  });

  it('mostra quem está digitando na thread', async () => {
    simular({
      [`GET /posts/${principal.id}/respostas`]: {
        post: principal,
        respostas: [],
        digitando: [personagem({ nome: 'Vic Ferraz', iniciais: 'VF' })],
      },
    });
    await abrir({ comAcao: false });
    expect(await screen.findByLabelText('Vic está digitando')).toBeTruthy();
  });
});
