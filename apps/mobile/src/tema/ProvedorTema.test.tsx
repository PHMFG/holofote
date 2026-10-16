import { act, render, screen } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import { Appearance, Text } from 'react-native';
import { useAparencia } from '../estado/aparencia';
import { renderizar } from '../testes/renderizar';
import { ProvedorTema, useTema } from './ProvedorTema';

function Sonda() {
  const tema = useTema();
  return <Text>{`${tema.modo} ${tema.cores.destaque} ${tema.sombras.botaoMetal[0]?.color}`}</Text>;
}

describe('ProvedorTema', () => {
  it('aplica o modo e o destaque escolhidos', async () => {
    await renderizar(<Sonda />, { modo: 'escuro', destaque: 'cobalto' });
    expect(screen.getByText('escuro #2f5bff #2f5bff61')).toBeTruthy();
  });

  it('troca o destaque na hora, sem recarregar', async () => {
    await renderizar(<Sonda />);
    expect(screen.getByText('claro #ff5a1f #ff5a1f61')).toBeTruthy();
    await act(async () => useAparencia.getState().definirDestaque('rosa'));
    expect(screen.getByText('claro #ff4fa3 #ff4fa361')).toBeTruthy();
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
    expect(screen.getByText('escuro #ff5a1f #ff5a1f61')).toBeTruthy();
    esquema.mockRestore();
  });

  it('useTema fora do provedor falha alto', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Sonda />)).rejects.toThrow(/ProvedorTema/);
  });
});
