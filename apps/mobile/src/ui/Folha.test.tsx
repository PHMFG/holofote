import { fireEvent, screen } from '@testing-library/react-native';
import { Gem } from 'lucide-react-native';
import { renderizar } from '../testes/renderizar';
import { Folha, OpcaoFolha } from './Folha';

describe('Folha', () => {
  it('cada opção é um botão com título, subtítulo e valor', async () => {
    const aoTocar = jest.fn();
    await renderizar(
      <Folha>
        <OpcaoFolha
          icone={Gem}
          titulo="Usar gemas"
          subtitulo="Enche a barra"
          valor="10 gemas"
          onPress={aoTocar}
        />
      </Folha>,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Usar gemas, Enche a barra, 10 gemas' }),
    );
    expect(aoTocar).toHaveBeenCalled();
  });
});
