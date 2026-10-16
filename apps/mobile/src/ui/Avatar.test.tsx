import { montarTema } from '@holofote/tokens';
import { screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('mostra as iniciais e expõe o nome ao VoiceOver', async () => {
    await renderizar(<Avatar iniciais="lp" nome="Lua Prado" />);
    expect(screen.getByText('LP')).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Lua Prado' })).toBeTruthy();
  });

  it('nos avatares pequenos as iniciais diminuem junto', async () => {
    await renderizar(<Avatar iniciais="DM" tamanho={28} />);
    expect(screen.getByText('DM')).toHaveStyle({ fontSize: 10.5 });
  });

  it('as iniciais do jogador (esfera escura) usam primario-texto', async () => {
    await renderizar(<Avatar iniciais="LP" tom="escuro" />);
    expect(screen.getByText('LP')).toHaveStyle({
      color: montarTema('claro', 'laranja').cores.primarioTexto,
    });
  });
});
