import type { ResumoDia } from '@holofote/shared';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ErroDaApi } from '../../api/cliente';
import { simularApi } from '../../testes/api';
import { mundo, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { TelaResumoDoDia, agruparNumeros } from './TelaResumoDoDia';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const eventoId = uuid();
const resumo: ResumoDia = {
  dia: 7,
  manchete: 'Vic e Lua no mesmo estúdio? fontes dizem que sim.',
  numeros: [
    { rotulo: 'Seguidores', valor: '8,9 mil', variacao: 1800 },
    { rotulo: 'Fama', valor: '26%', variacao: 2 },
    { rotulo: 'Polêmica', valor: '15%', variacao: -3 },
  ],
  pendencias: [
    { texto: 'Vic Ferraz mencionou você', destino: { rota: `/post/${uuid()}` } },
    { texto: 'Prêmio Holofote amanhã', destino: { rota: `/evento/${eventoId}` } },
  ],
};

beforeEach(() => jest.clearAllMocks());

describe('20 · Resumo do dia', () => {
  it('mostra o dia, a manchete e os números com a variação', async () => {
    simularApi({ 'GET /resumo-do-dia': resumo, 'GET /mundos/atual': mundo({ periodo: 'manha' }) });
    await renderizarTela(<TelaResumoDoDia />);

    expect(await screen.findByText(resumo.manchete)).toBeTruthy();
    expect(await screen.findByText('Dia 7 · manhã')).toBeTruthy();
    expect(screen.getByText('Enquanto você dormia')).toBeTruthy();
    expect(screen.getByLabelText('Seguidores: 8,9 mil, subiu 1,8 mil')).toBeTruthy();
    expect(screen.getByLabelText('Fama: 26%, subiu 2')).toBeTruthy();
    expect(screen.getByLabelText('Polêmica: 15%, caiu 3')).toBeTruthy();
    expect(screen.getByText('+1,8 mil')).toBeTruthy();
    expect(screen.getByText('−3')).toBeTruthy();
  });

  it('no dia 1 do mundo o título não fala em dormir', async () => {
    simularApi({
      'GET /resumo-do-dia': { ...resumo, dia: 1 },
      'GET /mundos/atual': mundo({ dia: 1 }),
    });
    await renderizarTela(<TelaResumoDoDia />);

    expect(await screen.findByRole('header', { name: 'Seu primeiro dia' })).toBeTruthy();
    expect(screen.queryByText('Enquanto você dormia')).toBeNull();
  });

  it('a pendência longa ocupa até duas linhas', async () => {
    const longa = 'Vic Ferraz mencionou você num post que está rendendo muito no feed hoje';
    simularApi({
      'GET /resumo-do-dia': {
        ...resumo,
        pendencias: [{ texto: longa, destino: { rota: '/feed' } }],
      },
      'GET /mundos/atual': mundo(),
    });
    await renderizarTela(<TelaResumoDoDia />);

    expect(await screen.findByText(longa)).toHaveProp('numberOfLines', 2);
  });

  it('cada pendência leva ao destino e o botão começa o dia', async () => {
    simularApi({ 'GET /resumo-do-dia': resumo, 'GET /mundos/atual': mundo() });
    await renderizarTela(<TelaResumoDoDia />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Prêmio Holofote amanhã' }));
    expect(router.push).toHaveBeenCalledWith(`/evento/${eventoId}`);

    await fireEvent.press(screen.getByRole('button', { name: 'Começar o dia' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('sem resumo (404) mostra o estado vazio', async () => {
    simularApi({
      'GET /resumo-do-dia': new ErroDaApi(404, 'nao_encontrado', 'Ainda não há resumo do dia.'),
      'GET /mundos/atual': mundo(),
    });
    await renderizarTela(<TelaResumoDoDia />);

    expect(
      await screen.findByText(
        'O resumo de hoje ainda não saiu. Ele chega com o lote da madrugada.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Começar o dia' })).toBeNull();
  });

  it('erro de rede oferece tentar de novo', async () => {
    simularApi({
      'GET /resumo-do-dia': new ErroDaApi(500, 'desconhecido', 'Falhou.'),
      'GET /mundos/atual': mundo(),
    });
    await renderizarTela(<TelaResumoDoDia />);

    expect(await screen.findByText('Não deu para abrir o resumo do dia.')).toBeTruthy();
  });
});

describe('agruparNumeros', () => {
  const ate = (n: number) => Array.from({ length: n }, (_, i) => i);
  it('três por linha, e com um cartão sobrando as duas últimas linhas ficam com dois', () => {
    expect(agruparNumeros(ate(3)).map((l) => l.length)).toEqual([3]);
    expect(agruparNumeros(ate(4)).map((l) => l.length)).toEqual([2, 2]);
    expect(agruparNumeros(ate(5)).map((l) => l.length)).toEqual([3, 2]);
    expect(agruparNumeros(ate(6)).map((l) => l.length)).toEqual([3, 3]);
    expect(agruparNumeros(ate(7)).map((l) => l.length)).toEqual([3, 2, 2]);
    expect(agruparNumeros(ate(1)).map((l) => l.length)).toEqual([1]);
    expect(agruparNumeros(ate(4)).flat()).toEqual(ate(4));
  });
});
