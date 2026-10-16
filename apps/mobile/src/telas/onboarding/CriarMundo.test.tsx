import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import CriarMundo from '../../app/(onboarding)/criar-mundo';
import { ErroDaApi } from '../../api/cliente';
import { chaves } from '../../api/consultas';
import { chamadas, simularApi } from '../../testes/api';
import { mundo } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { relacoes } from '../post/dadosDeTeste';
import {
  erroDoHandle,
  iniciaisDe,
  montarPedido,
  normalizarHandle,
  FORM_INICIAL,
} from './formulario';

jest.mock('../../api/cliente', () =>
  jest.requireActual<typeof import('../../testes/api')>('../../testes/api').moduloClienteSimulado(),
);
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

const criando = mundo({ universo: 'Reality show', tomCaos: 70, estado: 'criando' });
const pronto = { ...criando, estado: 'pronto' as const };

const corpos = (rota: string) => chamadas.filter((c) => c.rota === rota).map((c) => c.corpo);

/** Passo 1: liga o aceite e continua. */
async function aceitarIA() {
  await fireEvent.press(
    await screen.findByRole('switch', { name: 'Aceito o uso de IA de terceiros' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
}

async function preencherPersona() {
  await fireEvent.changeText(screen.getByLabelText('Nome'), 'Lua Prado');
  await fireEvent.changeText(screen.getByLabelText('Arroba'), 'LuaPrado');
  await fireEvent.changeText(screen.getByLabelText('Quem você é'), 'cantora em ascensão');
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('01 · Criar mundo', () => {
  it('sem o aceite de IA não avança', async () => {
    // Sem mundo: a rota não simulada responde 404 nao_encontrado.
    simularApi({});
    await renderizarTela(<CriarMundo />);
    expect(await screen.findByText('Antes de começar')).toBeTruthy();
    expect(screen.getByText(/modelos de IA de terceiros, pelo OpenCode/)).toBeTruthy();
    const continuar = screen.getByRole('button', { name: 'Continuar' });
    expect(continuar).toBeDisabled();
    await fireEvent.press(continuar);
    expect(screen.queryByText('Monte o seu mundo')).toBeNull();
    await aceitarIA();
    expect(screen.getByText('Monte o seu mundo')).toBeTruthy();
  });

  it('cria o mundo com o corpo certo, acompanha a geração e mostra o elenco', async () => {
    simularApi({ 'POST /mundos': criando });
    const { cliente } = await renderizarTela(<CriarMundo />);
    await aceitarIA();
    const criar = screen.getByRole('button', { name: 'Criar mundo' });
    expect(criar).toBeDisabled();
    await preencherPersona();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Reality show' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Criar mundo' }));

    expect(await screen.findByText('Gerando seu mundo')).toBeTruthy();
    expect(corpos('/mundos')).toEqual([
      {
        universo: 'Reality show',
        tomCaos: 70,
        persona: { nome: 'Lua Prado', handle: '@luaprado', descricao: 'cantora em ascensão' },
        consentimentoIA: true,
      },
    ]);

    // O evento "mundo" do tempo real grava o mundo pronto no cache (api/tempoReal).
    simularApi({ 'GET /mundos/atual': pronto, 'GET /relacoes': relacoes() });
    await act(async () => {
      cliente.setQueryData(chaves.mundo, pronto);
    });
    expect(await screen.findByText('Seu mundo está pronto')).toBeTruthy();
    expect(await screen.findByText('Vic Ferraz')).toBeTruthy();
    expect(screen.getByText('@vicferraz · rival')).toBeTruthy();
    expect(screen.getByText('+ 1 figurante')).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar em cena' }));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('sem tempo real, consulta o mundo a cada 3 s até ficar pronto', async () => {
    jest.useFakeTimers();
    try {
      simularApi({ 'GET /mundos/atual': criando });
      await renderizarTela(<CriarMundo />);
      expect(await screen.findByText('Gerando seu mundo')).toBeTruthy();
      const consultas = () => corpos('/mundos/atual').length;
      // simularApi zera o registro de chamadas: a contagem recomeça daqui.
      simularApi({ 'GET /mundos/atual': pronto, 'GET /relacoes': relacoes() });
      // Antes dos 3 s ninguém pergunta; no terceiro segundo o plano B consulta o mundo.
      await act(async () => {
        await jest.advanceTimersByTimeAsync(2900);
      });
      expect(consultas()).toBe(0);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(200);
      });
      expect(await screen.findByText('Seu mundo está pronto')).toBeTruthy();
      expect(consultas()).toBeGreaterThan(0);
      expect(router.replace).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('com o mundo já pronto ao abrir, vai direto para o feed', async () => {
    simularApi({ 'GET /mundos/atual': pronto });
    await renderizarTela(<CriarMundo />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('"Criar do zero" manda o universo escrito pelo jogador', async () => {
    simularApi({ 'POST /mundos': criando });
    await renderizarTela(<CriarMundo />);
    await aceitarIA();
    await preencherPersona();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar do zero' }));
    await fireEvent.changeText(screen.getByLabelText('Descreva o universo'), ' banda de forró ');
    await fireEvent.press(screen.getByRole('button', { name: 'Criar mundo' }));
    await waitFor(() => expect(corpos('/mundos')).toHaveLength(1));
    expect(corpos('/mundos')[0]).toMatchObject({ universo: 'banda de forró' });
  });

  it('arroba com caractere inválido mostra o motivo no campo e trava o botão', async () => {
    simularApi({});
    await renderizarTela(<CriarMundo />);
    await aceitarIA();
    await preencherPersona();
    expect(screen.queryByText(/^Use só letras/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Criar mundo' })).toBeEnabled();

    await fireEvent.changeText(screen.getByLabelText('Arroba'), 'lu#a');
    expect(screen.getByText('Use só letras, números, ponto e sublinhado na arroba.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Criar mundo' })).toBeDisabled();
  });

  it('o tom do mundo é ajustável pelo VoiceOver', async () => {
    simularApi({});
    await renderizarTela(<CriarMundo />);
    await aceitarIA();
    const controle = screen.getByRole('adjustable', {
      name: 'Tom do mundo, de acolhedor a caótico',
    });
    expect(controle).toHaveAccessibilityValue({ now: 70, text: '70% caótico' });
    await fireEvent(controle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(screen.getByText('80% caótico')).toBeTruthy();
    await fireEvent(controle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent(controle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(screen.getByText('60% caótico')).toBeTruthy();
  });

  it('erro da IA explica e permite tentar de novo', async () => {
    simularApi({ 'GET /mundos/atual': { ...criando, estado: 'erro' } });
    await renderizarTela(<CriarMundo />);
    expect(await screen.findByText('O mundo não saiu')).toBeTruthy();
    // Sem o pedido desta sessão (app reaberto), tentar de novo volta ao formulário.
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(screen.getByText('Monte o seu mundo')).toBeTruthy();
  });

  it('texto barrado pela moderação explica o motivo', async () => {
    simularApi({
      'POST /mundos': new ErroDaApi(422, 'moderacao', 'Nada de pessoas reais no elenco.'),
    });
    await renderizarTela(<CriarMundo />);
    await aceitarIA();
    await preencherPersona();
    await fireEvent.press(screen.getByRole('button', { name: 'Criar mundo' }));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith(
        'Não deu para criar o mundo',
        'Nada de pessoas reais no elenco.',
      ),
    );
    expect(screen.getByText('Monte o seu mundo')).toBeTruthy();
  });
});

describe('formulário de criar mundo', () => {
  it('explica por que a arroba não vale', () => {
    expect(erroDoHandle('')).toBeNull();
    expect(erroDoHandle('@Lua.Prado_9')).toBeNull();
    expect(erroDoHandle('lu#a')).toBe('Use só letras, números, ponto e sublinhado na arroba.');
    expect(erroDoHandle('lúa')).toMatch(/^Use só letras/);
    expect(erroDoHandle('a')).toBe('A arroba precisa ter de 2 a 24 caracteres.');
    expect(erroDoHandle('a'.repeat(25))).toBe('A arroba precisa ter de 2 a 24 caracteres.');
  });

  it('normaliza a arroba e tira as iniciais', () => {
    expect(normalizarHandle(' @@Lua Prado ')).toBe('@luaprado');
    expect(normalizarHandle('')).toBe('');
    expect(iniciaisDe('lua prado da silva')).toBe('LP');
    expect(iniciaisDe('  ')).toBe('');
  });

  it('só monta o pedido com todos os campos válidos', () => {
    expect(montarPedido(FORM_INICIAL)).toBeNull();
    const valido = { ...FORM_INICIAL, nome: 'Lua', handle: 'lua', descricao: 'cantora' };
    expect(montarPedido(valido)).toEqual({
      universo: 'Pop Brasil',
      tomCaos: 70,
      persona: { nome: 'Lua', handle: '@lua', descricao: 'cantora' },
      consentimentoIA: true,
    });
    expect(montarPedido({ ...valido, livre: true, universoLivre: ' ' })).toBeNull();
    expect(montarPedido({ ...valido, handle: 'a' })).toBeNull();
  });
});
