import type { Post } from '@holofote/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { aplicarNoCache, useDigitando } from '../../api/tempoReal';
import { chamadas, simularApi } from '../../testes/api';
import { energia, mundo, personagem, post, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { montarArvore } from './arvore';
import { TelaRespostas } from './TelaRespostas';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
}));
// Duas horas antes de tudo: as curtidas já terminaram de subir (packages/engine, curtidas.ts).
const antes = (minutos: number) => new Date(Date.now() - (120 + minutos) * 60_000).toISOString();

const lua = personagem({
  nome: 'Lua Prado',
  handle: '@luaprado',
  iniciais: 'LP',
  papel: 'jogador',
});
const vic = personagem();
const duda = personagem({ nome: 'Duda Marques', handle: '@dudamarques', iniciais: 'DM' });
const bento = personagem({ nome: 'Bento Lima', handle: '@bentolima', iniciais: 'BL' });
const fofoca = personagem({
  nome: 'fofocalizei',
  handle: '@fofocalizei',
  iniciais: 'FO',
  papel: 'figurante',
  verificado: false,
});

const original = post({ autor: lua, texto: 'single novo sexta. sem feat, sem desculpa.' });
const deVic = post({
  autor: vic,
  respondeA: original.id,
  texto: 'sem feat porque ninguém topou?',
  curtidas: 88,
  respostas: 3,
  reposts: 3,
  criadoEm: antes(2),
});
const deDuda = post({
  autor: duda,
  respondeA: deVic.id,
  texto: 'ninguém topou porque ela não precisou.',
  curtidas: 41,
  criadoEm: antes(1.5),
});
const deBento = post({
  autor: bento,
  respondeA: deVic.id,
  texto: 'a setlist já está pronta.',
  curtidas: 2,
  criadoEm: antes(1.2),
});
// Resposta a uma resposta aninhada: sobe para o comentário de primeiro nível.
const deVicDeNovo = post({
  autor: vic,
  respondeA: deDuda.id,
  texto: 'precisou sim.',
  curtidas: 1,
  criadoEm: antes(1),
});
const deFofoca = post({
  autor: fofoca,
  respondeA: original.id,
  texto: 'print salvo. só dizendo.',
  curtidas: 230,
  respostas: 0,
  reposts: 0,
  criadoEm: antes(3),
});

const thread = (respostas: Post[] = [deVic, deDuda, deBento, deVicDeNovo, deFofoca]) => ({
  post: original,
  respostas,
  digitando: [],
});

const consequencia = () => ({
  eventoId: uuid(),
  deltas: [],
  seguidoresGanhos: 0,
  curtidasSimuladas: 0,
  cartao: null,
  reacoesPendentes: 1,
  energia: energia(7),
  marcoLiberado: null,
  desfazivelAte: null,
});

const rotaThread = `GET /posts/${original.id}/respostas`;

function simular(extras: Record<string, unknown> = {}) {
  simularApi({ 'GET /mundos/atual': mundo(), [rotaThread]: thread(), ...extras });
}

const textosDeComentario = () =>
  screen
    .getAllByText(/^(sem feat porque ninguém topou\?|print salvo\. só dizendo\.)$/)
    .map((n) => n.props.children);

beforeEach(() => {
  jest.clearAllMocks();
  useDigitando.setState({ porAlvo: {} });
});

describe('montarArvore', () => {
  it('põe respostas a respostas embaixo do comentário de primeiro nível, em ordem de chegada', () => {
    const arvore = montarArvore(original.id, [deVicDeNovo, deFofoca, deBento, deDuda, deVic]);
    const doVic = arvore.find((n) => n.resposta.id === deVic.id);
    expect(arvore).toHaveLength(2);
    expect(doVic?.filhas.map((f) => f.id)).toEqual([deDuda.id, deBento.id, deVicDeNovo.id]);
  });
});

