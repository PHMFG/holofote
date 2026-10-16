import type { Conversa, Post, RespostaFeed } from '@holofote/shared';
import { useQueryClient } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chaves } from '../../api/consultas';
import { chamadas, simularApi } from '../../testes/api';
import { energia, mundo, personagem, post, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { dividirTexto, parcelasDaEnquete } from './formatar';
import { TelaHistoria } from './TelaHistoria';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
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

const antes = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();
const depois = (minutos: number) => new Date(Date.now() + minutos * 60_000).toISOString();

const duda = personagem({ nome: 'Duda Marques', handle: '@dudamarques', iniciais: 'DM' });
const id = uuid();
const anterior = uuid();
const proxima = uuid();

const historia = (p: Partial<Post> = {}): Post =>
  post({
    id,
    autor: duda,
    tipo: 'historia',
    texto: 'estúdio reservado pra quinta. alguém aí topa um feat?',
    criadoEm: antes(120),
    expiraEm: depois(60 * 22),
    enquete: {
      pergunta: 'Quem eu chamo?',
      opcoes: [
        { id: 'lua', texto: 'Lua Prado', votos: 15 },
        { id: 'vic', texto: 'Vic Ferraz', votos: 9 },
      ],
      meuVoto: null,
    },
    ...p,
  });

const conversaId = uuid();
const conversa: Conversa = {
  id: conversaId,
  personagem: duda,
  relacao: { afinidade: 72, rotulo: 'Parceria' },
  ultima: null,
  naoLidas: 0,
  puxouConversa: false,
};

const rotaHistoria = `/historias/${id}`;

/** Põe a fileira de histórias do feed no cache antes de a tela abrir. */
function ComFeed({ children }: { children: ReactNode }) {
  const cliente = useQueryClient();
  useState(() => {
    const pagina: RespostaFeed = {
      itens: [],
      proximoCursor: null,
      historias: [
        { id: anterior, autor: personagem(), vista: true },
        { id, autor: duda, vista: false },
        { id: proxima, autor: personagem(), vista: false },
      ],
    };
    cliente.setQueryData(chaves.feed, { pages: [pagina], pageParams: [null] });
  });
  return children;
}

function simular(extras: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': mundo(),
    [`GET ${rotaHistoria}`]: historia(),
    'GET /conversas': [conversa],
    ...extras,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('formatar da história', () => {
  it('divide o texto na primeira frase ou na quebra de linha', () => {
    expect(dividirTexto('estúdio reservado pra quinta. alguém aí topa um feat?')).toEqual({
      titulo: 'estúdio reservado pra quinta.',
      resto: 'alguém aí topa um feat?',
    });
    expect(dividirTexto('linha um\nlinha dois')).toEqual({
      titulo: 'linha um',
      resto: 'linha dois',
    });
    expect(dividirTexto('sem ponto final')).toEqual({ titulo: 'sem ponto final', resto: null });
  });

  it('calcula a parcela de cada opção da enquete', () => {
    const [lua, vic] = parcelasDaEnquete(historia().enquete!);
    expect(lua?.porcentagem).toBe(63);
    expect(vic?.porcentagem).toBe(38);
  });
});

describe('15 · História', () => {
  it('mostra o autor, a posição na fileira, o texto e a enquete; abrir marca como vista', async () => {
    simular();
    const { cliente } = await renderizarTela(
      <ComFeed>
        <TelaHistoria id={id} />
      </ComFeed>,
    );

    expect(await screen.findByText('Duda Marques')).toBeTruthy();
    expect(screen.getByText('há 2 h · 2 de 3')).toBeTruthy();
    expect(screen.getByLabelText('História 2 de 3')).toBeTruthy();
    expect(screen.getByText('estúdio reservado pra quinta.')).toBeTruthy();
    expect(screen.getByText('alguém aí topa um feat?')).toBeTruthy();
    expect(screen.getByText('Votar é grátis · 0 energia')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Votar em Lua Prado, grátis' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Responder a Duda…')).toBeTruthy();
    // O GET da história marca como vista: o anel do feed precisa ser relido.
    expect(chamadas).toContainEqual({ metodo: 'GET', rota: rotaHistoria, corpo: undefined });
    await waitFor(() => expect(cliente.getQueryState(chaves.feed)?.isInvalidated).toBe(true));
  });

  it('vota de graça e mostra as porcentagens com o seu voto', async () => {
    simular({
      [`POST ${rotaHistoria}/voto`]: (corpo: unknown) =>
        historia({
          enquete: {
            pergunta: 'Quem eu chamo?',
            opcoes: [
              { id: 'lua', texto: 'Lua Prado', votos: 16 },
              { id: 'vic', texto: 'Vic Ferraz', votos: 9 },
            ],
            meuVoto: (corpo as { opcao: string }).opcao,
          },
        }),
    });
    await renderizarTela(<TelaHistoria id={id} />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Votar em Lua Prado, grátis' }),
    );

    expect(await screen.findByText('Você votou · 0 energia')).toBeTruthy();
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `${rotaHistoria}/voto`,
      corpo: { opcao: 'lua' },
    });
    expect(screen.getByLabelText('Lua Prado, 64%, seu voto')).toBeTruthy();
    expect(screen.getByLabelText('Vic Ferraz, 36%')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Votar em/ })).toBeNull();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  it('responder vira mensagem direta, com aviso e atalho para a conversa', async () => {
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    simular({
      [`POST ${rotaHistoria}/resposta`]: (corpo: unknown) => ({
        mensagem: {
          id: uuid(),
          conversaId,
          minha: true,
          texto: (corpo as { texto: string }).texto,
          criadoEm: antes(0),
        },
        consequencia: {
          eventoId: uuid(),
          deltas: [],
          seguidoresGanhos: 0,
          curtidasSimuladas: 0,
          cartao: null,
          reacoesPendentes: 1,
          energia: energia(7),
          marcoLiberado: null,
          desfazivelAte: null,
        },
      }),
    });
    await renderizarTela(<TelaHistoria id={id} />);

    await fireEvent.changeText(await screen.findByLabelText('Responder a Duda…'), 'eu topo ');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));

    expect(await screen.findByText('Enviada para as mensagens com Duda.')).toBeTruthy();
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `${rotaHistoria}/resposta`,
      corpo: { texto: 'eu topo' },
    });
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(anuncio).toHaveBeenCalledWith('Resposta enviada. Ela está nas mensagens com Duda.');

    await fireEvent.press(screen.getByRole('button', { name: 'Abrir conversa' }));
    expect(router.push).toHaveBeenCalledWith(`/dm/${conversaId}`);
  });

  it('sem energia para responder abre a folha 19', async () => {
    simular({
      [`POST ${rotaHistoria}/resposta`]: () => new ErroDaApi(409, 'sem_energia', 'Sem energia.'),
    });
    await renderizarTela(<TelaHistoria id={id} />);

    await fireEvent.changeText(await screen.findByLabelText('Responder a Duda…'), 'oi');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
    expect(screen.queryByText('Enviada para as mensagens com Duda.')).toBeNull();
    // O texto continua no campo: o jogador não perde o que escreveu.
    expect(screen.getByLabelText('Responder a Duda…').props.value).toBe('oi');
  });

  it('história expirada (404) mostra o estado e fecha', async () => {
    simularApi({
      'GET /mundos/atual': mundo(),
      [`GET ${rotaHistoria}`]: new ErroDaApi(404, 'nao_encontrado', 'Expirou.'),
    });
    await renderizarTela(<TelaHistoria id={id} />);

    expect(await screen.findByText('Esta história expirou.')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Fechar' })[1]!);
    expect(router.back).toHaveBeenCalled();
  });

  it('história com expiraEm no passado também conta como expirada', async () => {
    simular({ [`GET ${rotaHistoria}`]: historia({ expiraEm: antes(1) }) });
    await renderizarTela(<TelaHistoria id={id} />);

    expect(await screen.findByText('Esta história expirou.')).toBeTruthy();
    expect(screen.queryByText('Duda Marques')).toBeNull();
  });

  it('erro de rede oferece tentar de novo', async () => {
    simularApi({
      'GET /mundos/atual': mundo(),
      [`GET ${rotaHistoria}`]: new ErroDaApi(500, 'desconhecido', 'Falhou.'),
    });
    await renderizarTela(<TelaHistoria id={id} />);

    expect(await screen.findByText('Não deu para abrir a história.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });

  it('fecha pelo X e vai para a próxima ou a anterior pelas bordas', async () => {
    simular();
    await renderizarTela(
      <ComFeed>
        <TelaHistoria id={id} />
      </ComFeed>,
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Próxima história' }));
    expect(router.replace).toHaveBeenCalledWith(`/historia/${proxima}`);
    await fireEvent.press(screen.getByRole('button', { name: 'História anterior' }));
    expect(router.replace).toHaveBeenCalledWith(`/historia/${anterior}`);
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(router.back).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver perfil de Duda Marques' }));
    expect(router.push).toHaveBeenCalledWith(`/personagem/${duda.id}`);
  });
});
