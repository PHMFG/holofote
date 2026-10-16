import type { Conversa, EventoTempoReal, Mensagem } from '@holofote/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ErroDaApi } from '../../api/cliente';
import { useDigitando } from '../../api/tempoReal';
import { chamadas, simularApi } from '../../testes/api';
import { energia, mundo, personagem, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { montarItens, TelaDM } from './TelaDM';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
}));
const mockOuvinte: { atual?: (evento: EventoTempoReal) => void } = {};
jest.mock('../../api/tempoReal', () => ({
  ...jest.requireActual('../../api/tempoReal'),
  useTempoReal: (fn: (evento: EventoTempoReal) => void) => {
    mockOuvinte.atual = fn;
  },
}));

const antes = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

const vic = personagem();
const conversaId = uuid();
const conversa: Conversa = {
  id: conversaId,
  personagem: vic,
  relacao: { afinidade: 38, rotulo: 'Rivais com respeito' },
  ultima: { texto: 'indireta? eu só falei do meu single.', criadoEm: antes(29), minha: true },
  naoLidas: 1,
  puxouConversa: false,
};
const mensagem = (p: Partial<Mensagem>): Mensagem => ({
  id: uuid(),
  conversaId,
  minha: false,
  texto: 'vi a indireta. criativo.',
  criadoEm: antes(30),
  ...p,
});
const historico = [
  mensagem({}),
  mensagem({ minha: true, texto: 'indireta? eu só falei do meu single.', criadoEm: antes(29) }),
];

const consequencia = (valor: number) => ({
  eventoId: uuid(),
  deltas: [{ alvo: `relacao:${vic.id}`, valor }],
  seguidoresGanhos: 0,
  curtidasSimuladas: 0,
  cartao: null,
  reacoesPendentes: 1,
  energia: energia(7),
  marcoLiberado: null,
  desfazivelAte: null,
});

const rotaMensagens = `/conversas/${conversaId}/mensagens`;
const enviadas: Mensagem[] = [];
const contar = (metodo: string, rota: string) =>
  chamadas.filter((c) => c.metodo === metodo && c.rota === rota).length;

function simular(extras: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': mundo(),
    'GET /conversas': [conversa],
    [`GET ${rotaMensagens}`]: historico,
    ...extras,
  });
}

beforeEach(() => {
  enviadas.length = 0;
  jest.clearAllMocks();
  useDigitando.setState({ porAlvo: {} });
});

describe('montarItens', () => {
  it('abre separador depois de uma pausa longa e marca a troca de lado', () => {
    const itens = montarItens(
      [
        mensagem({ criadoEm: antes(200) }),
        mensagem({ minha: true, criadoEm: antes(199) }),
        mensagem({ minha: true, criadoEm: antes(198) }),
        mensagem({ criadoEm: antes(10) }),
      ],
      6,
    );
    expect(itens.map((i) => (i.tipo === 'separador' ? 'sep' : i.trocaDeLado))).toEqual([
      'sep',
      false,
      true,
      false,
      'sep',
      false,
    ]);
  });
});

describe('04 · Mensagem direta', () => {
  it('mostra o personagem, a relação e as mensagens com quem falou', async () => {
    simular();
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    expect(
      await screen.findByLabelText('Vic Ferraz, verificado, Rivais com respeito, afinidade 38%'),
    ).toBeTruthy();
    expect(screen.getByText('Rivais com respeito · 38%')).toBeTruthy();
    expect(screen.getByLabelText('Vic Ferraz: vi a indireta. criativo.')).toBeTruthy();
    expect(screen.getByLabelText('Você: indireta? eu só falei do meu single.')).toBeTruthy();
    // Dia 6 hoje, ou Dia 5 se o teste rodar logo depois da meia-noite.
    expect(screen.getByText(/^Dia [56] · \d\d:\d\d$/)).toBeTruthy();
    expect(screen.getByPlaceholderText('Mensagem para Vic…')).toBeTruthy();
  });

  it('ao abrir, atualiza a lista de conversas (o GET zera as não lidas)', async () => {
    simular();
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    await screen.findByLabelText('Vic Ferraz: vi a indireta. criativo.');
    await waitFor(() => expect(contar('GET', '/conversas')).toBeGreaterThanOrEqual(2));
  });

  it('envia a mensagem com a rota e o corpo certos e mostra o efeito na relação', async () => {
    simular({
      // O servidor guarda a mensagem: a releitura da conversa (depois da ação) já a traz.
      [`GET ${rotaMensagens}`]: () => [...historico, ...enviadas],
      [`POST ${rotaMensagens}`]: (corpo: unknown) => {
        const nova = mensagem({
          minha: true,
          texto: (corpo as { texto: string }).texto,
          criadoEm: antes(0),
        });
        enviadas.push(nova);
        return { mensagem: nova, consequencia: consequencia(2) };
      },
    });
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    await fireEvent.changeText(await screen.findByLabelText('Mensagem para Vic…'), 'vou pensar. ');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));

    await waitFor(() =>
      expect(chamadas).toContainEqual({
        metodo: 'POST',
        rota: rotaMensagens,
        corpo: { texto: 'vou pensar.' },
      }),
    );
    expect(await screen.findByLabelText('Você: vou pensar.')).toBeTruthy();
    expect(screen.getByText('Entregue · relação +2%')).toBeTruthy();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
  });

  it('sem energia abre a folha 19', async () => {
    simular({
      [`POST ${rotaMensagens}`]: () => new ErroDaApi(409, 'sem_energia', 'Sem energia.'),
    });
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    await fireEvent.changeText(await screen.findByLabelText('Mensagem para Vic…'), 'oi');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar, custa 1 de energia' }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
    expect(screen.queryByText(/^Entregue/)).toBeNull();
  });

  it('mostra o balão de digitando do personagem', async () => {
    useDigitando.setState({ porAlvo: { [conversaId]: [vic] } });
    simular();
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    expect(await screen.findByLabelText('Vic Ferraz está digitando')).toBeTruthy();
  });

  it('mensagem que chega com a tela aberta relê a conversa', async () => {
    simular();
    await renderizarTela(<TelaDM conversaId={conversaId} />);
    await screen.findByLabelText('Vic Ferraz: vi a indireta. criativo.');
    const lidas = contar('GET', rotaMensagens);

    await act(async () =>
      mockOuvinte.atual?.({ tipo: 'mensagem', mensagem: mensagem({ texto: 'e aí?' }) }),
    );
    await waitFor(() => expect(contar('GET', rotaMensagens)).toBe(lidas + 1));
  });

  it('o botão de mais abre o perfil', async () => {
    simular();
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ver perfil de Vic Ferraz' }));
    expect(router.push).toHaveBeenCalledWith(`/personagem/${vic.id}`);
  });

  it('conversa vazia convida a escrever', async () => {
    simular({ [`GET ${rotaMensagens}`]: [] });
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    expect(
      await screen.findByText('Nenhuma mensagem ainda. Escreva a primeira para Vic.'),
    ).toBeTruthy();
  });

  it('erro ao abrir oferece tentar de novo', async () => {
    simularApi({ 'GET /mundos/atual': mundo(), 'GET /conversas': [conversa] });
    await renderizarTela(<TelaDM conversaId={conversaId} />);

    expect(await screen.findByText('Não deu para abrir a conversa.')).toBeTruthy();
  });
});
