import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { CURVA, useMovimento } from '../../ui/movimento';
import { Texto } from '../../ui/Texto';
import { useAnimacoes } from '../animacao/animacoes';

/**
 * Confirmação de que o post saiu, antes de abrir a tela do post: cobre a tela com o fundo, uma
 * esfera com o check que entra com pop e um anel que se abre a partir dela. O VoiceOver ouve
 * "Post publicado" uma vez (região viva), não a cada quadro.
 */
export function SucessoDePublicacao() {
  const { cores } = useTema();
  const animacoes = useAnimacoes();
  const { reduzido, reduceMotion } = useMovimento();
  const anel = useSharedValue(0);

  useEffect(() => {
    if (reduzido) return;
    anel.value = withDelay(
      160,
      withTiming(1, { duration: 700, easing: CURVA.saida, reduceMotion }),
    );
  }, [reduzido, reduceMotion, anel]);

  const estiloDoAnel = useAnimatedStyle(() => ({
    opacity: interpolate(anel.value, [0, 0.15, 1], [0, 0.5, 0], Extrapolation.CLAMP),
    transform: [{ scale: 1 + 0.9 * anel.value }],
  }));

  return (
    <Animated.View
      entering={animacoes.fade()}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, estilos.cobertura, { backgroundColor: cores.fundo }]}
    >
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel="Post publicado. Abrindo o post."
        style={estilos.conteudo}
      >
        <View style={estilos.selo}>
          <Animated.View
            pointerEvents="none"
            style={[estilos.anel, { borderColor: cores.destaque }, estiloDoAnel]}
          />
          <Animated.View entering={animacoes.pop(80)}>
            <Esfera tom="escuro" tamanho={72}>
              <Icone icone={Check} tamanho={32} cor={corSobreEsfera('escuro')} traco={2.5} />
            </Esfera>
          </Animated.View>
        </View>
        <Animated.View entering={animacoes.entrada(0, 220)} style={estilos.textos}>
          <Texto estilo="titulo">Publicado</Texto>
          <Texto cor="textoSuave">O elenco já está vendo.</Texto>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  cobertura: { alignItems: 'center', justifyContent: 'center' },
  conteudo: { alignItems: 'center', gap: 20 },
  selo: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  anel: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
  },
  textos: { alignItems: 'center', gap: 4 },
});
