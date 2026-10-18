import type { NomeTipografia } from '@holofote/tokens';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LayoutAnimationConfig } from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { CURVA, DURACAO, useMovimento } from './movimento';
import { Texto, type CorDeTexto } from './Texto';

export interface NumeroAnimadoProps {
  /** O texto mostrado, já formatado (ex.: "8/12", "1,2 mil"). Quando muda, o número rola. */
  texto: string;
  estilo?: NomeTipografia;
  cor?: CorDeTexto;
  /** Transição de cor junto com a rolagem (ex.: contador curtido). */
  transicaoDeCor?: boolean;
}

/**
 * Número que rola na vertical ao mudar: o texto antigo sobe e some, o novo sobe de baixo, tudo
 * dentro de uma janela do tamanho de uma linha (curta, DURACAO.rapida). Cada valor é um filho
 * com chave própria, então a troca roda no thread de UI como animação de entrada e saída. Na
 * primeira exibição não anima; com movimento reduzido troca na hora.
 */
export function NumeroAnimado({
  texto,
  estilo = 'corpo',
  cor = 'texto',
  transicaoDeCor,
}: NumeroAnimadoProps) {
  const { tipografia } = useTema();
  const { reduzido, reduceMotion } = useMovimento();
  const altura = tipografia[estilo].lineHeight;
  const entrada = reduzido
    ? undefined
    : FadeInDown.duration(DURACAO.rapida).easing(CURVA.saida).reduceMotion(reduceMotion);
  const saida = reduzido
    ? undefined
    : FadeOutUp.duration(DURACAO.rapida).easing(CURVA.saida).reduceMotion(reduceMotion);
  return (
    <LayoutAnimationConfig skipEntering>
      <View style={[estilos.janela, { height: altura }]}>
        <Animated.View key={texto} entering={entrada} exiting={saida}>
          <Texto estilo={estilo} cor={cor} numberOfLines={1} transicao={transicaoDeCor}>
            {texto}
          </Texto>
        </Animated.View>
      </View>
    </LayoutAnimationConfig>
  );
}

const estilos = StyleSheet.create({ janela: { overflow: 'hidden' } });
