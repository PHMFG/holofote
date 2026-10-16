import { fireEvent, screen } from '@testing-library/react-native';
import { Bell, Home, User } from 'lucide-react-native';
import { renderizar } from '../testes/renderizar';
import { BarraDeAbas } from './BarraDeAbas';

const abas = [
  { chave: 'inicio', rotulo: 'Início', icone: Home },
  { chave: 'alertas', rotulo: 'Alertas', icone: Bell, novidade: true },
  { chave: 'perfil', rotulo: 'Perfil', icone: User },
] as const;

describe('BarraDeAbas', () => {
  it('marca a aba ativa e avisa novidades', async () => {
    await renderizar(<BarraDeAbas abas={abas} ativa="inicio" onSelecionar={() => {}} />);
    expect(screen.getByRole('button', { name: 'Início' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Alertas, com novidades' })).not.toBeSelected();
  });

  it('tocar numa aba avisa qual foi', async () => {
    const aoSelecionar = jest.fn();
    await renderizar(<BarraDeAbas abas={abas} ativa="inicio" onSelecionar={aoSelecionar} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Perfil' }));
    expect(aoSelecionar).toHaveBeenCalledWith('perfil');
  });
});
