import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { semOpacidade } from '../tema/cor';
import { useTema } from '../tema/ProvedorTema';

/** Altura reservada embaixo nas abas para a pílula flutuante não cobrir conteúdo. */
export const ESPACO_BARRA_DE_ABAS = 100;

/** Trecho do conteúdo rolável (posição e altura dentro dele) que não pode ficar sob o teclado. */
export interface TrechoVisivel {
  y: number;
  altura: number;
}

/** Respiro entre o fim do trecho revelado e a borda de baixo da área visível. */
const FOLGA_DO_TRECHO = 12;
/** Quanto o véu passa da borda do cabeçalho e do rodapé, para o conteúdo sumir suave. */
const ALCANCE_DO_VEU = 20;

/** Espaço que o conteúdo deixa em cima e embaixo para o cabeçalho e o rodapé flutuantes. */
export interface EspacosDaTela {
  topo: number;
  base: number;
}

const ContextoEspacos = createContext<EspacosDaTela>({ topo: 0, base: 0 });

/**
 * Para telas com rolagem própria (`rolagemPropria`): o padding de cima e de baixo que a lista
 * precisa para o primeiro e o último item não ficarem sob o cabeçalho e o rodapé flutuantes.
 */
export function useEspacosDaTela(): EspacosDaTela {
  return useContext(ContextoEspacos);
}

/** Render prop com os espaços da Tela, para a lista própria que fica dentro dela. */
export function ComEspacosDaTela({
  children,
}: {
  children: (espacos: EspacosDaTela) => ReactNode;
}) {
  return <>{children(useEspacosDaTela())}</>;
}

export interface TelaProps {
  children: ReactNode;
  /** Flutua no topo, sobre o conteúdo, com um véu do fundo que some para baixo. */
  cabecalho?: ReactNode;
  /** Flutua embaixo, sobre o conteúdo (ex.: BotaoMetal, campo de mensagem), com véu. */
  rodape?: ReactNode;
  /** Tela dentro das abas: reserva espaço para a barra flutuante. */
  comAbas?: boolean;
  rolavel?: boolean;
  /**
   * A tela tem a própria rolagem (DM, listas): o conteúdo ocupa a tela inteira, por baixo do
   * cabeçalho e do rodapé, e a lista usa `useEspacosDaTela()` no padding.
   */
  rolagemPropria?: boolean;
  gap?: number;
  /**
   * Tela com campo de texto: quando o teclado abre, a rolagem leva o fim deste trecho (posição do
   * `onLayout` de um filho direto) até o fim da área visível, para ele não ficar sob o teclado nem
   * sob o rodapé. Use junto com um KeyboardAvoidingView, que encolhe a área rolável. Sem a prop,
   * a Tela não observa o teclado.
   */
  revelarAoTeclado?: TrechoVisivel | null;
}

/**
 * Estrutura padrão de tela: fundo Cromo, margem lateral 16 e áreas seguras do 16e. Cabeçalho e
 * rodapé flutuam como as barras do feed e das abas: o conteúdo rola por trás e some num véu do
 * próprio fundo, sem faixa que corte os cartões, as sombras e o brilho dos botões.
 */
export function Tela({
  children,
  cabecalho,
  rodape,
  comAbas,
  rolavel = true,
  rolagemPropria = false,
  gap = 16,
  revelarAoTeclado,
}: TelaProps) {
  const { cores, medidas } = useTema();
  const insets = useSafeAreaInsets();
  const rolagem = useRef<ScrollViewInstance>(null);
  const [tecladoAberto, setTecladoAberto] = useState(false);
  const [alturaVisivel, setAlturaVisivel] = useState(0);
  const [alturaCabecalho, setAlturaCabecalho] = useState(0);
  const [alturaRodape, setAlturaRodape] = useState(0);
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
  // a encolhe) e o trecho mudar de lugar. O rodapé flutua por cima: a parte visível acaba nele.
  useEffect(() => {
    if (trechoY === undefined || trechoAltura === undefined) return;
    if (!tecladoAberto || alturaVisivel <= 0) return;
    const visivel = alturaVisivel - alturaRodape;
    const y = Math.max(0, trechoY + trechoAltura + FOLGA_DO_TRECHO - visivel);
    rolagem.current?.scrollTo({ y, animated: true });
  }, [tecladoAberto, alturaVisivel, alturaRodape, trechoY, trechoAltura]);

  const topoSeguro = insets.top + 8;
  // Antes de medir, usa uma estimativa para o primeiro quadro não pular.
  const espacoCabecalho = cabecalho ? alturaCabecalho || topoSeguro + 52 : 0;
  const espacoRodape = rodape ? alturaRodape || Math.max(insets.bottom, 16) + 64 : 0;
  const topo = cabecalho ? espacoCabecalho + 8 : topoSeguro;
  const base = comAbas
    ? ESPACO_BARRA_DE_ABAS + insets.bottom
    : rodape
      ? espacoRodape + 16
      : insets.bottom + 24;
  const margem = { paddingHorizontal: medidas.margemLateral };
  const transparente = semOpacidade(cores.fundo);

  return (
    <ContextoEspacos.Provider value={{ topo, base }}>
      <View style={[estilos.tela, { backgroundColor: cores.fundo }]}>
        {rolagemPropria ? (
          <View style={estilos.tela}>{children}</View>
        ) : rolavel ? (
          <ScrollView
            ref={rolagem}
            testID="tela-rolagem"
            onLayout={observa ? (e) => setAlturaVisivel(e.nativeEvent.layout.height) : undefined}
            keyboardShouldPersistTaps="handled"
            scrollIndicatorInsets={{ top: espacoCabecalho, bottom: espacoRodape }}
            contentContainerStyle={[margem, { paddingTop: topo, paddingBottom: base, gap }]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[estilos.tela, margem, { paddingTop: topo, paddingBottom: base, gap }]}>
            {children}
          </View>
        )}

        {cabecalho && (
          <View
            pointerEvents="box-none"
            style={estilos.cabecalho}
            onLayout={(e) => setAlturaCabecalho(e.nativeEvent.layout.height)}
          >
            {/* Véu: opaco sob a barra de status e o cabeçalho, some logo abaixo dele. */}
            <LinearGradient
              pointerEvents="none"
              colors={[cores.fundo, cores.fundo, transparente]}
              locations={[0, 0.72, 1]}
              style={[estilos.veu, { bottom: -ALCANCE_DO_VEU }]}
            />
            <View
              pointerEvents="box-none"
              style={[margem, { paddingTop: topoSeguro, paddingBottom: 8 }]}
            >
              {cabecalho}
            </View>
          </View>
        )}

        {rodape && (
          <View
            pointerEvents="box-none"
            style={estilos.rodape}
            onLayout={(e) => setAlturaRodape(e.nativeEvent.layout.height)}
          >
            <LinearGradient
              pointerEvents="none"
              colors={[transparente, cores.fundo, cores.fundo]}
              locations={[0, 0.45, 1]}
              style={[estilos.veu, { top: -ALCANCE_DO_VEU }]}
            />
            <View
              pointerEvents="box-none"
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
          </View>
        )}
      </View>
    </ContextoEspacos.Provider>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  cabecalho: { position: 'absolute', top: 0, left: 0, right: 0 },
  rodape: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  veu: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});
