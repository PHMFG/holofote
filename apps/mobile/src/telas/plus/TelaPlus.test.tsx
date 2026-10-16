import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AccessibilityInfo, Alert } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { conta, energia } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { TelaPlus } from './TelaPlus';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

const gratis = conta();
const plus = conta({
  usuarioId: gratis.usuarioId,
  plano: 'plus',
  energia: energia(20, 24, 'plus'),
});

const pedidosPlus = () => chamadas.filter((c) => c.metodo === 'POST' && c.rota === '/conta/plus');

function simular(inicial = gratis, extras: Record<string, unknown> = {}) {
  simularApi({
    'GET /conta': inicial,
    'POST /conta/plus': (corpo: unknown) => ((corpo as { ativo: boolean }).ativo ? plus : gratis),
    ...extras,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('11 · Holofote Plus', () => {
  it('mostra os benefícios sem números nem preços e o aviso de versão de teste', async () => {
    simular();
    await renderizarTela(<TelaPlus />);

    expect(await screen.findByText('Holofote Plus')).toBeTruthy();
    for (const beneficio of [
      'Energia em dobro',
      'Recarga mais rápida',
      'Sem anúncios',
      'Personagens puxam conversa com mais frequência',
    ]) {
      expect(screen.getByLabelText(beneficio)).toBeTruthy();
    }
    // Sem seletor de plano nem preço: não há cobrança para escolher.
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByText(/R\$/)).toBeNull();
    expect(screen.getByText('Versão de teste: nenhuma cobrança é feita.')).toBeTruthy();
  });

  it('ativar liga o Plus na conta, sem cobrança, e mostra o plano ativo', async () => {
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    simular();
    await renderizarTela(<TelaPlus />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ativar Plus de teste' }));

    expect(await screen.findByText('Você é Plus')).toBeTruthy();
    expect(pedidosPlus()).toEqual([
      { metodo: 'POST', rota: '/conta/plus', corpo: { ativo: true } },
    ]);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(anuncio).toHaveBeenCalledWith(
      'Holofote Plus ativado. Versão de teste: nenhuma cobrança é feita.',
    );
    expect(screen.getByText(/Sua energia vai até 24 e recarrega a cada 10 min/)).toBeTruthy();
    expect(screen.getByText('Versão de teste: nenhuma cobrança é feita.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ativar Plus de teste' })).toBeNull();
  });

  it('com a conta já Plus, volta para o gratuito', async () => {
    simular(plus);
    await renderizarTela(<TelaPlus />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Voltar para o gratuito' }));

    expect(await screen.findByRole('button', { name: 'Ativar Plus de teste' })).toBeTruthy();
    expect(pedidosPlus()).toEqual([
      { metodo: 'POST', rota: '/conta/plus', corpo: { ativo: false } },
    ]);
  });

  it('erro ao ativar explica e mantém o plano gratuito', async () => {
    simular(gratis, {
      'POST /conta/plus': () => new ErroDaApi(500, 'desconhecido', 'Algo deu errado.'),
    });
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderizarTela(<TelaPlus />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Ativar Plus de teste' }));

    await waitFor(() => expect(alerta).toHaveBeenCalledWith('Não deu certo', 'Algo deu errado.'));
    expect(screen.getByText('Holofote Plus')).toBeTruthy();
  });

  it('fecha pelo X', async () => {
    simular();
    await renderizarTela(<TelaPlus />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Fechar' }));
    expect(router.back).toHaveBeenCalled();
  });
});
