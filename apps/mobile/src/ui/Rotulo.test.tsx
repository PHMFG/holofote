import { screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Rotulo, RotuloSecao } from './Rotulo';

describe('Rotulo', () => {
  it('a tag de destaque usa destaque-tinta e Mini em maiúsculas', async () => {
    await renderizar(<Rotulo texto="novo" variante="destaque" />);
    expect(screen.getByText('novo')).toHaveStyle({ color: '#b23a0b', textTransform: 'uppercase' });
  });

  it('o rótulo de seção é um cabeçalho com meta opcional', async () => {
    await renderizar(<RotuloSecao texto="Escolha seu discurso" meta="decida em 0:24" />);
    expect(screen.getByRole('header', { name: 'Escolha seu discurso' })).toBeTruthy();
    expect(screen.getByText('decida em 0:24')).toBeTruthy();
  });
});
