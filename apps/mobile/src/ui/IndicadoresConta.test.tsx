import { screen } from '@testing-library/react-native';
import { conta, energia } from '../testes/dados';
import { simularApi } from '../testes/api';
import { renderizarTela } from '../testes/renderizarTela';
import { IndicadoresConta } from './IndicadoresConta';

jest.mock('../api/cliente', () => require('../testes/api').moduloClienteSimulado());

describe('IndicadoresConta', () => {
  it('mostra energia e gemas da conta', async () => {
    simularApi({ 'GET /energia': energia(8, 12), 'GET /conta': conta({ gemas: 40 }) });
    await renderizarTela(<IndicadoresConta />);
    expect(await screen.findByRole('button', { name: 'Energia 8 de 12' })).toBeTruthy();
    expect(await screen.findByLabelText('40 gemas')).toBeTruthy();
  });
});
