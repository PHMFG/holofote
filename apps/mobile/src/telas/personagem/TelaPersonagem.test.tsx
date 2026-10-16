import { montarTema } from '@holofote/tokens';
import type { Conversa, ItemRegistro, Personagem } from '@holofote/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { jogador, personagem, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { separarDia } from './memorias';
import { TelaPersonagem } from './TelaPersonagem';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const vic = (p: Partial<Personagem> = {}): Personagem => ({
  ...jogador(),
  ...personagem({ nome: 'Vic Ferraz', handle: '@vicferraz', iniciais: 'VF', tomAvatar: 'medio' }),
  ficha: 'turnê 2026 em ensaio. não respondo indireta (respondo).',
  fama: 82,
  carisma: 70,
  polemica: 35,
  seguidores: 12_400_000,
  relacao: { afinidade: 38, rotulo: 'Rivais com respeito' },
  lembra: [
    'Dia 6 · mandou indireta sobre feat',
    'Dia 4 · recusou um feat em público',
    'elogiou o clipe dela',
  ],
  ...p,
});

const registroDeHoje = (id: string): ItemRegistro[] => [
  {
    eventoId: uuid(),
    tipo: 'post',
    resumo: 'Publicou: "sem feat, sem desculpa"',
    criadoEm: new Date().toISOString(),
    deltas: [{ alvo: `relacao:${id}`, valor: -3 }],
    desfazivel: true,
    desfeito: false,
  },
];

function simular(p: Personagem, rotas: Record<string, unknown> = {}) {
  const conversa: Conversa = {
    id: uuid(),
    personagem: personagem({ id: p.id, nome: p.nome }),
    relacao: p.relacao ?? { afinidade: 50, rotulo: 'Conhecidos' },
    ultima: null,
    naoLidas: 0,
    puxouConversa: false,
  };
  simularApi({
    [`GET /personagens/${p.id}`]: p,
    'GET /registro': registroDeHoje(p.id),
    [`POST /personagens/${p.id}/conversa`]: conversa,
    ...rotas,
  });
  return conversa;
}

beforeEach(() => jest.clearAllMocks());

describe('08 · Perfil de personagem', () => {
  it('mostra identidade, ficha da IA, números e a relação com você', async () => {
    const p = vic();
    simular(p);
    await renderizarTela(<TelaPersonagem id={p.id} />);

    expect(await screen.findByRole('header', { name: 'Vic Ferraz, verificado' })).toBeTruthy();
    expect(screen.getByText('@vicferraz')).toBeTruthy();
    expect(
      screen.getByText('turnê 2026 em ensaio. não respondo indireta (respondo).'),
    ).toBeTruthy();
    expect(screen.getByText('12,4 mi')).toBeTruthy();
    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getByLabelText('Sua relação: Rivais com respeito, 38%')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Afinidade com Vic' })).toHaveProp(
      'accessibilityValue',
      { min: 0, max: 100, now: 38 },
    );
    // Variação de hoje, somada do registro.
    expect(await screen.findByLabelText('Afinidade caiu 3% hoje')).toBeTruthy();
    expect(screen.getByText('3% hoje')).toBeTruthy();
  });

  it('"O que lembra de você" separa o dia em pílula e destaca o título', async () => {
    const p = vic();
    simular(p);
    await renderizarTela(<TelaPersonagem id={p.id} />);

    expect(await screen.findByText('O que Vic lembra de você')).toHaveStyle({
      color: montarTema('claro', 'laranja').cores.destaqueTinta,
    });
    expect(screen.getByLabelText('Dia 6: mandou indireta sobre feat')).toBeTruthy();
    expect(screen.getByText('Dia 4')).toBeTruthy();
    expect(screen.getByLabelText('elogiou o clipe dela')).toBeTruthy();
  });

  it('sem memórias, diz que ainda não lembra de nada', async () => {
    const p = vic({ lembra: [] });
    simular(p);
    await renderizarTela(<TelaPersonagem id={p.id} />);
    expect(await screen.findByText('Ainda não guardou nenhuma lembrança sua.')).toBeTruthy();
  });

  it('"Mandar mensagem" abre (ou reaproveita) a conversa e vai para a DM', async () => {
    const p = vic();
    const conversa = simular(p);
    await renderizarTela(<TelaPersonagem id={p.id} />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Mandar mensagem' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dm/${conversa.id}`));
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/personagens/${p.id}/conversa`,
      corpo: undefined,
    });
    expect(await screen.findByRole('button', { name: 'Mandar mensagem' })).toBeEnabled();
  });

  it('erro ao abrir a conversa explica o motivo', async () => {
    const alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const p = vic();
    simular(p, {
      [`POST /personagens/${p.id}/conversa`]: new ErroDaApi(
        409,
        'mundo_criando',
        'Calma, o mundo ainda está nascendo.',
      ),
    });
    await renderizarTela(<TelaPersonagem id={p.id} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Mandar mensagem' }));
    await waitFor(() =>
      expect(alerta).toHaveBeenCalledWith('Não deu certo', 'Calma, o mundo ainda está nascendo.'),
    );
    expect(router.push).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Mandar mensagem' })).toBeEnabled();
  });

  it('o próprio jogador não tem botão de mensagem nem memórias', async () => {
    const eu = jogador();
    simular(eu);
    await renderizarTela(<TelaPersonagem id={eu.id} />);
    expect(await screen.findByText('@luaprado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mandar mensagem' })).toBeNull();
    expect(screen.queryByText(/lembra de você/)).toBeNull();
  });

  it('personagem de outro mundo mostra o estado vazio', async () => {
    const id = uuid();
    simularApi({
      [`GET /personagens/${id}`]: new ErroDaApi(
        404,
        'nao_encontrado',
        'Personagem não encontrado.',
      ),
    });
    await renderizarTela(<TelaPersonagem id={id} />);
    expect(await screen.findByText('Esse personagem não está no seu mundo.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('erro de rede mostra tentar de novo', async () => {
    const p = vic();
    simularApi({ [`GET /personagens/${p.id}`]: new ErroDaApi(500, 'interno', 'falhou') });
    await renderizarTela(<TelaPersonagem id={p.id} />);
    expect(await screen.findByText('Não deu para abrir o perfil.')).toBeTruthy();
    simular(p);
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('@vicferraz')).toBeTruthy();
  });
});

describe('memórias', () => {
  it('separa "Dia N · texto" e mantém o resto', () => {
    expect(separarDia('Dia 12 · topou o estúdio')).toEqual({
      dia: 'Dia 12',
      texto: 'topou o estúdio',
    });
    expect(separarDia(' viu você apagar um post ')).toEqual({
      dia: null,
      texto: 'viu você apagar um post',
    });
  });
});
