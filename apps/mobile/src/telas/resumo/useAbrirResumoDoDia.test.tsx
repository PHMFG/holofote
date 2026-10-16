import type { Mundo, ResumoDia } from '@holofote/shared';
import { act, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { useMundo } from '../../api/consultas';
import { armazenamento } from '../../estado/armazenamento';
import { chamadas, simularApi } from '../../testes/api';
import { mundo } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { CHAVE_DIA_VISTO, CHAVE_RESUMO_MOSTRADO, useAbrirResumoDoDia } from './useAbrirResumoDoDia';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
}));

const resumo = (dia: number): ResumoDia => ({
  dia,
  manchete: 'manchete',
  numeros: [],
  pendencias: [],
});

function Abas() {
  useAbrirResumoDoDia();
  const mundo = useMundo();
  return <Text>{mundo.data ? `mundo ${mundo.data.estado}` : 'carregando'}</Text>;
}

async function abrir(m: Mundo, respostaResumo: unknown) {
  simularApi({ 'GET /mundos/atual': m, 'GET /resumo-do-dia': respostaResumo });
  await renderizarTela(<Abas />);
  await screen.findByText(`mundo ${m.estado}`);
}

/** Deixa a resposta do resumo chegar e os efeitos rodarem. */
const assentar = () => act(() => new Promise<void>((pronto) => setTimeout(pronto, 20)));

const leiturasDoResumo = () => chamadas.filter((c) => c.rota === '/resumo-do-dia').length;

beforeEach(() => {
  jest.clearAllMocks();
  armazenamento.clearAll();
});

describe('useAbrirResumoDoDia', () => {
  it('abre o resumo na primeira visita do dia e guarda o dia no MMKV', async () => {
    const m = mundo({ dia: 7 });
    await abrir(m, resumo(7));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/resumo-do-dia'));
    expect(armazenamento.getString(CHAVE_DIA_VISTO)).toBe(`${m.id}:7`);
    expect(armazenamento.getString(CHAVE_RESUMO_MOSTRADO)).toBe(`${m.id}:7`);
  });

  it('não abre de novo no mesmo dia nem pede o resumo', async () => {
    const m = mundo({ dia: 7 });
    armazenamento.set(CHAVE_DIA_VISTO, `${m.id}:7`);
    await abrir(m, resumo(7));

    expect(leiturasDoResumo()).toBe(0);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('sem resumo (404) não abre e tenta na próxima visita', async () => {
    const m = mundo({ dia: 7 });
    await abrir(m, new ErroDaApi(404, 'nao_encontrado', 'Ainda não há resumo do dia.'));

    await waitFor(() => expect(leiturasDoResumo()).toBe(1));
    await assentar();
    expect(router.push).not.toHaveBeenCalled();
    expect(armazenamento.getString(CHAVE_DIA_VISTO)).toBeUndefined();
  });

  it('dia novo sem resumo novo não reabre o de ontem', async () => {
    const m = mundo({ dia: 8 });
    armazenamento.set(CHAVE_DIA_VISTO, `${m.id}:7`);
    armazenamento.set(CHAVE_RESUMO_MOSTRADO, `${m.id}:7`);
    await abrir(m, resumo(7));

    await waitFor(() => expect(leiturasDoResumo()).toBe(1));
    await assentar();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('mundo ainda sendo criado não abre nada', async () => {
    await abrir(mundo({ estado: 'criando' }), resumo(1));

    expect(leiturasDoResumo()).toBe(0);
    expect(router.push).not.toHaveBeenCalled();
  });
});
