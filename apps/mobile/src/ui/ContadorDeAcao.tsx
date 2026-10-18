import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { formatarNumero } from '../formatar';
import { IconeAlternado } from './Icone';
import { usePop } from './movimento';
import { NumeroAnimado } from './NumeroAnimado';
import { Tocavel } from './Tocavel';

export interface ContadorDeAcaoProps {
  icone: LucideIcon;
  tamanhoIcone?: number;
  traco?: number;
  valor: number;
  /** Plural lido depois do número pelo VoiceOver: "respostas", "curtidas". */
  rotulo: string;
  /** Ativo (curtido): cor de destaque e pop do ícone. */
  ativo?: boolean;
  /** Espaço entre o ícone e o número. */
  espaco?: number;
  onPress?: () => void;
}

/**
 * Ícone com contagem de um post ou resposta (responder, repostar, curtir). O ícone faz um pop e
 * muda de cor em fade ao ficar ativo; o número rola quando muda; o toque encolhe o conjunto.
 */
export function ContadorDeAcao({
  icone,
  tamanhoIcone = 16,
  traco,
  valor,
  rotulo,
  ativo,
  espaco = 6,
  onPress,
}: ContadorDeAcaoProps) {
  const pop = usePop(!!ativo);
  const texto = formatarNumero(valor);
  return (
    <Tocavel
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${texto} ${rotulo}`}
      accessibilityState={{ selected: !!ativo }}
      style={[estilos.linha, { gap: espaco }]}
    >
      <Animated.View style={pop}>
        <IconeAlternado
          icone={icone}
          tamanho={tamanhoIcone}
          traco={traco}
          cor="textoSuave"
          corAtiva="destaqueTinta"
          ativo={!!ativo}
        />
      </Animated.View>
      <NumeroAnimado
        texto={texto}
        estilo="legenda"
        cor={ativo ? 'destaqueTinta' : 'textoSuave'}
        transicaoDeCor
      />
    </Tocavel>
  );
}

const estilos = StyleSheet.create({ linha: { flexDirection: 'row', alignItems: 'center' } });
