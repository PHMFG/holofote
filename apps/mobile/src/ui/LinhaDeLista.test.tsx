import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Custo } from './Custo';
import { Interruptor } from './Interruptor';
import { LinhaDeLista } from './LinhaDeLista';

describe('LinhaDeLista', () => {
  it('não lida avisa o VoiceOver e destaca a prévia', async () => {
    const aoTocar = jest.fn();
    await renderizar(
      <LinhaDeLista titulo="Duda Marques" subtitulo="viu o teaser?" naoLida onPress={aoTocar} />,
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Duda Marques, viu o teaser?, não lida' }),
    );
    expect(aoTocar).toHaveBeenCalled();
    expect(screen.getByText('viu o teaser?')).toHaveStyle({
      fontFamily: 'PlusJakartaSans-SemiBold',
    });
  });

  it('sem onPress, o acessório interativo continua alcançável', async () => {
    await renderizar(
      <LinhaDeLista
        titulo="Vic Ferraz"
        subtitulo="rival"
        fim={<Interruptor valor onMudar={() => {}} rotulo="Incluir Vic no elenco" />}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('Vic Ferraz, rival')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Incluir Vic no elenco' })).toBeTruthy();
  });

  it('numa linha tocável, o texto do acessório entra no rótulo', async () => {
    await renderizar(
      <LinhaDeLista
        titulo="Ensaiar o discurso"
        rotuloFim="custa 2 de energia"
        fim={<Custo energia={2} />}
        onPress={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Ensaiar o discurso, custa 2 de energia' }),
    ).toBeTruthy();
  });
});
