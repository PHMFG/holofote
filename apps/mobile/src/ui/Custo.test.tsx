import { screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Custo } from './Custo';

describe('Custo', () => {
  it('lê o custo por extenso', async () => {
    await renderizar(<Custo energia={2} />);
    expect(screen.getByLabelText('Custa 2 de energia')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});
