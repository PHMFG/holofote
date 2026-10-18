import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Camada } from '../../ui/Camada';
import { Texto } from '../../ui/Texto';
import { useAnimacoes } from '../animacao/animacoes';
import { PontosEmOnda } from '../animacao/PontosEmOnda';

/** Raio dos cantos do balão; o canto do lado de quem fala fica com 6 (Figma 18:266 e 18:269). */
const RAIO = 20;
const RAIO_PONTA = 6;

// A Camada só tem um raio: ela recebe o menor (6) e os outros cantos sobem para 20 pelo estilo.
// overflow: 'hidden' recorta o gradiente e a sombra interna no formato; a sombra externa do
// React Native fica fora do recorte.
const cantosRecebida = {
  borderTopLeftRadius: RAIO,
  borderTopRightRadius: RAIO,
  borderBottomRightRadius: RAIO,
  overflow: 'hidden' as const,
};
const cantosEnviada = {
  borderTopLeftRadius: RAIO,
  borderTopRightRadius: RAIO,
  borderBottomLeftRadius: RAIO,
  overflow: 'hidden' as const,
};

export interface BalaoProps {
  texto: string;
  /** Enviada pelo jogador: à direita, em pílula preta (clara no escuro). */
  minha: boolean;
  /** Quem falou, lido pelo VoiceOver antes do texto. */
  autor: string;
}

/** Balão de mensagem direta (04 · Mensagem direta). */
export function Balao({ texto, minha, autor }: BalaoProps) {
  return (
    <View
      style={[estilos.linha, minha && estilos.linhaMinha]}
      accessible
      accessibilityLabel={`${autor}: ${texto}`}
    >
      <Camada
        cor={minha ? undefined : 'superficie'}
        gradiente={minha ? 'pilulaPreta' : undefined}
        sombra={minha ? 'esfera' : 'elevacao'}
        raio={RAIO_PONTA}
        style={[estilos.balao, minha ? cantosEnviada : cantosRecebida]}
      >
        <Texto cor={minha ? 'primarioTexto' : 'texto'}>{texto}</Texto>
      </Camada>
    </View>
  );
}

/**
 * Três pontos em onda num balão recebido enquanto o personagem escreve (o servidor avisa pelo
 * WS). O balão cresce a partir do canto de baixo à esquerda e some com fade quando a mensagem
 * chega. `style` é do bloco de fora (o espaço extra ao trocar de lado).
 */
export function BalaoDigitando({ nome, style }: { nome: string; style?: StyleProp<ViewStyle> }) {
  const animacoes = useAnimacoes();
  return (
    <Animated.View
      entering={animacoes.balao(false)}
      exiting={animacoes.saida}
      style={[estilos.linha, estilos.origemEsquerda, style]}
      accessible
      accessibilityLabel={`${nome} está digitando`}
    >
      <Camada
        cor="superficie"
        sombra="elevacao"
        raio={RAIO_PONTA}
        style={[estilos.digitando, cantosRecebida]}
      >
        <PontosEmOnda tamanho={7} espaco={5} />
      </Camada>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row' },
  linhaMinha: { justifyContent: 'flex-end' },
  origemEsquerda: { transformOrigin: 'left bottom' },
  balao: { maxWidth: '78%', paddingHorizontal: 15, paddingVertical: 11 },
  digitando: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
});
