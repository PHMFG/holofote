import { StyleSheet, View } from 'react-native';
import { Camada } from '../../ui/Camada';
import { PontosDigitando } from '../../ui/PontosDigitando';
import { Texto } from '../../ui/Texto';

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

/** Três pontos num balão recebido enquanto o personagem escreve (o servidor avisa pelo WS). */
export function BalaoDigitando({ nome }: { nome: string }) {
  return (
    <View style={estilos.linha} accessible accessibilityLabel={`${nome} está digitando`}>
      <Camada
        cor="superficie"
        sombra="elevacao"
        raio={RAIO_PONTA}
        style={[estilos.digitando, cantosRecebida]}
      >
        <PontosDigitando tamanho={7} espaco={5} />
      </Camada>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row' },
  linhaMinha: { justifyContent: 'flex-end' },
  balao: { maxWidth: '78%', paddingHorizontal: 15, paddingVertical: 11 },
  digitando: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
});
