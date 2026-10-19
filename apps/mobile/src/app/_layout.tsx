import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ErroDaApi } from '../api/cliente';
import { useMundo } from '../api/consultas';
import { ProvedorTempoReal } from '../api/tempoReal';
import { useAplicarAtualizacao } from '../atualizacoes';
import { ProvedorTema, useTema } from '../tema/ProvedorTema';
import { useMovimento } from '../ui/movimento';

/**
 * Modais em tela cheia, como os frames do Figma (390 x 844 com a barra de status): o modal padrão
 * do iOS é uma folha com uma faixa do app de trás por cima, que invade a barra de status.
 * Sobem de baixo (a transição nativa do iOS).
 */
const MODAL_DE_TELA_CHEIA = {
  presentation: 'fullScreenModal',
  animation: 'slide_from_bottom',
} as const;

/** História e ao vivo são imersivas: aparecem em fade (cross dissolve nativo), sem subir de baixo. */
const MODAL_IMERSIVO = { presentation: 'fullScreenModal', animation: 'fade' } as const;

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
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Push e pop com a transição nativa do iOS. O fundo do tema em toda cena: nenhuma
        // transição mostra um quadro branco ou preto atrás da tela. Com movimento reduzido, fade.
        animation: reduzido ? 'fade' : 'default',
        contentStyle: { backgroundColor: cores.fundo },
      }}
    >
      {/* Entra em fade ao vir do onboarding (replace), em vez de empurrar de lado. */}
      <Stack.Screen name="(abas)" options={{ animation: 'fade' }} />
      {/* Quando o mundo ainda não existe, as abas redirecionam para cá: entra como um push. */}
      <Stack.Screen
        name="(onboarding)/criar-mundo"
        options={{ gestureEnabled: false, animationTypeForReplace: 'push' }}
      />
      <Stack.Screen name="novo-post" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="plus" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="marco/[id]" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="resumo-do-dia" options={MODAL_DE_TELA_CHEIA} />
      <Stack.Screen name="historia/[id]" options={MODAL_IMERSIVO} />
      <Stack.Screen name="evento/[id]/ao-vivo" options={MODAL_IMERSIVO} />
      {/*
        A folha "Sem energia" é um modal transparente. O fade nativo leva junto o escurecer da
        rota; a própria Folha sobe na mola (SlideInDown) e fecha arrastando para baixo.
      */}
      <Stack.Screen
        name="sem-energia"
        options={{
          presentation: 'transparentModal',
          animation: reduzido ? 'none' : 'fade',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
    </Stack>
  );
}

export default function LayoutRaiz() {
  useAplicarAtualizacao();
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
