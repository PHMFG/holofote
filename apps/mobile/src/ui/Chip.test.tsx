import { montarTema } from '@holofote/tokens';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Chip } from './Chip';

describe('Chip', () => {
  it('chip de escolha expõe marcado e desmarcado', async () => {
    const aoTocar = jest.fn();
    await renderizar(
      <>
        <Chip rotulo="Pop Brasil" selecionado onPress={aoTocar} />
        <Chip rotulo="Reality show" selecionado={false} onPress={aoTocar} />
      </>,
    );
    expect(screen.getByRole('checkbox', { name: 'Pop Brasil' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Reality show' })).not.toBeChecked();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Reality show' }));
    expect(aoTocar).toHaveBeenCalled();
  });

  it('o selecionado usa a cor sobre a pílula preta e o destaque usa destaque-sobre', async () => {
    await renderizar(
      <>
        <Chip rotulo="Escolhido" selecionado onPress={() => {}} />
        <Chip rotulo="Novas" variante="destaque" />
      </>,
      { destaque: 'cobalto' },
    );
    expect(screen.getByText('Escolhido')).toHaveStyle({
      color: montarTema('claro', 'cobalto').cores.primarioTexto,
    });
    expect(screen.getByText('Novas')).toHaveStyle({
      color: montarTema('claro', 'cobalto').cores.destaqueSobre,
    });
  });

  it('o rótulo acessível substitui o texto visível', async () => {
    await renderizar(<Chip rotulo="Ver" rotuloAcessivel="Ver respostas" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ver respostas' })).toBeTruthy();
  });

  it('sem onPress não é botão', async () => {
    await renderizar(<Chip rotulo="AO VIVO" variante="destaque" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByLabelText('AO VIVO')).toBeTruthy();
  });
});
