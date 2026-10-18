import { screen } from '@testing-library/react-native';
import { renderizarTela } from '../../testes/renderizarTela';
import { NumeroContando, partirNumero } from './NumeroContando';

describe('partirNumero', () => {
  it('separa prefixo, número e sufixo', () => {
    expect(partirNumero('72%')).toEqual({
      prefixo: '',
      sufixo: '%',
      alvo: 72,
      casas: 0,
      grupos: false,
    });
    expect(partirNumero('+1,2 mil')).toEqual({
      prefixo: '+',
      sufixo: ' mil',
      alvo: 1.2,
      casas: 1,
      grupos: false,
    });
    expect(partirNumero('−3')).toMatchObject({ prefixo: '−', alvo: 3 });
  });

  it('reconhece o ponto de milhar e o sufixo longo', () => {
    expect(partirNumero('1.250')).toMatchObject({ alvo: 1250, grupos: true, casas: 0 });
    expect(partirNumero('3 de 24')).toMatchObject({ alvo: 3, sufixo: ' de 24' });
  });

  it('texto sem dígitos não conta', () => {
    expect(partirNumero('—')).toBeNull();
  });
});

describe('NumeroContando', () => {
  it('mostra o texto final para o leitor de tela e some o campo de contagem do VoiceOver', async () => {
    await renderizarTela(<NumeroContando texto="1,2 mil" />);
    expect(screen.getByText('1,2 mil')).toBeTruthy();
    // O campo que conta é só visual: fora da árvore de acessibilidade.
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('texto sem dígitos aparece direto', async () => {
    await renderizarTela(<NumeroContando texto="novo" />);
    expect(screen.getByText('novo')).toBeTruthy();
  });
});
