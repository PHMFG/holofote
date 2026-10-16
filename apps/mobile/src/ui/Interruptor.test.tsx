import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Interruptor } from './Interruptor';

describe('Interruptor', () => {
  it('é um switch que inverte o valor ao tocar', async () => {
    const aoMudar = jest.fn();
    await renderizar(<Interruptor valor={false} onMudar={aoMudar} rotulo="Puxar conversa" />);
    const chave = screen.getByRole('switch', { name: 'Puxar conversa' });
    expect(chave).not.toBeChecked();
    await fireEvent.press(chave);
    expect(aoMudar).toHaveBeenCalledWith(true);
  });

  it('desabilitado não muda', async () => {
    const aoMudar = jest.fn();
    await renderizar(<Interruptor valor onMudar={aoMudar} rotulo="Plus" desabilitado />);
    const chave = screen.getByRole('switch', { name: 'Plus' });
    expect(chave).toBeChecked();
    await fireEvent.press(chave);
    expect(aoMudar).not.toHaveBeenCalled();
  });
});
