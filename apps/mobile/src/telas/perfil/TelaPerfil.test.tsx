import { montarTema } from '@holofote/tokens';
import type { ItemRegistro, RespostaRelacoes } from '@holofote/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Alert, type AlertButton } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { conta, energia, jogador, mundo, personagem, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { TelaPerfil } from './TelaPerfil';
import { relacoesPrincipais, variacaoDeHoje } from './variacao';

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

const lua = jogador({
  ficha: 'cantora em ascensão. escrevo tudo o que não falo. single novo sexta.',
  fama: 24,
  carisma: 61,
  polemica: 18,
  seguidores: 7100,
});
const m = mundo({ jogador: lua, universo: 'Pop Brasil' });

const bento = personagem({ nome: 'Bento Lima', iniciais: 'BL' });
const duda = personagem({ nome: 'Duda Marques', iniciais: 'DM' });
const fofoca = personagem({ nome: 'fofocalizei', iniciais: 'FO', papel: 'figurante' });
const vic = personagem({ nome: 'Vic Ferraz', iniciais: 'VF', tomAvatar: 'medio' });

// A API manda do mais próximo ao mais distante.
const relacoes: RespostaRelacoes = {
  jogador: personagem({ id: lua.id, nome: lua.nome, papel: 'jogador' }),
  nos: [
    { personagem: bento, relacao: { afinidade: 88, rotulo: 'Melhor amigo' }, lembra: [] },
    { personagem: duda, relacao: { afinidade: 72, rotulo: 'Parceria criativa' }, lembra: [] },
    { personagem: fofoca, relacao: { afinidade: 60, rotulo: 'Parceria' }, lembra: [] },
    { personagem: vic, relacao: { afinidade: 38, rotulo: 'Rivais com respeito' }, lembra: [] },
  ],
};

const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
const registro: ItemRegistro[] = [
  {
    eventoId: uuid(),
    tipo: 'post',
    resumo: 'Publicou: "single novo sexta"',
    criadoEm: new Date().toISOString(),
    deltas: [
      { alvo: 'fama', valor: 2 },
      { alvo: 'polemica', valor: 6 },
      { alvo: `relacao:${vic.id}`, valor: -3 },
      { alvo: `relacao:${duda.id}`, valor: 5 },
    ],
    desfazivel: true,
    desfeito: false,
  },
  {
    eventoId: uuid(),
    tipo: 'dm',
    resumo: 'Mensagem para Vic Ferraz',
    criadoEm: ontem,
    deltas: [{ alvo: 'carisma', valor: 9 }],
    desfazivel: false,
    desfeito: false,
  },
];

