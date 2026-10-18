import { MAX_ESCALA_FONTE, type NomeTipografia } from '@holofote/tokens';
import { useEffect, useRef } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Texto, type CorDeTexto } from '../../ui/Texto';
import { CURVA, DURACAO, useMovimento } from '../../ui/movimento';

const CampoAnimado = Animated.createAnimatedComponent(TextInput);

interface Partes {
  prefixo: string;
  sufixo: string;
  alvo: number;
  casas: number;
  /** O texto original agrupa milhares com ponto ("1.250"). */
  grupos: boolean;
}

/** Separa "+1,2 mil", "72%", "1.250" em prefixo, número e sufixo. Sem dígitos, devolve null. */
export function partirNumero(texto: string): Partes | null {
  const m = /^(\D*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?([\s\S]*)$/.exec(texto);
  if (!m) return null;
  const decimais = m[3] ?? '';
  const inteiro = (m[2] ?? '').replace(/\./g, '');
  return {
    prefixo: m[1] ?? '',
    sufixo: m[4] ?? '',
    alvo: Number(decimais ? `${inteiro}.${decimais}` : inteiro),
    casas: decimais.length,
    grupos: (m[2] ?? '').includes('.'),
  };
}

/** Escreve o número no formato do texto original (vírgula decimal, ponto nos milhares). */
function montar(v: number, casas: number, grupos: boolean, prefixo: string, sufixo: string) {
  'worklet';
  const s = v.toFixed(casas);
  const ponto = s.indexOf('.');
  let inteiro = ponto < 0 ? s : s.slice(0, ponto);
  const decimais = ponto < 0 ? '' : s.slice(ponto + 1);
  if (grupos) inteiro = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return prefixo + inteiro + (decimais ? `,${decimais}` : '') + sufixo;
}

/** Acima disso a contagem não roda por padrão (textos longos podem encolher para caber). */
const MAX_CARACTERES = 10;

export interface NumeroContandoProps {
  /** Texto final já formatado ("1,2 mil", "72%", "+6"). Os dígitos contam até ele. */
  texto: string;
  estilo?: NomeTipografia;
  cor?: CorDeTexto;
  /** Atraso em ms antes de começar a contar. */
  atraso?: number;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  /** Textos mais longos que isto aparecem direto, sem contar. */
  animarAte?: number;
}

/**
 * Número que conta de 0 (ou do valor anterior) até o final, na thread de UI: o texto da contagem
 * é um campo só de leitura atualizado por animatedProps, sem setState por quadro. O Texto real
 * fica por baixo, dando o tamanho, o VoiceOver e o valor exato quando a contagem termina.
 * Movimento reduzido: só o Texto, direto no valor.
 */
export function NumeroContando({
  texto,
  estilo = 'corpoForte',
  cor = 'texto',
  atraso = 0,
  style,
  numberOfLines,
  adjustsFontSizeToFit,
  animarAte = MAX_CARACTERES,
}: NumeroContandoProps) {
  const tema = useTema();
  const { reduzido } = useMovimento();
  const partes = partirNumero(texto);
  const alvo = partes?.alvo ?? 0;
  const animavel = !!partes && !reduzido && texto.length <= animarAte;
  const atual = useSharedValue(animavel ? 0 : alvo);
  const primeira = useRef(true);

  useEffect(() => {
    if (!animavel) {
      atual.value = alvo;
      return;
    }
    const inicial = primeira.current;
    primeira.current = false;
    atual.value = withDelay(
      inicial ? atraso : 0,
      withTiming(alvo, {
        duration: inicial ? DURACAO.lenta + 200 : DURACAO.media,
        easing: CURVA.saida,
      }),
    );
  }, [alvo, animavel, atraso, atual]);

  const prefixo = partes?.prefixo ?? '';
  const sufixo = partes?.sufixo ?? '';
  const casas = partes?.casas ?? 0;
  const grupos = partes?.grupos ?? false;

  const propsDoCampo = useAnimatedProps(() => {
    const t = atual.value === alvo ? texto : montar(atual.value, casas, grupos, prefixo, sufixo);
    return { text: t, defaultValue: t } as object;
  });
  const estiloContando = useAnimatedStyle(() => ({ opacity: atual.value === alvo ? 0 : 1 }));
  const estiloFinal = useAnimatedStyle(() => ({ opacity: atual.value === alvo ? 1 : 0 }));

  if (!animavel) {
    return (
      <Texto
        estilo={estilo}
        cor={cor}
        style={style}
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit={adjustsFontSizeToFit}
      >
        {texto}
      </Texto>
    );
  }
  return (
    <View>
      <Animated.View style={estiloFinal}>
        <Texto estilo={estilo} cor={cor} style={style} numberOfLines={numberOfLines}>
          {texto}
        </Texto>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, estiloContando]} pointerEvents="none">
        <CampoAnimado
          editable={false}
          pointerEvents="none"
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          defaultValue={montar(0, casas, grupos, prefixo, sufixo)}
          maxFontSizeMultiplier={MAX_ESCALA_FONTE}
          animatedProps={propsDoCampo}
          style={[
            tema.tipografia[estilo],
            estilo === 'mini' && { textTransform: 'uppercase' },
            { color: tema.cores[cor], padding: 0, margin: 0 },
            style,
          ]}
        />
      </Animated.View>
    </View>
  );
}
