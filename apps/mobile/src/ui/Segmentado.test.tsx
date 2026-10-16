import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Segmentado } from './Segmentado';

describe('Segmentado', () => {
  it('marca a opção escolhida e avisa a troca', async () => {
    const aoMudar = jest.fn();
    await renderizar(
      <Segmentado
        rotulo="Tema"
        valor="claro"
        onMudar={aoMudar}
        opcoes={[
          { valor: 'claro', rotulo: 'Claro' },
          { valor: 'escuro', rotulo: 'Escuro' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Claro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Escuro' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Escuro' }));
    expect(aoMudar).toHaveBeenCalledWith('escuro');
  });
});
