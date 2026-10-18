import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { CURVA, DURACAO, MOLA, useMovimento } from './movimento';
import { Texto } from './Texto';

export interface BarraProgressoProps {
  /** De 0 a 1. */
  valor: number;
  /** Lido pelo VoiceOver, ex.: "Objetivo do ato". */
  rotulo: string;
  /** 8 (padrão), 6 nos requisitos, 5 mini, 4 cronômetro, 3 histórias. */
  altura?: 8 | 6 | 5 | 4 | 3;
  /**
   * padrão: trilho afundado com preenchimento destaque-grafico.
   * chapada: trilho sem sombra com preenchimento destaque (12 · Compor post, 17 · Ao vivo).
   */
  variante?: 'padrao' | 'chapada';
}

/**
 * Barra de progresso. O preenchimento cresce de 0 até o valor na primeira exibição (lento, curva
 * de ênfase) e acompanha cada mudança de valor (média). Com movimento reduzido já nasce no valor.
 */
export function BarraProgresso({
  valor,
  rotulo,
  altura = 8,
  variante = 'padrao',
}: BarraProgressoProps) {
  const { cores } = useTema();
  const proporcao = Math.min(1, Math.max(0, valor));
  const raio = altura / 2;
  const { reduzido } = useMovimento();
  const mostrado = useSharedValue(reduzido ? proporcao : 0);
  const primeira = useRef(true);
  useEffect(() => {
    if (reduzido) {
      mostrado.value = proporcao;
    } else {
      mostrado.value = withTiming(proporcao, {
        duration: primeira.current ? DURACAO.lenta : DURACAO.media,
        easing: CURVA.enfase,
      });
    }
    primeira.current = false;
  }, [proporcao, reduzido, mostrado]);
  const largura = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, mostrado.value)) * 100}%`,
  }));
  return (
    <Camada
      cor="superficie2"
      sombra={variante === 'padrao' ? 'afundado' : undefined}
      raio={raio}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(proporcao * 100) }}
      style={{ height: altura, overflow: 'hidden' }}
    >
      <Animated.View
        style={[
          {
            height: altura,
            borderRadius: raio,
            backgroundColor: variante === 'padrao' ? cores.destaqueGrafico : cores.destaque,
          },
          largura,
        ]}
      />
    </Camada>
  );
}

export interface BarraPassosProps {
  total: number;
  /** Passos concluídos, contando o atual. */
  atual: number;
}

/** Passos do onboarding (01 · Criar mundo): segmentos de 26 feitos e 14 pendentes. */
export function BarraPassos({ total, atual }: BarraPassosProps) {
  const texto = `Passo ${atual} de ${total}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={texto}
      accessibilityValue={{ min: 0, max: total, now: atual }}
      style={estilos.passos}
    >
      {Array.from({ length: total }, (_, i) => (
        <Segmento key={i} concluido={i < atual} />
      ))}
      <Texto estilo="mini" cor="textoSuave">
        {texto}
      </Texto>
    </View>
  );
}

/** Um passo: cresce de 14 para 26 e troca a cor de linha para destaque quando é concluído. */
function Segmento({ concluido }: { concluido: boolean }) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const mistura = useSharedValue(concluido ? 1 : 0);
  useEffect(() => {
    const alvo = concluido ? 1 : 0;
    mistura.value = reduzido ? alvo : withSpring(alvo, MOLA.suave);
  }, [concluido, reduzido, mistura]);
  const estilo = useAnimatedStyle(() => {
    const m = Math.min(1, Math.max(0, mistura.value));
    return {
      width: 14 + 12 * mistura.value,
      backgroundColor: interpolateColor(m, [0, 1], [cores.linha, cores.destaqueGrafico]),
    };
  });
  return <Animated.View style={[estilos.segmento, estilo]} />;
}

const estilos = StyleSheet.create({
  passos: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmento: { height: 5, borderRadius: 3 },
});
