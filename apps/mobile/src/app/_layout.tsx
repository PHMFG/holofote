import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ErroDaApi } from '../api/cliente';
import { useMundo } from '../api/consultas';
import { ProvedorTempoReal } from '../api/tempoReal';
import { ProvedorTema } from '../tema/ProvedorTema';

/**
 * Modais em tela cheia, como os frames do Figma (390 x 844 com a barra de status): o modal padrão
 * do iOS é uma folha com uma faixa do app de trás por cima, que invade a barra de status.
 */
const MODAL_DE_TELA_CHEIA = {
  presentation: 'fullScreenModal',
  animation: 'slide_from_bottom',
} as const;

const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      // Erro 4xx é resposta definitiva (ex.: sem mundo); só tenta de novo falha de rede ou 5xx.
      retry: (falhas, erro) => !(erro instanceof ErroDaApi && erro.status < 500) && falhas < 2,
    },
  },
});

function TempoRealDoMundo({ children }: { children: React.ReactNode }) {
  const mundo = useMundo();
  return <ProvedorTempoReal mundoId={mundo.data?.id}>{children}</ProvedorTempoReal>;
}

function PilhaDoApp() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(abas)" />
      <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="novo-post" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="plus" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="marco/[id]" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="resumo-do-dia" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="historia/[id]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="evento/[id]/ao-vivo" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen
        name="sem-energia"
        options={{
          presentation: 'transparentModal',
          animation: 'slide_from_bottom',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}

export default function LayoutRaiz() {
  return (
    <QueryClientProvider client={clienteConsultas}>
      <ProvedorTema>
        <TempoRealDoMundo>
          <PilhaDoApp />
        </TempoRealDoMundo>
      </ProvedorTema>
    </QueryClientProvider>
  );
}
