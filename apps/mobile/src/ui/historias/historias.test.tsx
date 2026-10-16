import { screen } from '@testing-library/react-native';
import { renderizar } from '../../testes/renderizar';
import { HISTORIAS } from '.';

describe('catálogo', () => {
  it('tem uma história para cada um dos 16 componentes do plano', () => {
    expect(HISTORIAS.map((h) => h.titulo).sort()).toEqual(
      [
        'Avatar',
        'BarraDeAbas',
        'BarraProgresso',
        'BotaoMetal',
        'BotaoSuave',
        'Cartao',
        'Chip',
        'Comentario',
        'Custo',
        'Esfera',
        'Folha',
        'Interruptor',
        'LinhaDeLista',
        'Post',
        'Rotulo',
        'Segmentado',
      ].sort(),
    );
  });

  const casos = HISTORIAS.flatMap((h) =>
    (['claro', 'escuro'] as const).map((modo) => [h.titulo, modo, h] as const),
  );

  it.each(casos)('%s renderiza no modo %s', async (_, modo, { Exemplo }) => {
    await renderizar(<Exemplo />, { modo });
    expect(screen.toJSON()).not.toBeNull();
  });
});
