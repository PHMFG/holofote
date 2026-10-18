import { act, fireEvent, screen } from '@testing-library/react-native';
import { Keyboard, ScrollView, Text } from 'react-native';
import { renderizar } from '../testes/renderizar';
import { Tela } from './Tela';

const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');

// O Keyboard do jest não emite eventos: guarda os ouvintes para o teste disparar.
const ouvintes: Record<string, () => void> = {};
beforeEach(() => {
  scrollTo.mockClear();
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((evento: string, f: () => void) => {
    ouvintes[evento] = f;
    return { remove: () => delete ouvintes[evento] };
  }) as unknown as typeof Keyboard.addListener);
});

const abrirTeclado = () => act(() => ouvintes['keyboardDidShow']?.());
const fecharTeclado = () => act(() => ouvintes['keyboardDidHide']?.());
const medirArea = (altura: number) =>
  fireEvent(screen.getByTestId('tela-rolagem'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 390, height: altura } },
  });

function Exemplo({ trecho }: { trecho?: { y: number; altura: number } | null }) {
  return (
    <Tela revelarAoTeclado={trecho} rodape={<Text>Rodapé</Text>}>
      <Text>Conteúdo</Text>
    </Tela>
  );
}

describe('Tela · revelarAoTeclado', () => {
  it('com o teclado aberto, rola até o fim do trecho ficar visível acima do rodapé', async () => {
    await renderizar(<Exemplo trecho={{ y: 258, altura: 116 }} />);
    await medirArea(323);
    expect(scrollTo).not.toHaveBeenCalled();

    await abrirTeclado();
    // 258 + 116 + 12 de folga - 323 de área visível.
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 63, animated: true });
  });

  it('rola de novo quando a área encolhe depois do teclado (KeyboardAvoidingView)', async () => {
    await renderizar(<Exemplo trecho={{ y: 258, altura: 116 }} />);
    await medirArea(600);
    await abrirTeclado();
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 0, animated: true });

    await medirArea(300);
    expect(scrollTo).toHaveBeenLastCalledWith({ y: 86, animated: true });
  });

  it('com o trecho ainda desconhecido, não rola', async () => {
    await renderizar(<Exemplo trecho={null} />);
    await medirArea(323);
    await abrirTeclado();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('com o teclado fechado de novo, não rola mais', async () => {
    await renderizar(<Exemplo trecho={{ y: 258, altura: 116 }} />);
    await medirArea(323);
    await abrirTeclado();
    await fecharTeclado();
    scrollTo.mockClear();
    await medirArea(600);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('sem a prop, a Tela não observa o teclado', async () => {
    await renderizar(<Exemplo />);
    await medirArea(323);
    await abrirTeclado();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
