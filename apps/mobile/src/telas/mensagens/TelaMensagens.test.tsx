import type { Conversa, PersonagemResumo } from '@holofote/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { chamadas, simularApi } from '../../testes/api';
import { mundo, personagem, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { TelaMensagens } from './TelaMensagens';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
}));

const antes = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

const duda = personagem({
  nome: 'Duda Marques',
  handle: '@dudamarques',
  iniciais: 'DM',
  verificado: false,
});
const vic = personagem();
const bento = personagem({
  nome: 'Bento Lima',
  handle: '@bentolima',
  iniciais: 'BL',
  verificado: false,
});
const nina = personagem({
  nome: 'Nina Rocha',
  handle: '@ninarocha',
  iniciais: 'NR',
  verificado: false,
});
const fa = personagem({
  nome: 'luzinha',
  handle: '@luzinha',
  papel: 'figurante',
  verificado: false,
});

const conversa = (p: PersonagemResumo, extra: Partial<Conversa>): Conversa => ({
  id: uuid(),
  personagem: p,
  relacao: { afinidade: 50, rotulo: 'Conhecidos' },
  ultima: null,
  naoLidas: 0,
  puxouConversa: false,
  ...extra,
});

const comDuda = conversa(duda, {
  relacao: { afinidade: 72, rotulo: 'Parceria criativa' },
  ultima: { texto: 'bora fechar o estúdio quinta?', criadoEm: antes(0.2), minha: false },
  naoLidas: 1,
  puxouConversa: true,
});
const comVic = conversa(vic, {
  relacao: { afinidade: 38, rotulo: 'Rivais com respeito' },
  ultima: { texto: 'vou pensar. talvez numa terça.', criadoEm: antes(60), minha: true },
});
const comBento = conversa(bento, {
  relacao: { afinidade: 88, rotulo: 'Amizade' },
  ultima: { texto: 'manda a setlist quando der', criadoEm: antes(3 * 24 * 60), minha: true },
});

const relacoes = {
  jogador: personagem({ nome: 'Lua Prado', papel: 'jogador' }),
  nos: [vic, nina, fa].map((p, i) => ({
    personagem: p,
    relacao: { afinidade: 40 + i * 10, rotulo: 'Conhecidos' },
    lembra: [],
  })),
};

function simular(lista: Conversa[], extras: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': mundo(),
    'GET /conversas': lista,
    'GET /relacoes': relacoes,
    ...extras,
  });
}

// Linhas de conversa (a fileira do elenco também cita a afinidade, mas não abre conversa).
const linhas = () => screen.getAllByHintText('Abre a conversa');

beforeEach(() => jest.clearAllMocks());

describe('14 · Mensagens', () => {
  it('lista as conversas pela última mensagem, com prévia, relação e não lidas', async () => {
    simular([comBento, comVic, comDuda]);
    await renderizarTela(<TelaMensagens />);

    await screen.findByText('Duda Marques');
    expect(linhas().map((l) => l.props.accessibilityLabel)).toEqual([
      'Duda Marques, puxou conversa, agora, bora fechar o estúdio quinta?, Parceria criativa, afinidade 72%, 1 não lida',
      expect.stringMatching(
        /^Vic Ferraz, verificado, (\d\d:\d\d|Dia 5), Você: vou pensar\. talvez numa terça\., Rivais com respeito, afinidade 38%$/,
      ),
      'Bento Lima, Dia 3, Você: manda a setlist quando der, Amizade, afinidade 88%',
    ]);
    expect(screen.getByText('Novo')).toBeTruthy();
    expect(screen.getByText('Parceria criativa · 72%')).toBeTruthy();
  });

  it('tocar numa conversa abre a DM', async () => {
    simular([comVic]);
    await renderizarTela(<TelaMensagens />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Vic Ferraz/ }));
    expect(router.push).toHaveBeenCalledWith(`/dm/${comVic.id}`);
  });

  it('a busca filtra as conversas pelo nome, sem acento', async () => {
    simular([comVic, comDuda, comBento]);
    await renderizarTela(<TelaMensagens />);
    await screen.findByText('Duda Marques');

    await fireEvent.changeText(screen.getByLabelText('Buscar no elenco'), 'VÍC');
    expect(linhas()).toHaveLength(1);
    expect(screen.queryByText('Duda Marques')).toBeNull();
    // Buscando, a fileira do elenco também aparece filtrada.
    expect(screen.getByRole('button', { name: /^Conversar com Vic Ferraz/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Conversar com Nina/ })).toBeNull();
  });

  it('sem conversas, mostra o elenco e começa uma conversa nova', async () => {
    const nova = conversa(nina, {});
    simular([], { [`POST /personagens/${nina.id}/conversa`]: nova });
    await renderizarTela(<TelaMensagens />);

    expect(
      await screen.findByText('Nenhuma conversa ainda. Escolha alguém do elenco para começar.'),
    ).toBeTruthy();
    // Só o elenco aparece na fileira, por afinidade.
    expect(screen.queryByRole('button', { name: /Conversar com luzinha/ })).toBeNull();
    await fireEvent.press(await screen.findByRole('button', { name: /^Conversar com Nina Rocha/ }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dm/${nova.id}`));
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/personagens/${nina.id}/conversa`,
      corpo: undefined,
    });
  });

  it('o lápis abre o elenco; quem já tem conversa vai direto para ela', async () => {
    simular([comVic]);
    await renderizarTela(<TelaMensagens />);
    await screen.findByText('Vic Ferraz');
    expect(screen.queryByRole('button', { name: /^Conversar com/ })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Nova conversa' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Conversar com Vic Ferraz/ }));

    expect(router.push).toHaveBeenCalledWith(`/dm/${comVic.id}`);
    expect(chamadas.some((c) => c.metodo === 'POST')).toBe(false);
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    simularApi({ 'GET /mundos/atual': mundo(), 'GET /relacoes': relacoes });
    await renderizarTela(<TelaMensagens />);

    expect(await screen.findByText('Não deu para abrir suas conversas.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeTruthy();
  });
});
