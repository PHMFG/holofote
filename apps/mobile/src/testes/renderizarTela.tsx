import type { NomeDestaque } from '@holofote/tokens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAparencia } from '../estado/aparencia';
import { ProvedorTema } from '../tema/ProvedorTema';

const METRICAS_16E = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Tela com tema, área segura do 16e e um QueryClient novo (sem retry) por teste. */
export async function renderizarTela(
  ui: ReactElement,
  {
    modo = 'claro',
    destaque = 'laranja',
  }: { modo?: 'claro' | 'escuro'; destaque?: NomeDestaque } = {},
) {
  useAparencia.setState({ tema: modo, destaque });
  // gcTime infinito: sem temporizadores de limpeza pendurados, o Jest sai ao terminar.
  const cliente = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  const resultado = await render(
    <QueryClientProvider client={cliente}>
      <SafeAreaProvider initialMetrics={METRICAS_16E}>
        <ProvedorTema>{ui}</ProvedorTema>
      </SafeAreaProvider>
    </QueryClientProvider>,
  );
  return { ...resultado, cliente };
}
