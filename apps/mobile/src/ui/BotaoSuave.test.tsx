import { fireEvent, screen } from '@testing-library/react-native';
import { ArrowLeft } from 'lucide-react-native';
import { renderizar } from '../testes/renderizar';
import { BotaoSuave } from './BotaoSuave';

describe('BotaoSuave', () => {
  it('é um botão rotulado só com ícone', async () => {
    const aoTocar = jest.fn();
    await renderizar(<BotaoSuave icone={ArrowLeft} rotulo="Voltar" onPress={aoTocar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(aoTocar).toHaveBeenCalled();
  });
});
