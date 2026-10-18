import type { LucideIcon } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { formatarNumero } from '../../formatar';
import { Camada } from '../../ui/Camada';
import { Icone } from '../../ui/Icone';
import { CURVA, DURACAO, useMovimento } from '../../ui/movimento';
import { Tocavel } from '../../ui/Tocavel';
import { NumeroRolante } from '../animacao/NumeroRolante';
import { usePop } from '../animacao/Pop';

export interface ContadorAcaoProps {
  icone: LucideIcon;
  valor: number;
  /** Lido depois do número: "37 respostas". */
  rotulo: string;
  /** Curtida dada: chip destaque com brilho (docs/DECISOES.md, contador ativo). */
  ativo?: boolean;
  onPress?: () => void;
}

/**
 * Chip de contador do post aberto (Figma 17:188): linha sobre o fundo ou destaque quando ativo.
 * Igual ao Chip de src/ui, mas com rótulo acessível próprio ("37 respostas" em vez de "37"):
 * o Chip lê só o texto visível. Ao ativar, o chip e o ícone dão um pop e o destaque entra por
 * cima; quando o valor muda, os dígitos rolam.
 */
export function ContadorAcao({ icone, valor, rotulo, ativo, onPress }: ContadorAcaoProps) {
  const { reduceMotion } = useMovimento();
  const numero = formatarNumero(valor);
  const cor = ativo ? 'destaqueSobre' : 'texto';
  const aceso = useSharedValue(ativo ? 1 : 0);
  const popDoChip = usePop(ativo, { soAoLigar: true, escala: 1.1 });
  const popDoIcone = usePop(ativo, { soAoLigar: true, escala: 1.55 });

  useEffect(() => {
    aceso.value = withTiming(ativo ? 1 : 0, {
      duration: DURACAO.rapida,
      easing: CURVA.saida,
      reduceMotion,
    });
  }, [ativo, reduceMotion, aceso]);

  const destaque = useAnimatedStyle(() => ({ opacity: aceso.value }));

  return (
    <Tocavel
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={`${numero} ${rotulo}`}
      accessibilityState={{ selected: !!ativo }}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
    >
      <Animated.View style={popDoChip}>
        <Camada cor="fundo" borda={{ cor: 'linha', largura: 1 }} raio={999} style={estilos.chip}>
          {/* O chip ativo (destaque com brilho) fica por cima do chip de linha e só muda de opacidade. */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, destaque]}>
            <Camada
              cor="destaque"
              sombra="brilhoDestaque"
              borda={{ cor: 'destaque', largura: 1 }}
              raio={999}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={popDoIcone}>
            <Icone icone={icone} tamanho={14} cor={cor} traco={2} />
          </Animated.View>
          <NumeroRolante texto={numero} estilo="legenda" cor={cor} />
        </Camada>
      </Animated.View>
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
});
