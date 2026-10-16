import { montarTema } from '@holofote/tokens';
import type { Consequencia, ItemRegistro, RespostaRelacoes } from '@holofote/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { energia, mundo, personagem, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { agruparPorDia, rotuloDoDia } from './dias';
import { comSinal } from '../../formatar';
import { formatarDeltas } from './formatar';
import { TelaRegistro } from './TelaRegistro';

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

// Relógio fixo em 16/10/2026, 21:50 (fuso local): "Hoje" e "Ontem" não dependem da hora do teste.
const AGORA = new Date(2026, 9, 16, 21, 50);
const em = (dia: number, hora: number, minuto: number) =>
  new Date(2026, 9, dia, hora, minuto).toISOString();

const vic = personagem({ nome: 'Vic Ferraz' });
const duda = personagem({ nome: 'Duda Marques', iniciais: 'DM' });

const relacoes: RespostaRelacoes = {
  jogador: personagem({ nome: 'Lua Prado', papel: 'jogador', tomAvatar: 'escuro' }),
  nos: [
    { personagem: duda, relacao: { afinidade: 72, rotulo: 'Parceria' }, lembra: [] },
    { personagem: vic, relacao: { afinidade: 38, rotulo: 'Rivais com respeito' }, lembra: [] },
  ],
};

const item = (p: Partial<ItemRegistro>): ItemRegistro => ({
  eventoId: uuid(),
  tipo: 'post',
  resumo: '',
  criadoEm: em(16, 12, 0),
  deltas: [],
  desfazivel: false,
  desfeito: false,
  ...p,
});

const dm = item({
  tipo: 'dm',
  resumo: 'Mensagem para Vic Ferraz',
  criadoEm: em(16, 21, 40),
  deltas: [{ alvo: `relacao:${vic.id}`, valor: 2 }],
  desfazivel: true,
});
const postDoDia = item({
  tipo: 'post',
  resumo: 'Publicou: "single novo sexta. sem feat, sem desculpa."',
  criadoEm: em(16, 14, 2),
  deltas: [
    { alvo: `relacao:${vic.id}`, valor: -3 },
    { alvo: 'polemica', valor: 6 },
    { alvo: 'seguidores', valor: 214 },
  ],
});
const historia = item({
  tipo: 'historia',
  resumo: 'Respondeu à história de Duda Marques',
  criadoEm: em(15, 9, 36),
  deltas: [
    { alvo: 'seguidores', valor: 59 },
    { alvo: `relacao:${duda.id}`, valor: 5 },
  ],
});
const desfeito = item({
  tipo: 'resposta',
  resumo: 'Respondeu: "ninguém pediu sua opinião"',
  criadoEm: em(15, 8, 0),
  deltas: [{ alvo: 'fama', valor: 1 }],
  desfeito: true,
});
const todos = [dm, postDoDia, historia, desfeito];

const consequencia = (): Consequencia => ({
  eventoId: uuid(),
  deltas: [{ alvo: `relacao:${vic.id}`, valor: -2 }],
  seguidoresGanhos: 0,
  curtidasSimuladas: 0,
  cartao: null,
  reacoesPendentes: 0,
  energia: energia(6, 12),
  marcoLiberado: null,
  desfazivelAte: null,
});

function simular(rotas: Record<string, unknown> = {}) {
  simularApi({
    'GET /registro': todos,
    'GET /relacoes': relacoes,
    'GET /mundos/atual': mundo({ dia: 6 }),
    [`POST /acoes/${dm.eventoId}/desfazer`]: consequencia(),
    ...rotas,
  });
}

/** Aperta o botão destrutivo do Alert de confirmação. */
async function confirmar(alerta: jest.SpyInstance) {
  const botoes = alerta.mock.calls.at(-1)?.[2] as AlertButton[];
  await act(async () => botoes.find((b) => b.style === 'destructive')?.onPress?.());
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: AGORA,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'hrtime',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
    ],
  });
});
afterEach(() => jest.useRealTimers());

