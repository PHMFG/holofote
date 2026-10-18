import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../../tema/ProvedorTema';
import { ESPACO_BARRA_DE_ABAS } from '../../ui/Tela';

const ContextoRolagem = createContext<SharedValue<number> | null>(null);

/** Posição de rolagem (pt, na thread de UI) da TelaComCapa mais próxima; null fora dela. */
export function useRolagemDaCapa(): SharedValue<number> | null {
  return useContext(ContextoRolagem);
}

export interface TelaComCapaProps {
  children: ReactNode;
  /** Tela dentro das abas: reserva espaço para a barra flutuante. */
  comAbas?: boolean;
  gap?: number;
}

/**
 * Tela rolável das telas de perfil (05 e 08): a mesma estrutura da Tela (fundo Cromo, margem
 * lateral e áreas seguras do 16e), mas com a rolagem exposta como valor compartilhado para a
 * Capa fazer o parallax e o avatar encolher, sem renderizar a cada quadro. A Tela de src/ui
 * não expõe a rolagem; se ela passar a expor, esta pode virar só uma Tela.
 */
export function TelaComCapa({ children, comAbas, gap = 12 }: TelaComCapaProps) {
  const { cores, medidas } = useTema();
  const insets = useSafeAreaInsets();
  const rolagem = useSharedValue(0);
  const aoRolar = useAnimatedScrollHandler({
    onScroll: (evento) => {
      rolagem.value = evento.contentOffset.y;
    },
  });
  const topo = insets.top + 8;
  const base = comAbas ? ESPACO_BARRA_DE_ABAS + insets.bottom : insets.bottom + 24;
  return (
    <ContextoRolagem.Provider value={rolagem}>
      <View style={[estilos.tela, { backgroundColor: cores.fundo }]}>
        <Animated.ScrollView
          testID="tela-rolagem"
          onScroll={aoRolar}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: medidas.margemLateral,
            paddingTop: topo,
            paddingBottom: base,
            gap,
          }}
        >
          {children}
        </Animated.ScrollView>
      </View>
    </ContextoRolagem.Provider>
  );
}

const estilos = StyleSheet.create({ tela: { flex: 1 } });
