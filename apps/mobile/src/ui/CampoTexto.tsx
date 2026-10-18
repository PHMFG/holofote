import { MAX_ESCALA_FONTE } from '@holofote/tokens';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { CURVA, DURACAO, useMovimento } from './movimento';
import { Texto } from './Texto';

export interface CampoTextoProps extends Omit<TextInputProps, 'style'> {
  /** Rótulo lido pelo VoiceOver e mostrado acima (Mini). */
  rotulo: string;
  /** Mostra "n/limite" embaixo, à direita (ex.: post de 280). */
  limite?: number;
  /** Mensagem de erro embaixo do campo (por que o valor não vale); some quando vazia. */
  erro?: string | null;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/**
 * Campo de texto afundado no padrão Cromo (formulários: persona, novo post). Ao ganhar foco, um
 * aro na cor de destaque aparece em fade; a mensagem de erro entra com fade e leve subida.
 */
export function CampoTexto({
  rotulo,
  limite,
  erro,
  value,
  multiline,
  ref,
  onFocus,
  onBlur,
  ...props
}: CampoTextoProps) {
  const { cores, tipografia } = useTema();
  const { reduzido, reduceMotion, tempo } = useMovimento();
  const foco = useSharedValue(0);
  const aro = useAnimatedStyle(() => ({ opacity: foco.value }));
  const mover = (alvo: number) => {
    foco.set(withTiming(alvo, { duration: tempo(DURACAO.rapida), easing: CURVA.saida }));
  };
  return (
    <View style={estilos.grupo}>
      <Texto estilo="mini" cor="textoSuave">
        {rotulo}
      </Texto>
      <Camada cor="superficie2" sombra="afundado" raio={20} style={estilos.caixa}>
        <TextInput
          ref={ref}
          accessibilityLabel={rotulo}
          value={value}
          multiline={multiline}
          maxLength={limite}
          maxFontSizeMultiplier={MAX_ESCALA_FONTE}
          placeholderTextColor={cores.textoSuave}
          selectionColor={cores.destaque}
          style={[tipografia.corpo, { color: cores.texto }, multiline && estilos.multilinha]}
          {...props}
          onFocus={(e) => {
            mover(1);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            mover(0);
            onBlur?.(e);
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, estilos.aro, { borderColor: cores.destaque }, aro]}
        />
      </Camada>
      {erro ? (
        <Animated.View
          key={erro}
          entering={
            reduzido
              ? undefined
              : FadeInDown.duration(DURACAO.rapida).easing(CURVA.saida).reduceMotion(reduceMotion)
          }
          exiting={FadeOut.duration(DURACAO.instante).reduceMotion(reduceMotion)}
        >
          <Texto estilo="legenda" cor="destaqueTinta" accessibilityLiveRegion="polite">
            {erro}
          </Texto>
        </Animated.View>
      ) : null}
      {limite !== undefined && (
        <Texto estilo="legenda" cor="textoSuave" style={estilos.contador}>
          {(value ?? '').length}/{limite}
        </Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 8 },
  caixa: { paddingHorizontal: 14, paddingVertical: 12 },
  aro: { borderWidth: 1.5, borderRadius: 20 },
  multilinha: { minHeight: 96, textAlignVertical: 'top' },
  contador: { alignSelf: 'flex-end' },
});
