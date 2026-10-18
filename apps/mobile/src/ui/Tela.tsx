import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../tema/ProvedorTema';

/** Altura reservada embaixo nas abas para a pílula flutuante não cobrir conteúdo. */
export const ESPACO_BARRA_DE_ABAS = 100;

/** Trecho do conteúdo rolável (posição e altura dentro dele) que não pode ficar sob o teclado. */
export interface TrechoVisivel {
  y: number;
  altura: number;
}

/** Respiro entre o fim do trecho revelado e a borda de baixo da área rolável. */
const FOLGA_DO_TRECHO = 12;

export interface TelaProps {
  children: ReactNode;
  /** Fica fixo no topo (fora da rolagem). */
  cabecalho?: ReactNode;
  /** Fica fixo embaixo, acima do indicador de início (ex.: BotaoMetal, campo de mensagem). */
  rodape?: ReactNode;
  /** Tela dentro das abas: reserva espaço para a barra flutuante. */
  comAbas?: boolean;
  rolavel?: boolean;
  gap?: number;
  /**
   * Tela com campo de texto: quando o teclado abre, a rolagem leva o fim deste trecho (posição do
   * `onLayout` de um filho direto) até o fim da área visível, para ele não ficar sob o teclado nem
   * sob o rodapé. Use junto com um KeyboardAvoidingView, que encolhe a área rolável. Sem a prop,
   * a Tela não observa o teclado.
   */
  revelarAoTeclado?: TrechoVisivel | null;
}

/** Estrutura padrão de tela: fundo Cromo, margem lateral 16 e áreas seguras do 16e. */
export function Tela({
  children,
  cabecalho,
  rodape,
  comAbas,
  rolavel = true,
  gap = 16,
  revelarAoTeclado,
}: TelaProps) {
  const { cores, medidas } = useTema();
  const insets = useSafeAreaInsets();
  const rolagem = useRef<ScrollViewInstance>(null);
  const [tecladoAberto, setTecladoAberto] = useState(false);
  const [alturaVisivel, setAlturaVisivel] = useState(0);
  const observa = revelarAoTeclado !== undefined;
  const trechoY = revelarAoTeclado?.y;
  const trechoAltura = revelarAoTeclado?.altura;

  useEffect(() => {
    if (!observa) return;
    const abrir = Keyboard.addListener('keyboardDidShow', () => setTecladoAberto(true));
    const fechar = Keyboard.addListener('keyboardDidHide', () => setTecladoAberto(false));
    return () => {
      abrir.remove();
      fechar.remove();
    };
  }, [observa]);

  // Reage a três coisas: o teclado abrir, a área rolável mudar de altura (o KeyboardAvoidingView
  // a encolhe) e o trecho mudar de lugar (chips que quebram de linha, por exemplo).
  useEffect(() => {
    if (trechoY === undefined || trechoAltura === undefined) return;
    if (!tecladoAberto || alturaVisivel <= 0) return;
    const y = Math.max(0, trechoY + trechoAltura + FOLGA_DO_TRECHO - alturaVisivel);
    rolagem.current?.scrollTo({ y, animated: true });
  }, [tecladoAberto, alturaVisivel, trechoY, trechoAltura]);

  const topo = insets.top + 8;
  const base = comAbas ? ESPACO_BARRA_DE_ABAS + insets.bottom : rodape ? 16 : insets.bottom + 24;
  const margem = { paddingHorizontal: medidas.margemLateral };

  return (
    <View style={[estilos.tela, { backgroundColor: cores.fundo }]}>
      {cabecalho && (
        <View style={[margem, { paddingTop: topo, paddingBottom: 8 }]}>{cabecalho}</View>
      )}
      {rolavel ? (
        <ScrollView
          ref={rolagem}
          testID="tela-rolagem"
          onLayout={observa ? (e) => setAlturaVisivel(e.nativeEvent.layout.height) : undefined}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            margem,
            { paddingTop: cabecalho ? 8 : topo, paddingBottom: base, gap },
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            estilos.tela,
            margem,
            { paddingTop: cabecalho ? 8 : topo, paddingBottom: base, gap },
          ]}
        >
          {children}
        </View>
      )}
      {rodape && (
        <View
          style={[
            margem,
            {
              paddingTop: 10,
              // Com o teclado aberto o indicador de início fica escondido: não precisa da folga.
              paddingBottom: tecladoAberto ? 16 : Math.max(insets.bottom, 16),
            },
          ]}
        >
          {rodape}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({ tela: { flex: 1 } });
