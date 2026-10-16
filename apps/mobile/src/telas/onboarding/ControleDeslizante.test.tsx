import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../../testes/renderizar';
import { ControleDeslizante } from './ControleDeslizante';

const toque = (locationX: number) => ({ nativeEvent: { locationX } });

describe('ControleDeslizante', () => {
  it('arrastar leva o valor à posição do dedo, limitado de 0 a 100', async () => {
    const aoMudar = jest.fn();
    await renderizar(
      <ControleDeslizante valor={70} onMudar={aoMudar} rotulo="Tom" textoDoValor="70% caótico" />,
    );
    const controle = screen.getByRole('adjustable', { name: 'Tom' });
    // 358 de largura: a bola de 26 corre 332 pt, do centro em 13 ao centro em 345.
    await fireEvent(controle, 'layout', { nativeEvent: { layout: { width: 358, height: 26 } } });
    await fireEvent(controle, 'responderGrant', toque(13 + 332 / 2));
    expect(aoMudar).toHaveBeenLastCalledWith(50);
    await fireEvent(controle, 'responderMove', toque(-40));
    expect(aoMudar).toHaveBeenLastCalledWith(0);
    await fireEvent(controle, 'responderMove', toque(500));
    expect(aoMudar).toHaveBeenLastCalledWith(100);
  });

  it('incremento e decremento do VoiceOver respeitam o passo e os limites', async () => {
    const aoMudar = jest.fn();
    await renderizar(
      <ControleDeslizante
        valor={95}
        onMudar={aoMudar}
        rotulo="Tom"
        textoDoValor="95%"
        passo={10}
      />,
    );
    const controle = screen.getByRole('adjustable', { name: 'Tom' });
    expect(controle).toHaveAccessibilityValue({ min: 0, max: 100, now: 95, text: '95%' });
    await fireEvent(controle, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(aoMudar).toHaveBeenLastCalledWith(100);
    await fireEvent(controle, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(aoMudar).toHaveBeenLastCalledWith(85);
  });
});
