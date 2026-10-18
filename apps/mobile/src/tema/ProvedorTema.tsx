import { montarTema, type Modo, type Tema } from '@holofote/tokens';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, StyleSheet, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAparencia } from '../estado/aparencia';
import { CURVA, DURACAO, useMovimento } from '../ui/movimento';

const ContextoTema = createContext<Tema | null>(null);

/**
 * Quanto o conteúdo escurece no meio da troca de destaque (a troca de claro/escuro vai a zero).
 * Só o destaque muda, o fundo é o mesmo: um piscar leve basta.
 */
const OPACIDADE_TROCA_DE_DESTAQUE = 0.4;

/**
 * Tema do app. Trocar claro/escuro ou a cor de destaque não corta seco: o conteúdo some em fade
 * (DURACAO.instante), o tema novo entra no meio da troca, quando o conteúdo já está apagado (a
 * remontagem das cores acontece onde ninguém vê) e o conteúdo volta em fade (DURACAO.rapida),
 * enquanto o fundo por trás passa de uma cor para a outra. Tudo no thread de UI; só um setState
 * no meio da troca. Não é um crossfade por elemento (isso pediria um Animated por texto, sombra e
 * gradiente do app inteiro, e os gradientes e ícones SVG não animam cor). Com movimento reduzido
 * o tema troca na hora. Também é a raiz do Gesture Handler.
 */
export function ProvedorTema({ children }: { children: ReactNode }) {
  const preferencia = useAparencia((s) => s.tema);
  const destaque = useAparencia((s) => s.destaque);
  const esquema = useColorScheme();
  const { reduzido } = useMovimento();

  // Teclado, alertas e componentes nativos seguem a escolha do jogador.
  useEffect(() => {
    Appearance.setColorScheme(
      preferencia === 'sistema' ? 'unspecified' : preferencia === 'escuro' ? 'dark' : 'light',
    );
  }, [preferencia]);

  const modo: Modo =
    preferencia === 'sistema' ? (esquema === 'dark' ? 'escuro' : 'claro') : preferencia;
  const desejado = useMemo(() => montarTema(modo, destaque), [modo, destaque]);

  // O tema que o app mostra: segue o desejado com a troca animada no meio.
  const [aplicado, setAplicado] = useState(desejado);
  const aplicadoRef = useRef(desejado);
  const alvoRef = useRef(desejado);
  const tema = reduzido ? desejado : aplicado;

  const opacidade = useSharedValue(1);
  const mistura = useSharedValue(1);
  const de = useSharedValue(desejado.cores.fundo);
  const para = useSharedValue(desejado.cores.fundo);

  const aplicar = useCallback(() => {
    aplicadoRef.current = alvoRef.current;
    setAplicado(alvoRef.current);
  }, []);

  useEffect(() => {
    alvoRef.current = desejado;
    const atual = aplicadoRef.current;
    if (reduzido) {
      aplicadoRef.current = desejado;
      de.value = desejado.cores.fundo;
      para.value = desejado.cores.fundo;
      mistura.value = 1;
      opacidade.value = 1;
      return;
    }
    if (desejado === atual) return;
    const mudouModo = desejado.modo !== atual.modo;
    de.value = atual.cores.fundo;
    para.value = desejado.cores.fundo;
    mistura.value = 0;
    mistura.value = withTiming(1, {
      duration: DURACAO.instante + DURACAO.rapida,
      easing: CURVA.entradaSaida,
    });
    opacidade.value = withTiming(
      mudouModo ? 0 : OPACIDADE_TROCA_DE_DESTAQUE,
      { duration: DURACAO.instante, easing: CURVA.saida },
      (terminou) => {
        // Interrompida por uma troca mais nova: o efeito dela assume.
        if (!terminou) return;
        runOnJS(aplicar)();
        opacidade.value = withTiming(1, { duration: DURACAO.rapida, easing: CURVA.saida });
      },
    );
  }, [desejado, reduzido, aplicar, opacidade, mistura, de, para]);

  const fundo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(mistura.value, [0, 1], [de.value, para.value]),
  }));
  const conteudo = useAnimatedStyle(() => ({ opacity: opacidade.value }));

  const temaNavegacao = useMemo(() => {
    const base = tema.modo === 'escuro' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: tema.modo === 'escuro',
      colors: {
        ...base.colors,
        background: tema.cores.fundo,
        card: tema.cores.superficie,
        text: tema.cores.texto,
        border: tema.cores.linha,
        primary: tema.cores.destaqueTinta,
        notification: tema.cores.destaque,
      },
    };
  }, [tema]);

  return (
    <ContextoTema.Provider value={tema}>
      <ThemeProvider value={temaNavegacao}>
        <GestureHandlerRootView style={estilos.raiz}>
          {/* Por baixo de tudo: o fundo do tema, que também cobre qualquer quadro entre telas. */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tema.cores.fundo }, fundo]}
          />
          <Animated.View style={[estilos.raiz, conteudo]}>{children}</Animated.View>
        </GestureHandlerRootView>
        <StatusBar style={tema.modo === 'escuro' ? 'light' : 'dark'} />
      </ThemeProvider>
    </ContextoTema.Provider>
  );
}

const estilos = StyleSheet.create({ raiz: { flex: 1 } });

export function useTema(): Tema {
  const tema = useContext(ContextoTema);
  if (!tema) throw new Error('useTema precisa estar dentro do ProvedorTema');
  return tema;
}
