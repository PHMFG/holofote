import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { LayoutAnimationConfig, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { DURACAO, ESCALA_TOQUE_LEVE, MOLA, useMovimento } from './movimento';
import { Texto } from './Texto';
import { Tocavel } from './Tocavel';

export interface LinhaDeListaProps {
  titulo: string;
  subtitulo?: string;
  /** Terceira linha (14 · Mensagens: relação atual), em texto-suave para passar de 4,5:1. */
  detalhe?: string;
  /** Avatar ou esfera à esquerda. */
  inicio?: ReactNode;
  /** Acessório à direita: hora, interruptor, valor, custo ou chevron. */
  fim?: ReactNode;
  /** Item ainda não visto: título da prévia em negrito e ponto de destaque. */
  naoLida?: boolean;
  /** Borda de 1 px embaixo; desligue na última linha do cartão. */
  separador?: boolean;
  /** Alertas alinham ao topo; o resto centraliza. */
  alinharAoTopo?: boolean;
  /** Título em corpo regular e texto-suave, para o valor à direita ser o destaque (18 · Marco). */
  tituloDiscreto?: boolean;
  /** Linhas do título antes das reticências (1 por padrão; textos longos, como pendências, usam 2). */
  linhasDoTitulo?: number;
  onPress?: () => void;
  /** Rótulo do VoiceOver quando o texto visível não basta. */
  rotuloAcessivel?: string;
  /**
   * Texto do acessório para o VoiceOver numa linha tocável (ex.: "custa 2 de energia"). Numa
   * linha sem onPress o acessório é lido sozinho e continua alcançável (ex.: um Interruptor).
   */
  rotuloFim?: string;
}

/**
 * Linha de lista dentro de um Cartao (alertas, mensagens, ajustes, elenco). A linha tocável
 * encolhe de leve e perde brilho sob o dedo; o ponto de "não lida" aparece e some com um pop
 * (não anima quando a linha nasce já não lida, para não repetir ao rolar a lista).
 */
export function LinhaDeLista(p: LinhaDeListaProps) {
  const { cores } = useTema();
  const { reduzido, reduceMotion } = useMovimento();
  const entradaDoPonto = reduzido
    ? undefined
    : ZoomIn.springify()
        .damping(MOLA.viva.damping)
        .stiffness(MOLA.viva.stiffness)
        .reduceMotion(reduceMotion);
  const saidaDoPonto = reduzido
    ? undefined
    : ZoomOut.duration(DURACAO.rapida).reduceMotion(reduceMotion);
  const rotulo =
    p.rotuloAcessivel ??
    [p.titulo, p.subtitulo, p.detalhe, p.naoLida ? 'não lida' : undefined]
      .filter(Boolean)
      .join(', ');

  const textos = (
    <View
      style={estilos.centro}
      // Sem onPress, só os textos se agrupam; o acessório fica como elemento próprio.
      accessible={!p.onPress}
      accessibilityLabel={p.onPress ? undefined : rotulo}
    >
      <Texto
        estilo={p.tituloDiscreto ? 'corpo' : 'corpoForte'}
        cor={p.tituloDiscreto ? 'textoSuave' : 'texto'}
        numberOfLines={p.linhasDoTitulo ?? 1}
      >
        {p.titulo}
      </Texto>
      {p.subtitulo && (
        <LayoutAnimationConfig skipEntering>
          <View style={estilos.linhaSubtitulo}>
            <Texto
              estilo={p.naoLida ? 'corpoForte' : 'legenda'}
              cor={p.naoLida ? 'texto' : 'textoSuave'}
              numberOfLines={1}
              style={estilos.subtitulo}
            >
              {p.subtitulo}
            </Texto>
            {p.naoLida && (
              <Animated.View
                entering={entradaDoPonto}
                exiting={saidaDoPonto}
                style={[estilos.ponto, { backgroundColor: cores.destaque }]}
              />
            )}
          </View>
        </LayoutAnimationConfig>
      )}
      {p.detalhe && (
        <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
          {p.detalhe}
        </Texto>
      )}
    </View>
  );

  const estilo = [
    estilos.linha,
    { alignItems: p.alinharAoTopo ? ('flex-start' as const) : ('center' as const) },
    p.separador !== false && { borderBottomWidth: 1, borderBottomColor: cores.linha },
  ];

  if (!p.onPress) {
    return (
      <View style={estilo}>
        {p.inicio}
        {textos}
        {p.fim}
      </View>
    );
  }
  return (
    <Tocavel
      onPress={p.onPress}
      accessibilityRole="button"
      accessibilityLabel={[rotulo, p.rotuloFim].filter(Boolean).join(', ')}
      escala={ESCALA_TOQUE_LEVE}
      brilho={0.75}
      style={estilo}
    >
      {p.inicio}
      {textos}
      {p.fim}
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  centro: { flex: 1, gap: 2 },
  linhaSubtitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitulo: { flexShrink: 1 },
  ponto: { width: 9, height: 9, borderRadius: 4.5 },
});
