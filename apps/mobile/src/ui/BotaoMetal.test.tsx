import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { BotaoMetal } from './BotaoMetal';

describe('BotaoMetal', () => {
  it('é um botão com rótulo e dispara onPress', async () => {
    const aoTocar = jest.fn();
    await renderizar(<BotaoMetal rotulo="Entrar em cena" onPress={aoTocar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar em cena' }));
    expect(aoTocar).toHaveBeenCalledTimes(1);
  });

  it('desabilitado não dispara e avisa o VoiceOver', async () => {
    const aoTocar = jest.fn();
    await renderizar(<BotaoMetal rotulo="Publicar" onPress={aoTocar} disabled />);
    const botao = screen.getByRole('button', { name: 'Publicar' });
    await fireEvent.press(botao);
    expect(aoTocar).not.toHaveBeenCalled();
    expect(botao).toBeDisabled();
  });

  it('o brilho segue o destaque escolhido', async () => {
    await renderizar(<BotaoMetal rotulo="Publicar" />, { destaque: 'menta' });
    const json = JSON.stringify(screen.toJSON());
    expect(json).toContain('#14a98b61');
    expect(json).not.toContain('#ff5a1f61');
  });
});