describe('09 · Registro de atividades', () => {
  it('agrupa por dia relativo, com hora, resumo e chips de efeito', async () => {
    simular();
    await renderizarTela(<TelaRegistro />);

    expect(await screen.findByText('Hoje · dia 6')).toBeTruthy();
    expect(screen.getByText('Ontem · dia 5')).toBeTruthy();
    expect(screen.getByText('Mensagem para Vic Ferraz')).toBeTruthy();
    expect(screen.getByText('21:40')).toBeTruthy();
    expect(screen.getByText('Mensagem direta')).toBeTruthy();
    // Seguidores primeiro; nomes das relações saem de /relacoes.
    expect(await screen.findByText('+2 Vic')).toBeTruthy();
    expect(screen.getByText('+214 seguidores')).toBeTruthy();
    expect(screen.getByText('−3 Vic')).toBeTruthy();
    expect(screen.getByText('+6 polêmica')).toBeTruthy();
    expect(screen.getByText('+5 Duda')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Post, 14:02. Publicou: "single novo sexta. sem feat, sem desculpa.". +214 seguidores, +6 polêmica, relação com Vic −3',
      ),
    ).toBeTruthy();
  });

  it('positivo em destaque suave e negativo neutro', async () => {
    simular();
    await renderizarTela(<TelaRegistro />);
    expect(await screen.findByText('−3 Vic')).toHaveStyle({
      color: montarTema('claro', 'laranja').cores.textoSuave,
    });
    expect(screen.getByText('+214 seguidores')).toHaveStyle({
      color: montarTema('claro', 'laranja').cores.destaqueTinta,
    });
  });

  it('item desfeito aparece riscado e marcado, sem botão de desfazer', async () => {
    simular();
    await renderizarTela(<TelaRegistro />);
    expect(await screen.findByText('Respondeu: "ninguém pediu sua opinião"')).toHaveStyle({
      textDecorationLine: 'line-through',
    });
    expect(screen.getByText('Desfeito')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Desfazer, custa 2 de energia' })).toHaveLength(1);
  });

  it('desfazer confirma, chama a rota e vibra', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simular();
    await renderizarTela(<TelaRegistro />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Desfazer, custa 2 de energia' }),
    );
    expect(alerta).toHaveBeenCalledWith(
      'Desfazer esta ação?',
      expect.stringContaining('Custa 2 de energia'),
      expect.any(Array),
    );
    expect(chamadas.some((c) => c.rota.endsWith('/desfazer'))).toBe(false);

    await confirmar(alerta);
    await waitFor(() =>
      expect(chamadas).toContainEqual({
        metodo: 'POST',
        rota: `/acoes/${dm.eventoId}/desfazer`,
        corpo: undefined,
      }),
    );
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith('success'));
    await screen.findByRole('button', { name: 'Desfazer, custa 2 de energia' });
  });

  it('desfazer sem energia abre a folha 19', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simular({
      [`POST /acoes/${dm.eventoId}/desfazer`]: new ErroDaApi(409, 'sem_energia', 'Sem energia.'),
    });
    await renderizarTela(<TelaRegistro />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Desfazer, custa 2 de energia' }),
    );
    await confirmar(alerta);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
    await screen.findByRole('button', { name: 'Desfazer, custa 2 de energia' });
  });

  it('desfazer expirado explica o motivo e tira o chip depois de reler o registro', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const expirado = { ...dm, desfazivel: false };
    let leituras = 0;
    simular({
      'GET /registro': () => (++leituras === 1 ? todos : [expirado, postDoDia, historia, desfeito]),
      [`POST /acoes/${dm.eventoId}/desfazer`]: new ErroDaApi(
        409,
        'desfazer_expirado',
        'Passou de uma hora; não dá mais para desfazer.',
      ),
    });
    await renderizarTela(<TelaRegistro />);

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Desfazer, custa 2 de energia' }),
    );
    await confirmar(alerta);
    await waitFor(() =>
      expect(alerta).toHaveBeenLastCalledWith(
        'Não deu certo',
        'Passou de uma hora; não dá mais para desfazer.',
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Desfazer, custa 2 de energia' })).toBeNull(),
    );
    expect(leituras).toBe(2);
  });

  it('filtra por posts, DMs e histórias', async () => {
    simular();
    await renderizarTela(<TelaRegistro />);
    await screen.findByText('Mensagem para Vic Ferraz');

    await fireEvent.press(screen.getByRole('radio', { name: 'DMs' }));
    expect(screen.getByText('Mensagem para Vic Ferraz')).toBeTruthy();
    expect(screen.queryByText(/^Publicou/)).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Posts' }));
    expect(screen.getByText(/^Publicou/)).toBeTruthy();
    expect(screen.getByText(/^Respondeu: /)).toBeTruthy();
    expect(screen.queryByText('Mensagem para Vic Ferraz')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Histórias' }));
    expect(screen.getByText('Respondeu à história de Duda Marques')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Histórias' })).toBeChecked();
  });

  it('vazio mostra uma frase por filtro', async () => {
    simular({ 'GET /registro': [] });
    await renderizarTela(<TelaRegistro />);
    expect(
      await screen.findByText(/Cada post, comentário e mensagem fica registrado/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'DMs' }));
    expect(screen.getByText('Nenhuma mensagem direta ainda.')).toBeTruthy();
  });

  it('erro ao carregar mostra o cartão com tentar de novo', async () => {
    simular({ 'GET /registro': new ErroDaApi(500, 'interno', 'falhou') });
    await renderizarTela(<TelaRegistro />);
    expect(await screen.findByText('Não deu para carregar o registro.')).toBeTruthy();
    simular();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('Mensagem para Vic Ferraz')).toBeTruthy();
  });
});

describe('formatação do registro', () => {
  it('sinal tipográfico e números grandes', () => {
    expect(comSinal(3)).toBe('+3');
    expect(comSinal(-2)).toBe('−2');
    expect(comSinal(1200)).toBe('+1,2 mil');
    expect(comSinal(0, '%')).toBe('0%');
  });

  it('deltas sem nome conhecido viram "alguém" e zeros somem', () => {
    const textos = formatarDeltas(
      [
        { alvo: 'relacao:desconhecido', valor: -1 },
        { alvo: 'carisma', valor: 0 },
        { alvo: 'seguidores', valor: 1 },
      ],
      new Map(),
    ).map((d) => d.texto);
    expect(textos).toEqual(['+1 seguidor', '−1 alguém']);
  });

  it('dias antigos usam o dia do mundo ou a data', () => {
    const agora = AGORA.getTime();
    expect(rotuloDoDia(em(13, 10, 0), agora, 6)).toBe('Dia 3');
    expect(rotuloDoDia(em(13, 10, 0), agora)).toBe('13/10');
    expect(agruparPorDia([dm, postDoDia, historia], agora).map((g) => g.itens.length)).toEqual([
      2, 1,
    ]);
  });
});