function simular(rotas: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': m,
    'GET /relacoes': relacoes,
    'GET /conta': conta({ gemas: 40 }),
    'GET /energia': energia(8, 12),
    'GET /registro': registro,
    'POST /energia/recarga': { energia: energia(12, 12), gemas: 40, anunciosRestantesHoje: 3 },
    'DELETE /mundos/atual': undefined,
    ...rotas,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('05 · Perfil do jogador', () => {
  it('mostra identidade, persona, seguidores e a presença com a variação de hoje', async () => {
    simular();
    await renderizarTela(<TelaPerfil />);

    expect(await screen.findByRole('header', { name: 'Lua Prado' })).toBeTruthy();
    expect(screen.getByText('@luaprado · Pop Brasil')).toBeTruthy();
    expect(screen.getByText(/^cantora em ascensão/)).toBeTruthy();
    expect(screen.getByText('7,1 mil')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Lua Prado' })).toBeTruthy();

    expect(await screen.findByLabelText('Fama 24%, subiu 2 hoje')).toBeTruthy();
    // O carisma de ontem não conta como variação de hoje.
    expect(screen.getByLabelText('Carisma 61%, sem variação hoje')).toBeTruthy();
    expect(screen.getByLabelText('Polêmica 18%, subiu 6 hoje')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Carisma' })).toHaveProp('accessibilityValue', {
      min: 0,
      max: 100,
      now: 61,
    });
  });

  it('relações principais: até 3, elenco antes de figurante, com rótulo e afinidade', async () => {
    simular();
    await renderizarTela(<TelaPerfil />);

    const linhas = await screen.findAllByRole('button', { name: /, afinidade \d+%/ });
    expect(linhas.map((l) => l.props.accessibilityLabel)).toEqual([
      'Bento Lima, Melhor amigo, afinidade 88%, sem variação hoje',
      'Duda Marques, Parceria criativa, afinidade 72%, subiu 5 hoje',
      'Vic Ferraz, Rivais com respeito, afinidade 38%, caiu 3 hoje',
    ]);
    expect(screen.queryByText('fofocalizei')).toBeNull();

    await fireEvent.press(linhas[2]!);
    expect(router.push).toHaveBeenCalledWith(`/personagem/${vic.id}`);
    await fireEvent.press(screen.getByRole('link', { name: 'Ver mapa de relações' }));
    expect(router.push).toHaveBeenCalledWith('/relacoes');
  });

  it('indicadores da conta e atalhos para aparência, registro, Plus e catálogo', async () => {
    simular();
    await renderizarTela(<TelaPerfil />);

    expect(await screen.findByRole('button', { name: 'Energia 8 de 12' })).toBeTruthy();
    expect(await screen.findByLabelText('40 gemas')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Aparência' }));
    expect(router.push).toHaveBeenCalledWith('/aparencia');
    await fireEvent.press(screen.getByRole('button', { name: 'Registro de atividades' }));
    expect(router.push).toHaveBeenCalledWith('/registro');
    await fireEvent.press(screen.getByRole('button', { name: /^Holofote Plus/ }));
    expect(router.push).toHaveBeenCalledWith('/plus');
    // __DEV__ é verdadeiro no Jest.
    await fireEvent.press(screen.getByRole('button', { name: /^Catálogo de componentes/ }));
    expect(router.push).toHaveBeenCalledWith('/dev/catalogo');
  });

  it('"Recarregar energia (debug)" chama a recarga debug e vibra', async () => {
    simular();
    await renderizarTela(<TelaPerfil />);

    await fireEvent.press(
      await screen.findByRole('button', { name: /^Recarregar energia \(debug\)/ }),
    );
    await waitFor(() =>
      expect(chamadas).toContainEqual({
        metodo: 'POST',
        rota: '/energia/recarga',
        corpo: { via: 'debug' },
      }),
    );
    await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith('success'));
    await screen.findByRole('button', { name: /^Recarregar energia \(debug\), Enche a barra/ });
  });

  it('"Recomeçar mundo" confirma, apaga o mundo, reinicia o cache e volta ao onboarding', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simular();
    const { cliente } = await renderizarTela(<TelaPerfil />);
    const reiniciar = jest.spyOn(cliente, 'resetQueries');
    const leituras = (rota: string) =>
      chamadas.filter((c) => c.metodo === 'GET' && c.rota === rota).length;
    await screen.findByRole('header', { name: 'Lua Prado' });
    const mundosAntes = leituras('/mundos/atual');

    await fireEvent.press(await screen.findByRole('button', { name: /^Recomeçar mundo/ }));
    expect(alerta).toHaveBeenCalledWith(
      'Recomeçar o mundo?',
      expect.stringContaining('Energia e gemas continuam na conta'),
      expect.any(Array),
    );
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);

    const botoes = alerta.mock.calls[0]![2] as AlertButton[];
    await act(async () => botoes.find((b) => b.style === 'destructive')?.onPress?.());

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/criar-mundo'));
    expect(chamadas).toContainEqual({ metodo: 'DELETE', rota: '/mundos/atual', corpo: undefined });
    expect(reiniciar).toHaveBeenCalled();
    // Sem navegador no teste, a tela continua montada: os observadores seguem as queries
    // reiniciadas e o GET novo do mundo chega (com clear() eles ficariam presos às antigas).
    await waitFor(() => expect(leituras('/mundos/atual')).toBe(mundosAntes + 1));
    expect(await screen.findByRole('header', { name: 'Lua Prado' })).toBeTruthy();
    await screen.findAllByRole('button', { name: /, afinidade \d+%/ });
    await screen.findByLabelText('40 gemas');
  });

  it('erro nas relações mostra tentar de novo, não uma lista vazia', async () => {
    simular({ 'GET /relacoes': new ErroDaApi(500, 'interno', 'falhou') });
    await renderizarTela(<TelaPerfil />);
    expect(await screen.findByText('Não deu para carregar suas relações.')).toBeTruthy();
    expect(screen.queryByText('Ninguém do elenco cruzou seu caminho ainda.')).toBeNull();
    simular();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    await screen.findAllByRole('button', { name: /, afinidade \d+%/ });
  });

  it('cancelar a confirmação não apaga nada', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    simular();
    await renderizarTela(<TelaPerfil />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Recomeçar mundo/ }));
    const botoes = alerta.mock.calls[0]![2] as AlertButton[];
    await act(async () => botoes.find((b) => b.style === 'cancel')?.onPress?.());
    expect(chamadas.some((c) => c.metodo === 'DELETE')).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('no tema escuro usa os tokens do escuro', async () => {
    simular();
    await renderizarTela(<TelaPerfil />, { modo: 'escuro' });
    expect(await screen.findByText('Lua Prado')).toHaveStyle({
      color: montarTema('escuro', 'laranja').cores.texto,
    });
    expect(screen.getByText('Ver mapa')).toHaveStyle({
      color: montarTema('escuro', 'laranja').cores.destaqueTinta,
    });
  });

  it('erro ao abrir o mundo mostra tentar de novo', async () => {
    simular({ 'GET /mundos/atual': new ErroDaApi(500, 'interno', 'falhou') });
    await renderizarTela(<TelaPerfil />);
    expect(await screen.findByText('Não deu para abrir seu perfil.')).toBeTruthy();
    simular();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('header', { name: 'Lua Prado' })).toBeTruthy();
  });
});

describe('variação e relações principais', () => {
  it('desfazer anula a ação na soma do dia', () => {
    const agora = Date.now();
    const hoje = new Date(agora).toISOString();
    const soma = variacaoDeHoje(
      [
        { ...registro[0]!, criadoEm: hoje, desfeito: true },
        {
          ...registro[0]!,
          tipo: 'desfazer',
          criadoEm: hoje,
          deltas: registro[0]!.deltas.map((d) => ({ ...d, valor: -d.valor })),
        },
      ],
      agora,
    );
    expect(soma?.get('fama')).toBe(0);
    expect(variacaoDeHoje(undefined, agora)).toBeUndefined();
  });

  it('elenco primeiro, até o limite', () => {
    expect(relacoesPrincipais(relacoes.nos, 2).map((n) => n.personagem.nome)).toEqual([
      'Bento Lima',
      'Duda Marques',
    ]);
  });
});
