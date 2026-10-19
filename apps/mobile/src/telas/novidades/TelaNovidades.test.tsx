import { fireEvent, screen } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { armazenamento } from '../../estado/armazenamento';
import {
  CHAVE_NOVIDADES_VISTAS,
  NOVIDADES,
  novidadesNaoVistas,
  type Novidade,
} from '../../novidades';
import { renderizarTela } from '../../testes/renderizarTela';
import { TelaNovidades } from './TelaNovidades';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

const lista: Novidade[] = [
  { id: 'c', data: 'hoje', itens: ['três'] },
  { id: 'b', data: 'ontem', itens: ['dois'] },
  { id: 'a', data: 'antes', itens: ['um'] },
];

beforeEach(() => {
  jest.clearAllMocks();
  armazenamento.remove(CHAVE_NOVIDADES_VISTAS);
});

describe('novidadesNaoVistas', () => {
  it('sem registro mostra tudo; com registro, só o que veio depois', () => {
    expect(novidadesNaoVistas(undefined, lista).map((n) => n.id)).toEqual(['c', 'b', 'a']);
    expect(novidadesNaoVistas('b', lista).map((n) => n.id)).toEqual(['c']);
    expect(novidadesNaoVistas('c', lista)).toEqual([]);
  });
});

describe('Novidades', () => {
  it('mostra o que é novo, marca como visto e fecha em Continuar', async () => {
    await renderizarTela(<TelaNovidades />);
    expect(screen.getByRole('header', { name: 'Novidades desta versão' })).toBeTruthy();
    expect(screen.getByText(NOVIDADES[0]!.itens[0]!)).toBeTruthy();
    expect(armazenamento.getString(CHAVE_NOVIDADES_VISTAS)).toBe(NOVIDADES[0]!.id);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(router.back).toHaveBeenCalled();
  });

  it('pelo perfil mostra o histórico inteiro, mesmo com tudo visto', async () => {
    armazenamento.set(CHAVE_NOVIDADES_VISTAS, NOVIDADES[0]!.id);
    jest.mocked(useLocalSearchParams).mockReturnValue({ todas: '1' });
    await renderizarTela(<TelaNovidades />);
    expect(screen.getByRole('header', { name: 'Notas de atualização' })).toBeTruthy();
    const ultima = NOVIDADES[NOVIDADES.length - 1]!;
    expect(screen.getByText(ultima.itens[0]!)).toBeTruthy();
  });
});
