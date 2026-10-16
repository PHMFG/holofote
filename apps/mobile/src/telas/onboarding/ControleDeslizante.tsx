import { useState } from 'react';
import {
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { Esfera } from '../../ui/Esfera';

const BOLA = 26;
const TRILHO = 8;

export interface ControleDeslizanteProps {
  /** De 0 a 100. */
  valor: number;
  onMudar: (valor: number) => void;
  /** Lido pelo VoiceOver, ex.: "Tom do mundo". */
  rotulo: string;
  /** Valor falado, ex.: "70% caótico". */
  textoDoValor: string;
  /** Quanto cada gesto de ajuste do VoiceOver (deslizar para cima ou baixo) muda. */
  passo?: number;
}

const limitar = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * Controle deslizante de 0 a 100 do tom do mundo (Figma 14:67): trilho afundado de 8, parte
 * preenchida em destaque-gráfico e bola em esfera clara de 26. Para o VoiceOver é um
 * `adjustable` com incremento e decremento.
 */
export function ControleDeslizante({
  valor,
  onMudar,
  rotulo,
  textoDoValor,
  passo = 10,
}: ControleDeslizanteProps) {
  const { cores } = useTema();
  const [largura, setLargura] = useState(0);
  const curso = Math.max(1, largura - BOLA);
  const proporcao = limitar(valor) / 100;

  // Os filhos não recebem toque (pointerEvents none): locationX é sempre relativo ao controle.
  const mover = (evento: GestureResponderEvent) => {
    if (largura === 0) return;
    const novo = limitar(((evento.nativeEvent.locationX - BOLA / 2) / curso) * 100);
    if (novo !== valor) onMudar(novo);
  };

  const ajustar = (evento: AccessibilityActionEvent) => {
    if (evento.nativeEvent.actionName === 'increment') onMudar(limitar(valor + passo));
    if (evento.nativeEvent.actionName === 'decrement') onMudar(limitar(valor - passo));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: limitar(valor), text: textoDoValor }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={ajustar}
      onLayout={(e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // Arrastar na horizontal não deve virar rolagem da tela.
      onResponderTerminationRequest={() => false}
      onResponderGrant={mover}
      onResponderMove={mover}
      hitSlop={{ top: 10, bottom: 10 }}
      style={estilos.controle}
    >
      <Camada
        pointerEvents="none"
        cor="superficie2"
        sombra="afundado"
        raio={TRILHO / 2}
        style={estilos.trilho}
      >
        <View
          style={[
            estilos.preenchido,
            { width: BOLA / 2 + proporcao * curso, backgroundColor: cores.destaqueGrafico },
          ]}
        />
      </Camada>
      <View pointerEvents="none" style={[estilos.bola, { left: proporcao * curso }]}>
        <Esfera tom="claro" tamanho={BOLA} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  controle: { height: BOLA, justifyContent: 'center' },
  trilho: { height: TRILHO, overflow: 'hidden' },
  preenchido: { height: TRILHO, borderRadius: TRILHO / 2 },
  bola: { position: 'absolute', top: 0 },
});
