import type { NomeDestaque } from '@holofote/tokens';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAparencia } from '../estado/aparencia';
import { ProvedorTema } from '../tema/ProvedorTema';

// iPhone 16e: 390 x 844 pt, notch com 47 pt no topo e 34 pt do indicador de início.
const METRICAS_16E = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Renderiza dentro do tema, com modo e destaque fixos. No RNTL 14, render é assíncrono. */
export async function renderizar(
  ui: ReactElement,
  {
    modo = 'claro',
    destaque = 'laranja',
  }: { modo?: 'claro' | 'escuro'; destaque?: NomeDestaque } = {},
) {
  useAparencia.setState({ tema: modo, destaque });
  return await render(
    <SafeAreaProvider initialMetrics={METRICAS_16E}>
      <ProvedorTema>{ui}</ProvedorTema>
    </SafeAreaProvider>,
  );
}
