import { montarTema } from '@holofote/tokens';
import { act, render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Appearance, Text } from 'react-native';
import { useAparencia } from '../estado/aparencia';
import { renderizar } from '../testes/renderizar';
import { ProvedorTema, useTema } from './ProvedorTema';

/** O que a Sonda escreve para um modo e destaque: vem do mesmo montarTema do provedor. */
function esperado(modo: 'claro' | 'escuro', destaque: Parameters<typeof montarTema>[1]) {
  const tema = montarTema(modo, destaque);
  return `${modo} ${tema.cores.destaque} ${tema.sombras.botaoMetal[0]?.color}`;
}

function Sonda() {
  const tema = useTema();
  return <Text>{`${tema.modo} ${tema.cores.destaque} ${tema.sombras.botaoMetal[0]?.color}`}</Text>;
}

describe('ProvedorTema', () => {
  it('aplica o modo e o destaque escolhidos', async () => {
    await renderizar(<Sonda />, { modo: 'escuro', destaque: 'cobalto' });
    expect(screen.getByText(esperado('escuro', 'cobalto'))).toBeTruthy();
  });

  it('troca o destaque na hora, sem recarregar', async () => {
    await renderizar(<Sonda />);
    expect(screen.getByText(esperado('claro', 'laranja'))).toBeTruthy();
    await act(async () => useAparencia.getState().definirDestaque('rosa'));
    expect(screen.getByText(esperado('claro', 'rosa'))).toBeTruthy();
  });

  it.each([
    ['sistema', 'unspecified'],
    ['claro', 'light'],
    ['escuro', 'dark'],
  ] as const)('preferência %s pede %s aos componentes nativos', async (preferencia, esperado) => {
    const espiao = jest.mocked(Appearance.setColorScheme);
    espiao.mockClear();
    useAparencia.setState({ tema: preferencia });
    await render(
      <ProvedorTema>
        <Sonda />
      </ProvedorTema>,
    );
    expect(espiao).toHaveBeenLastCalledWith(esperado);
  });

  it('no modo sistema, segue o esquema do aparelho', async () => {
    const esquema = jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('dark');
    useAparencia.setState({ tema: 'sistema', destaque: 'laranja' });
    await render(
      <ProvedorTema>
        <Sonda />
      </ProvedorTema>,
    );
    expect(screen.getByText(esperado('escuro', 'laranja'))).toBeTruthy();
    esquema.mockRestore();
  });

  it('useTema fora do provedor falha alto', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Sonda />)).rejects.toThrow(/ProvedorTema/);
  });
});