describe('13 · Respostas', () => {
  it('mostra o post original, a contagem e a conversa por relevância', async () => {
    simular();
    await renderizarTela(<TelaRespostas postId={original.id} />);

    expect(await screen.findByText('single novo sexta. sem feat, sem desculpa.')).toBeTruthy();
    expect(screen.getByLabelText('5 respostas')).toBeTruthy();
    expect(textosDeComentario()).toEqual([
      'print salvo. só dizendo.',
      'sem feat porque ninguém topou?',
    ]);
    expect(screen.getByPlaceholderText('Responder como Lua…')).toBeTruthy();
  });

  it('mostra as últimas respostas de cada comentário e as anteriores em "Ver"', async () => {
    simular();
    await renderizarTela(<TelaRespostas postId={original.id} />);

    expect(await screen.findByText('a setlist já está pronta.')).toBeTruthy();
    expect(screen.getByText('precisou sim.')).toBeTruthy();
    // Vic responde a Duda, não ao comentário de cima: a marca diz para quem é.
    expect(screen.getByText('para @dudamarques')).toBeTruthy();
    expect(screen.queryByText('ninguém topou porque ela não precisou.')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver 1 resposta anterior' }));
    expect(screen.getByText('ninguém topou porque ela não precisou.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /anterior/ })).toBeNull();
  });

  it('filtra por recentes e pelo elenco', async () => {
    simular();
    await renderizarTela(<TelaRespostas postId={original.id} />);
    await screen.findByText('print salvo. só dizendo.');

    await fireEvent.press(screen.getByRole('radio', { name: 'Recentes' }));
    expect(textosDeComentario()).toEqual([
      'sem feat porque ninguém topou?',
      'print salvo. só dizendo.',
    ]);

    await fireEvent.press(screen.getByRole('radio', { name: 'Elenco' }));
    expect(textosDeComentario()).toEqual(['sem feat porque ninguém topou?']);
  });

  it('responde ao post com a rota e o corpo certos', async () => {
    simular({
      [`POST /posts/${original.id}/respostas`]: (corpo: unknown) => ({
        post: post({
          autor: lua,
          respondeA: original.id,
          texto: (corpo as { texto: string }).texto,
        }),
        consequencia: consequencia(),
      }),
    });
    await renderizarTela(<TelaRespostas postId={original.id} />);

    await fireEvent.changeText(
      await screen.findByLabelText('Responder como Lua…'),
      '  a turnê vem  ',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));

    await waitFor(() =>
      expect(chamadas).toContainEqual({
        metodo: 'POST',
        rota: `/posts/${original.id}/respostas`,
        corpo: { texto: 'a turnê vem' },
      }),
    );
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith('success'));
  });

  it('responde a um comentário pelo "Responder" e pode cancelar', async () => {
    simular({
      [`POST /posts/${deFofoca.id}/respostas`]: () => ({
        post: post({ autor: lua, respondeA: deFofoca.id }),
        consequencia: consequencia(),
      }),
    });
    await renderizarTela(<TelaRespostas postId={original.id} />);
    await screen.findByText('print salvo. só dizendo.');

    // Por relevância, o primeiro "Responder" é o da fofocalizei.
    await fireEvent.press(screen.getAllByRole('button', { name: /^Responder a / })[0]!);
    expect(screen.getByText('Respondendo a @fofocalizei')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Responder como Lua…'), 'apaga isso');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));

    await waitFor(() =>
      expect(chamadas).toContainEqual({
        metodo: 'POST',
        rota: `/posts/${deFofoca.id}/respostas`,
        corpo: { texto: 'apaga isso' },
      }),
    );
    await waitFor(() => expect(screen.queryByText('Respondendo a @fofocalizei')).toBeNull());
  });

  it('sem energia abre a folha 19 e não some com o alvo', async () => {
    simular({
      [`POST /posts/${original.id}/respostas`]: () =>
        new ErroDaApi(409, 'sem_energia', 'Sem energia para responder.'),
    });
    await renderizarTela(<TelaRespostas postId={original.id} />);

    await fireEvent.changeText(await screen.findByLabelText('Responder como Lua…'), 'oi');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  it('a resposta que chega pelo tempo real entra na lista sozinha, sem aviso de novas', async () => {
    const nova = post({ autor: bento, respondeA: original.id, texto: 'chegou agora' });
    let consultas = 0;
    simular({
      [rotaThread]: () => thread(++consultas === 1 ? undefined : [deVic, deFofoca, nova]),
    });
    const { cliente } = await renderizarTela(<TelaRespostas postId={original.id} />);
    await screen.findByText('print salvo. só dizendo.');
    expect(screen.queryByText('chegou agora')).toBeNull();

    await act(async () => aplicarNoCache(cliente, { tipo: 'post', post: nova }));

    expect(await screen.findByText('chegou agora')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /nova.* resposta/ })).toBeNull();
    expect(consultas).toBe(2);
  });

  it('curtir com erro avisa e desfaz a curtida', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simular({
      [`POST /posts/${deFofoca.id}/curtir`]: () => new ErroDaApi(500, 'interno', 'Falhou.'),
    });
    await renderizarTela(<TelaRespostas postId={original.id} />);
    await fireEvent.press(await screen.findByRole('button', { name: '230 curtidas' }));
    await waitFor(() => expect(alerta).toHaveBeenCalledWith('Não deu certo', 'Falhou.'));
    expect(await screen.findByRole('button', { name: '230 curtidas' })).not.toBeSelected();
  });

  it('mostra quem está digitando no fim da conversa', async () => {
    useDigitando.setState({ porAlvo: { [deVic.id]: [bento] } });
    simular();
    await renderizarTela(<TelaRespostas postId={original.id} />);

    expect(await screen.findByLabelText('Bento Lima está digitando')).toBeTruthy();
  });

  it('o avatar abre o perfil do autor', async () => {
    simular();
    await renderizarTela(<TelaRespostas postId={original.id} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver perfil de fofocalizei' }));
    expect(router.push).toHaveBeenCalledWith(`/personagem/${fofoca.id}`);
  });

  it('sem respostas, explica que elas chegam aos poucos', async () => {
    simular({ [rotaThread]: thread([]) });
    await renderizarTela(<TelaRespostas postId={original.id} />);

    expect(
      await screen.findByText('Ninguém respondeu ainda. As respostas chegam aos poucos.'),
    ).toBeTruthy();
  });

  it('erro na consulta oferece tentar de novo', async () => {
    simularApi({ 'GET /mundos/atual': mundo() });
    await renderizarTela(<TelaRespostas postId={original.id} />);

    expect(await screen.findByText('Não deu para abrir as respostas.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });
});
