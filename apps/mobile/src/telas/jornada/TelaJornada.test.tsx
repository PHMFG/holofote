import type { Marco } from '@holofote/shared';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ErroDaApi } from '../../api/cliente';
import { simularApi } from '../../testes/api';
import { conta, energia, mundo, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { aplicarNoCache } from '../../api/tempoReal';
import { jornada, marco, marcosDoAto } from './dadosDeTeste';
import { progressoDoMarco, textoRequisito } from './jornada';
import { TelaJornada } from './TelaJornada';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const evento = {
  id: uuid(),
  titulo: 'Prêmio Holofote',
  quando: { dia: 8, periodo: 'noite' as const },
  estado: 'anunciado' as const,
};

function simular(rotas: Record<string, unknown> = {}) {
  simularApi({
    'GET /jornada': jornada({ proximoEvento: evento }),
    'GET /mundos/atual': mundo({ dia: 6 }),
    'GET /energia': energia(8, 12),
    'GET /conta': conta(),
    ...rotas,
  });
}

/** Abre a tela e espera a jornada, o mundo e a energia chegarem (o cartão de energia é o último). */
async function abrir() {
  await renderizarTela(<TelaJornada />);
  await screen.findByRole('button', { name: /^Energia 8 de 12/ });
}

beforeEach(() => jest.clearAllMocks());

describe('06 · Jornada', () => {
  it('mostra o ato, o objetivo, a trilha e o próximo marco com os requisitos', async () => {
    simular();
    await abrir();

    expect(await screen.findByRole('header', { name: 'Ato 1' })).toBeTruthy();
    expect(screen.getByText('Marco 2 de 5')).toBeTruthy();
    expect(screen.getByText('Dominar o pop nacional')).toBeTruthy();
    expect(screen.getByText('4%')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Objetivo do ato' })).toBeTruthy();

    // Trilha: concluído é tocável; atual e futuros só informam.
    expect(
      screen.getByRole('button', { name: 'Marco 1: Primeiro single, concluído' }),
    ).toBeTruthy();
    expect(screen.getByLabelText('Marco 2: Primeiro show lotado, em andamento')).toBeTruthy();
    expect(screen.getByLabelText('Marco 5: Disco de ouro, bloqueado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Marco 2:/ })).toBeNull();

    expect(screen.getByText('Primeiro show lotado')).toBeTruthy();
    expect(screen.getByLabelText('Escândalos administrados, 2 de 4')).toBeTruthy();
    expect(screen.getByLabelText('Carisma, 61 de 70')).toBeTruthy();
    expect(screen.getByLabelText('Seguidores, 7,1 mil de 10 mil')).toBeTruthy();
    expect(
      screen.getByLabelText(
        'Recompensa: +25 gemas, energia cheia, ação nova: Anunciar a turnê, personagem novo',
      ),
    ).toBeTruthy();
    // Sem marco para resgatar, não há botão metálico.
    expect(screen.queryByRole('button', { name: 'Resgatar' })).toBeNull();
  });

  it('próximo evento, resumo do dia, registro e energia levam às telas certas', async () => {
    simular();
    await abrir();

    await fireEvent.press(
      await screen.findByRole('button', {
        name: 'Prêmio Holofote em 2 dias. Dia 8, noite · anunciado',
      }),
    );
    expect(router.push).toHaveBeenCalledWith(`/evento/${evento.id}`);

    await fireEvent.press(screen.getByRole('button', { name: 'Resumo do dia' }));
    expect(router.push).toHaveBeenCalledWith('/resumo-do-dia');

    await fireEvent.press(screen.getByRole('button', { name: 'Registro de atividades' }));
    expect(router.push).toHaveBeenCalledWith('/registro');

    await fireEvent.press(await screen.findByRole('button', { name: /^Energia 8 de 12/ }));
    expect(router.push).toHaveBeenCalledWith('/sem-energia');
  });

  it('marco liberado e não resgatado mostra "Resgatar" e abre a tela 18', async () => {
    const marcos = marcosDoAto();
    marcos[1] = { ...marcos[1]!, estado: 'concluido', liberadoEm: '2026-10-16T20:00:00Z' };
    marcos[2] = { ...marcos[2]!, estado: 'atual' };
    simular({ 'GET /jornada': jornada({ marcos }) });
    await abrir();

    expect(await screen.findByText('Marco liberado')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Resgatar' }));
    expect(router.push).toHaveBeenCalledWith(`/marco/${marcos[1]!.id}`);
    expect(
      screen.getByRole('button', {
        name: 'Marco 2: Primeiro show lotado, concluído, recompensa para resgatar',
      }),
    ).toBeTruthy();
  });

  it('tocar num marco concluído abre a tela 18', async () => {
    const marcos = marcosDoAto();
    simular({ 'GET /jornada': jornada({ marcos }) });
    await abrir();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Marco 1: Primeiro single, concluído' }),
    );
    expect(router.push).toHaveBeenCalledWith(`/marco/${marcos[0]!.id}`);
  });

  it('com todos os marcos liberados, o ato aparece como concluído', async () => {
    const marcos: Marco[] = marcosDoAto().map((m) => ({
      ...m,
      estado: 'concluido',
      liberadoEm: '2026-10-16T20:00:00Z',
      resgatado: true,
    }));
    simular({ 'GET /jornada': jornada({ marcos, progressoAto: 1, proximoEvento: null }) });
    await abrir();
    expect(await screen.findByText('Ato concluído')).toBeTruthy();
    expect(screen.getByText('5 de 5 marcos')).toBeTruthy();
    expect(screen.getByText('Nenhum evento agendado por enquanto.')).toBeTruthy();
  });

  describe('virada de ato', () => {
    const todosResgatados = (): Marco[] =>
      marcosDoAto().map((m) => ({
        ...m,
        estado: 'concluido',
        liberadoEm: '2026-10-16T20:00:00Z',
        resgatado: true,
      }));

    it('com o ato resgatado e o próximo chegando, mostra que o próximo ato está sendo escrito', async () => {
      simular({
        'GET /jornada': jornada({
          marcos: todosResgatados(),
          progressoAto: 1,
          proximoAto: { ato: 2 },
        }),
      });
      await abrir();
      expect(await screen.findByText('O próximo ato está sendo escrito')).toBeTruthy();
      expect(screen.getByText(/O Ato 2 chega em instantes/)).toBeTruthy();
      expect(screen.queryByText('Ato concluído')).toBeNull();
      expect(screen.queryByText('Próximo marco')).toBeNull();
      // O ato que acabou continua visível enquanto o novo não chega.
      expect(screen.getByRole('header', { name: 'Ato 1' })).toBeTruthy();
    });

    it('quando o evento mundo chega, a jornada se atualiza e mostra o ato novo', async () => {
      let nova = false;
      const atoDois = jornada({
        ato: 2,
        objetivo: 'Provar que a fama veio para ficar',
        progressoAto: 0,
        marcos: [
          marco({ ordem: 1, titulo: 'Fama posta à prova', estado: 'atual' }),
          marco({ ordem: 2, titulo: 'Novos rivais', estado: 'futuro' }),
          marco({ ordem: 3, titulo: 'Assunto do momento', estado: 'futuro' }),
          marco({ ordem: 4, titulo: 'Aliados de peso', estado: 'futuro' }),
          marco({ ordem: 5, titulo: 'Lenda em vida', estado: 'futuro' }),
        ],
      });
      simular({
        'GET /jornada': () =>
          nova
            ? atoDois
            : jornada({ marcos: todosResgatados(), progressoAto: 1, proximoAto: { ato: 2 } }),
      });
      const { cliente } = await renderizarTela(<TelaJornada />);
      expect(await screen.findByText('O próximo ato está sendo escrito')).toBeTruthy();

      nova = true;
      await act(async () => {
        aplicarNoCache(cliente, { tipo: 'mundo', mundo: mundo({ ato: 2, estado: 'pronto' }) });
      });
      expect(await screen.findByRole('header', { name: 'Ato 2' })).toBeTruthy();
      expect(screen.getByText('Provar que a fama veio para ficar')).toBeTruthy();
      expect(screen.queryByText('O próximo ato está sendo escrito')).toBeNull();
      expect(screen.getByText('Fama posta à prova')).toBeTruthy();
    });
  });

  it('erro ao carregar mostra o cartão com tentar de novo', async () => {
    simular({ 'GET /jornada': new ErroDaApi(500, 'interno', 'falhou') });
    await renderizarTela(<TelaJornada />);
    expect(await screen.findByText('Não deu para carregar a jornada.')).toBeTruthy();
    simular();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('header', { name: 'Ato 1' })).toBeTruthy();
    await screen.findByRole('button', { name: /^Energia 8 de 12/ });
  });
});

describe('cálculos da jornada', () => {
  it('progresso do marco é a média dos requisitos, limitada a 100%', () => {
    const [, atual] = marcosDoAto();
    expect(progressoDoMarco(atual)).toBeCloseTo((0.5 + 61 / 70 + 0.71) / 3);
    expect(
      progressoDoMarco({ ...atual!, requisitos: [{ chave: 'x', rotulo: 'x', atual: 9, alvo: 3 }] }),
    ).toBe(1);
    expect(textoRequisito({ chave: 's', rotulo: 'Seguidores', atual: 7100, alvo: 10000 })).toBe(
      '7,1 mil de 10 mil',
    );
    // Passou da meta: mostra a meta.
    expect(textoRequisito({ chave: 'p', rotulo: 'Posts', atual: 13, alvo: 9 })).toBe('9 de 9');
  });
});
