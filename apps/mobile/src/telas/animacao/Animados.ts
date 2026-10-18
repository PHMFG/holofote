import Animated from 'react-native-reanimated';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';

/** Cartão que aceita `layout`, `entering` e `exiting` (a altura anima quando o conteúdo muda). */
export const CartaoAnimado = Animated.createAnimatedComponent(Cartao);

/** Camada que aceita `layout`, `entering` e `exiting`. */
export const CamadaAnimada = Animated.createAnimatedComponent(Camada);
