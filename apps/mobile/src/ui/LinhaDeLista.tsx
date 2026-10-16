import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Texto } from './Texto';

export interface LinhaDeListaProps {
  titulo: string;
  subtitulo?: string;
  /** Terceira linha mais fraca (14 · Mensagens: relação atual). */
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
  onPress?: () => void;
  /** Rótulo do VoiceOver quando o texto visível não basta. */
  rotuloAcessivel?: string;
  /**
   * Texto do acessório para o VoiceOver numa linha tocável (ex.: "custa 2 de energia"). Numa
   * linha sem onPress o acessório é lido sozinho e continua alcançável (ex.: um Interruptor).
   */
  rotuloFim?: string;
}

/** Linha de lista dentro de um Cartao (alertas, mensagens, ajustes, elenco). */
export function LinhaDeLista(p: LinhaDeListaProps) {
  const { cores } = useTema();
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
      <Texto estilo="corpoForte" numberOfLines={1}>
        {p.titulo}
      </Texto>
      {p.subtitulo && (
        <View style={estilos.linhaSubtitulo}>
          <Texto
            estilo={p.naoLida ? 'corpoForte' : 'legenda'}
            cor={p.naoLida ? 'texto' : 'textoSuave'}
            numberOfLines={1}
            style={estilos.subtitulo}
          >
            {p.subtitulo}
          </Texto>
          {p.naoLida && <View style={[estilos.ponto, { backgroundColor: cores.destaque }]} />}
        </View>
      )}
      {p.detalhe && (
        <Texto estilo="legenda" cor="textoFraco" numberOfLines={1}>
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
    <Pressable
      onPress={p.onPress}
      accessibilityRole="button"
      accessibilityLabel={[rotulo, p.rotuloFim].filter(Boolean).join(', ')}
      style={({ pressed }) => [...estilo, { opacity: pressed ? 0.7 : 1 }]}
    >
      {p.inicio}
      {textos}
      {p.fim}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  centro: { flex: 1, gap: 2 },
  linhaSubtitulo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  subtitulo: { flexShrink: 1 },
  ponto: { width: 9, height: 9, borderRadius: 4.5 },
});
