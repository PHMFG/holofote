import { Redirect } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Bell, Home, MessageSquare, Target, User } from 'lucide-react-native';
import { Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErroDaApi } from '../../api/cliente';
import { useAlertas, useMundo } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { useAbrirResumoDoDia } from '../../telas/resumo/useAbrirResumoDoDia';
import { BarraDeAbas } from '../../ui/BarraDeAbas';
import { EstadoTela } from '../../ui/EstadoTela';
import { DURACAO, useMovimento } from '../../ui/movimento';

const ABAS = {
  index: { rotulo: 'Início', icone: Home },
  jornada: { rotulo: 'Jornada', icone: Target },
  mensagens: { rotulo: 'Mensagens', icone: MessageSquare },
  alertas: { rotulo: 'Alertas', icone: Bell },
  perfil: { rotulo: 'Perfil', icone: User },
} as const;

type ChaveAba = keyof typeof ABAS;

/** A pílula do Figma (12:26) no lugar da barra de abas padrão, flutuando sobre o conteúdo. */
function BarraFlutuante({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const alertas = useAlertas();
  const temNovidade = (alertas.data ?? []).some((a) => !a.lido);
  const abas = state.routes.map((rota) => ({
    chave: rota.name as ChaveAba,
    ...ABAS[rota.name as ChaveAba],
    novidade: rota.name === 'alertas' && temNovidade,
  }));
  const ativa = state.routes[state.index]?.name as ChaveAba;

  return (
    <View
      pointerEvents="box-none"
      style={[estilos.barra, { bottom: Math.max(insets.bottom - 8, 8) }]}
    >
      <BarraDeAbas
        abas={abas}
        ativa={ativa}
        onSelecionar={(chave) => {
          const rota = state.routes.find((r) => r.name === chave);
          if (rota) navigateToTab(rota.key);
        }}
      />
    </View>
  );
}

export default function LayoutAbas() {
  const mundo = useMundo();
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  // Primeira visita de cada dia do mundo: o resumo da manhã abre sozinho.
  useAbrirResumoDoDia();

  if (mundo.error instanceof ErroDaApi && mundo.error.codigo === 'nao_encontrado') {
    return <Redirect href="/criar-mundo" />;
  }
  if (mundo.data && mundo.data.estado !== 'pronto') return <Redirect href="/criar-mundo" />;
  if (!mundo.data) {
    return (
      <View style={[estilos.espera, { backgroundColor: cores.fundo }]}>
        <EstadoTela
          tipo={mundo.error ? 'erro' : 'carregando'}
          frase={mundo.error ? 'Não deu para abrir seu mundo.' : 'Abrindo seu mundo…'}
          acao={
            mundo.error
              ? { rotulo: 'Tentar de novo', onPress: () => void mundo.refetch() }
              : undefined
          }
        />
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <BarraFlutuante {...props} />}
      screenOptions={{
        headerShown: false,
        // Troca de aba: fade curto entre as cenas, ambas com o fundo do tema (sem piscar).
        // Com movimento reduzido, a troca é imediata.
        animation: reduzido ? 'none' : 'fade',
        transitionSpec: {
          animation: 'timing',
          config: { duration: DURACAO.rapida, easing: Easing.out(Easing.cubic) },
        },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      {(Object.keys(ABAS) as ChaveAba[]).map((nome) => (
        <Tabs.Screen key={nome} name={nome} options={{ title: ABAS[nome].rotulo }} />
      ))}
    </Tabs>
  );
}

const estilos = StyleSheet.create({
  barra: { position: 'absolute', left: 0, right: 0 },
  espera: { flex: 1, paddingHorizontal: 16 },
});
