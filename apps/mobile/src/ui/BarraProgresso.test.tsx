import { montarTema } from '@holofote/tokens';
import { screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { BarraPassos, BarraProgresso } from './BarraProgresso';

describe('BarraProgresso', () => {
  it('expõe o valor em porcentagem e limita entre 0 e 100', async () => {
    await renderizar(
      <>
        <BarraProgresso valor={0.72} rotulo="Carisma" />
        <BarraProgresso valor={1.4} rotulo="Estourada" />
      </>,
    );
    expect(screen.getByRole('progressbar', { name: 'Carisma' })).toHaveAccessibilityValue({
      now: 72,
    });
    expect(screen.getByRole('progressbar', { name: 'Estourada' })).toHaveAccessibilityValue({
      now: 100,
    });
  });

  it('o preenchimento segue o destaque', async () => {
    await renderizar(<BarraProgresso valor={0.5} rotulo="Objetivo" />, { destaque: 'menta' });
    expect(JSON.stringify(screen.toJSON())).toContain(
      montarTema('claro', 'menta').cores.destaqueGrafico,
    );
  });

  it('passos dizem em qual passo o jogador está', async () => {
    await renderizar(<BarraPassos total={3} atual={2} />);
    expect(screen.getByRole('progressbar', { name: 'Passo 2 de 3' })).toBeTruthy();
  });
});
