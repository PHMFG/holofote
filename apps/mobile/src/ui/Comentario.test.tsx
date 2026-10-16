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

  it('o aninhado só tem curtir', async () => {
    const aoCurtir = jest.fn();
    await renderizar(
      <Comentario {...base} aninhado respostas={4} onResponder={() => {}} onCurtir={aoCurtir} />,
    );
    expect(screen.queryByRole('button', { name: /^Responder/ })).toBeNull();
    expect(screen.queryByText('4')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: '312 curtidas' }));
    expect(aoCurtir).toHaveBeenCalled();
  });

  it('digitando avisa quem está escrevendo', async () => {
    await renderizar(<Digitando nome="@fofocalizei" iniciais="FO" />);
    expect(screen.getByLabelText('@fofocalizei está digitando')).toBeTruthy();
  });
});
