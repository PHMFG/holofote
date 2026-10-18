import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Comentario, Digitando } from './Comentario';

const base = {
  nome: 'Duda Marques',
  iniciais: 'DM',
  tempo: '8 min',
  texto: 'o refrão é seu',
  curtidas: 312,
};

describe('Comentario', () => {
  it('lê autor, selo, tag e texto juntos', async () => {
    await renderizar(
      <Comentario {...base} verificado tag="FÃ" respostas={4} onResponder={() => {}} />,
    );
    expect(
      screen.getByLabelText('Duda Marques, verificado, FÃ, 8 min: o refrão é seu'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Responder a Duda Marques' })).toBeTruthy();
  });

  it('o aninhado tem curtir e responder, sem contadores, e diz para quem é', async () => {
    const aoCurtir = jest.fn();
    await renderizar(
      <Comentario
        {...base}
        aninhado
        para="@lila"
        respostas={4}
        onResponder={() => {}}
        onCurtir={aoCurtir}
      />,
    );
    expect(screen.getByRole('button', { name: 'Responder a Duda Marques' })).toBeTruthy();
    expect(screen.getByText('para @lila')).toBeTruthy();
    expect(screen.queryByText('4')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '312 curtidas' }));
    expect(aoCurtir).toHaveBeenCalled();
  });

  it('digitando avisa quem está escrevendo', async () => {
    await renderizar(<Digitando nome="@fofocalizei" iniciais="FO" />);
    expect(screen.getByLabelText('@fofocalizei está digitando')).toBeTruthy();
  });
});
