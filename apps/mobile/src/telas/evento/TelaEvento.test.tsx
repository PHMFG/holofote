import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { AccessibilityInfo } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { energia, mundo } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { consequencia, eventoAgendado, lua, nina, vic } from './dadosDeTeste';
import { efeitosDosDeltas } from '../../formatar';
import { contagem } from './formatar';
import { TelaEvento } from './TelaEvento';

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

const evento = eventoAgendado();
const rota = `/eventos/${evento.id}`;

function simular(extras: Record<string, unknown> = {}) {
  simularApi({
    'GET /mundos/atual': mundo({ dia: 6 }),
    'GET /energia': energia(8),
    [`GET ${rota}`]: evento,
    ...extras,
  });
}

beforeEach(() => jest.clearAllMocks());

describe('formatar do evento', () => {
  it('conta os dias pelo mundo', () => {
    expect(contagem(evento, 6)).toBe('Faltam 2 dias');
    expect(contagem(evento, 7)).toBe('Amanhã');
    expect(contagem(evento, 8)).toBe('Hoje');
    expect(contagem({ ...evento, estado: 'ao_vivo' }, 8)).toBe('Ao vivo agora');
  });

  it('escreve os deltas do motor com o sinal tipográfico', () => {
    const nomes = new Map([[vic.id, vic.nome]]);
    expect(
      efeitosDosDeltas(
        [
          { alvo: 'fama', valor: 3 },
          { alvo: 'polemica', valor: -2 },
          { alvo: `relacao:${vic.id}`, valor: 4 },
          { alvo: 'gemas', valor: 25 },
          { alvo: 'carisma', valor: 0 },
        ],
        nomes,
      ).map((e) => e.texto),
    ).toEqual(['Fama +3', 'Polêmica −2', 'Vic · relação +4%']);
  });
});

describe('16 · Evento', () => {
  it('mostra o evento, a contagem pelo mundo e os indicados com a chance do motor', async () => {
    simular();
    await renderizarTela(<TelaEvento id={evento.id} />);

    expect(await screen.findByText('Revelação do ano')).toBeTruthy();
    expect(await screen.findByText('Faltam 2 dias · Dia 8, noite')).toBeTruthy();
    expect(screen.getByText('Prêmio Holofote')).toBeTruthy();
    expect(screen.getByLabelText('Vic Ferraz, 41% de chance')).toBeTruthy();
    expect(screen.getByLabelText('Lua Prado · você, 34% de chance')).toBeTruthy();
    expect(screen.getByLabelText('Nina Costa, 25% de chance')).toBeTruthy();
    expect(await screen.findByText('você tem 8 de energia')).toBeTruthy();
    // Só o jogador ganha a barra em destaque; o valor vai para o VoiceOver.
    expect(screen.getByLabelText(`Chance de ${lua.nome}`).props.accessibilityValue).toEqual({
      min: 0,
      max: 100,
      now: 34,
    });
    expect(screen.queryByRole('button', { name: 'Entrar ao vivo' })).toBeNull();
  });

  it('a ação de campanha chama a rota com o id, vibra e vira feita', async () => {
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    simular({
      [`POST ${rota}/campanha`]: (corpo: unknown) => ({
        evento: {
          ...evento,
          indicados: [
            { personagem: vic, chance: 0.38 },
            { personagem: lua, chance: 0.4 },
            { personagem: nina, chance: 0.22 },
          ],
          acoes: evento.acoes.map((a) =>
            a.id === (corpo as { acaoId: string }).acaoId ? { ...a, feita: true } : a,
          ),
        },
        consequencia: consequencia({ energia: energia(7) }),
      }),
    });
    await renderizarTela(<TelaEvento id={evento.id} />);

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Ensaiar o discurso, Libera o discurso ousado., custa 1 de energia',
      }),
    );

    await waitFor(() =>
      expect(chamadas).toContainEqual({
        metodo: 'POST',
        rota: `${rota}/campanha`,
        corpo: { acaoId: 'ensaiar' },
      }),
    );
    expect(await screen.findByLabelText('Feita')).toBeTruthy();
    expect(screen.getByLabelText('Lua Prado · você, 40% de chance')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Ensaiar o discurso/ })).toBeNull();
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(anuncio).toHaveBeenCalledWith('Ensaiar o discurso feito. Sua chance agora é 40%.');
  });

  it('sem energia para a campanha abre a folha 19', async () => {
    simular({
      [`POST ${rota}/campanha`]: () => new ErroDaApi(409, 'sem_energia', 'Sem energia.'),
    });
    await renderizarTela(<TelaEvento id={evento.id} />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Postar bastidores/ }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/sem-energia'));
  });

  it('a prévia do discurso mostra o cadeado e o motivo', async () => {
    simular();
    await renderizarTela(<TelaEvento id={evento.id} />);

    expect(
      await screen.findByLabelText('Discurso Ousado, bloqueado: Ensaie o discurso na campanha.'),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Discurso Especial, bloqueado: Libere o marco 2 da jornada.'),
    ).toBeTruthy();
    expect(screen.getByLabelText(/^Discurso Seguro, liberado/)).toBeTruthy();
  });

  it('ao vivo leva à tela 17 e a campanha fica fechada', async () => {
    const aoVivo = eventoAgendado({ id: evento.id, estado: 'ao_vivo' });
    simular({ [`GET ${rota}`]: aoVivo });
    await renderizarTela(<TelaEvento id={evento.id} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Entrar ao vivo' }));
    expect(router.push).toHaveBeenCalledWith(`/evento/${evento.id}/ao-vivo`);
    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(screen.getByText('campanha encerrada')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /custa \d de energia$/ })).toBeNull();
  });

  it('encerrado mostra o vencedor', async () => {
    simular({
      [`GET ${rota}`]: eventoAgendado({ id: evento.id, estado: 'encerrado', vencedor: lua }),
    });
    await renderizarTela(<TelaEvento id={evento.id} />);

    expect(await screen.findByLabelText('Vencedor: Lua Prado. Você venceu.')).toBeTruthy();
    expect(screen.queryByText('Campanha')).toBeNull();
    expect(screen.getByText('chance final')).toBeTruthy();
  });

  it('evento que não existe mais oferece voltar', async () => {
    simular({ [`GET ${rota}`]: new ErroDaApi(404, 'nao_encontrado', 'Não achei.') });
    await renderizarTela(<TelaEvento id={evento.id} />);

    expect(await screen.findByText('Este evento não existe mais.')).toBeTruthy();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Voltar' })[1]!);
    expect(router.back).toHaveBeenCalled();
  });
});
