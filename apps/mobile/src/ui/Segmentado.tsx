import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Camada } from './Camada';
import { toqueDeSelecao } from './haptico';
import { IconeAlternado } from './Icone';
import { MOLA, useMovimento } from './movimento';
import { Texto } from './Texto';
import { Tocavel } from './Tocavel';

export interface OpcaoSegmentado<Valor extends string> {
  valor: Valor;
  rotulo: string;
  icone?: LucideIcon;
}

export interface SegmentadoProps<Valor extends string> {
  opcoes: readonly OpcaoSegmentado<Valor>[];
  valor: Valor;
  onMudar: (valor: Valor) => void;
  /** Lido pelo VoiceOver como nome do grupo. */
  rotulo: string;
}

const PADDING = 4;
const GAP = 4;

/**
 * Controle segmentado em trilho afundado (10 · Aparência, 13 · Respostas). O indicador (a opção
 * elevada) desliza entre as opções na mola "deslizante"; o texto e o ícone trocam de cor em fade. Com
 * movimento reduzido o indicador salta e as cores trocam sem transição. Antes de o trilho ser
 * medido, a opção escolhida desenha o próprio fundo, igual ao indicador.
 */
export function Segmentado<Valor extends string>({
  opcoes,
  valor,
  onMudar,
  rotulo,
}: SegmentadoProps<Valor>) {
  const { reduzido } = useMovimento();
  const [largura, setLargura] = useState(0);
  const indice = Math.max(
    0,
    opcoes.findIndex((o) => o.valor === valor),
  );
  const posicao = useSharedValue(indice);

  useEffect(() => {
    posicao.value = reduzido ? indice : withSpring(indice, MOLA.deslizante);
  }, [indice, reduzido, posicao]);

  const medido = largura > 0;
  const larguraOpcao = medido
    ? (largura - PADDING * 2 - GAP * (opcoes.length - 1)) / opcoes.length
    : 0;
  const indicador = useAnimatedStyle(() => ({
    width: larguraOpcao,
    transform: [{ translateX: posicao.value * (larguraOpcao + GAP) }],
  }));

  return (
    <Camada
      cor="superficie2"
      sombra="afundado"
      raio={999}
      accessibilityRole="radiogroup"
      accessibilityLabel={rotulo}
      style={estilos.trilho}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
    >
      {medido && (
        <Animated.View pointerEvents="none" style={[estilos.indicador, indicador]}>
          <Camada cor="superficie" sombra="elevacao" raio={999} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {opcoes.map((opcao) => {
        const selecionada = opcao.valor === valor;
        const cor = selecionada ? 'texto' : 'textoSuave';
        return (
          <Tocavel
            key={opcao.valor}
            onPress={() => {
              if (!selecionada) toqueDeSelecao();
              onMudar(opcao.valor);
            }}
            accessibilityRole="radio"
            accessibilityLabel={opcao.rotulo}
            accessibilityState={{ checked: selecionada }}
            style={estilos.opcao}
          >
            <Camada
              cor={selecionada && !medido ? 'superficie' : undefined}
              sombra={selecionada && !medido ? 'elevacao' : undefined}
              raio={999}
              style={[estilos.interno, { paddingVertical: opcao.icone ? 10 : 9 }]}
            >
              {opcao.icone && (
                <IconeAlternado
                  icone={opcao.icone}
                  tamanho={15}
                  traco={2}
                  cor="textoSuave"
                  corAtiva="texto"
                  ativo={selecionada}
                />
              )}
              <Texto estilo="legenda" cor={cor} transicao>
                {opcao.rotulo}
              </Texto>
            </Camada>
          </Tocavel>
        );
      })}
    </Camada>
  );
}

const estilos = StyleSheet.create({
  trilho: { flexDirection: 'row', padding: PADDING, gap: GAP },
  // Por baixo das opções (vem antes na árvore), do topo ao fim do miolo do trilho.
  indicador: { position: 'absolute', top: PADDING, bottom: PADDING, left: PADDING },
  opcao: { flex: 1 },
  interno: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
});
