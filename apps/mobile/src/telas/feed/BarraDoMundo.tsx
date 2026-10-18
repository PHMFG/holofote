import type { Mundo } from '@holofote/shared';
import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Camada } from '../../ui/Camada';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { IndicadoresConta } from '../../ui/IndicadoresConta';
import { Texto } from '../../ui/Texto';
import { TrocaSuave } from '../animacao/TrocaSuave';
import { NOME_PERIODO } from '../../tempo';
import { DURACAO, CURVA, useMovimento } from '../../ui/movimento';

/**
 * Pílula do topo do feed (Figma 16:38): esfera do Holofote, dia e período do mundo, energia e
 * gemas. A estrela do Figma (`icon/estrela`) é desenho próprio; aqui vai o Sparkles do lucide.
 */
export function BarraDoMundo({
  mundo,
  destacada = false,
}: {
  mundo: Pick<Mundo, 'dia' | 'periodo'> | undefined;
  /** Conteúdo rolando por trás: a pílula ganha uma sombra leve que a separa dos posts. */
  destacada?: boolean;
}) {
  const { reduceMotion } = useMovimento();
  const realce = useSharedValue(destacada ? 1 : 0);
  useEffect(() => {
    realce.value = withTiming(destacada ? 1 : 0, {
      duration: DURACAO.rapida,
      easing: CURVA.saida,
      reduceMotion,
    });
  }, [destacada, reduceMotion, realce]);
  const estiloDoRealce = useAnimatedStyle(() => ({ opacity: realce.value }));
  return (
    <View>
      {/* Só a sombra externa, por baixo da pílula: aparece com o fade quando o feed rola. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, estiloDoRealce]}>
        <Camada sombra="elevacao" raio={999} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Camada cor="fundo" raio={999} borda={{ cor: 'linha', largura: 1.5 }} style={estilos.pilula}>
        <Esfera tom="escuro" tamanho={48}>
          <Icone icone={Sparkles} tamanho={22} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <Camada
          gradiente="bloco"
          raio={14}
          style={estilos.dia}
          accessible
          accessibilityRole="header"
          accessibilityLabel={mundo ? `Dia ${mundo.dia}, ${NOME_PERIODO[mundo.periodo]}` : 'Dia'}
        >
          {/* Dia e período trocam com transição quando o mundo muda de período. */}
          <TrocaSuave chave={mundo ? `${mundo.dia}-${mundo.periodo}` : 'sem-mundo'}>
            <Texto estilo="secao">{mundo ? `Dia ${mundo.dia}` : 'Dia'}</Texto>
            <Texto estilo="legenda" cor="textoSuave">
              {mundo ? NOME_PERIODO[mundo.periodo] : ' '}
            </Texto>
          </TrocaSuave>
        </Camada>
        <View style={estilos.espaco} />
        <IndicadoresConta />
      </Camada>
    </View>
  );
}

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 6,
  },
  dia: { paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  espaco: { flex: 1 },
});
