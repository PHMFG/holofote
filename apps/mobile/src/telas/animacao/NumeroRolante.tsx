// Número cujos dígitos rolam como um odômetro, tudo na thread de UI: cada coluna guarda os dez
// dígitos empilhados e só desliza. Serve para contagens que sobem (seguidores) e contadores que
// trocam (curtidas). O texto é decorativo: quem usa dá o rótulo ao pai (accessibilityLabel).
import type { NomeTipografia } from '@holofote/tokens';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { CURVA, DURACAO, useMovimento } from '../../ui/movimento';
import { Texto, type CorDeTexto } from '../../ui/Texto';

const DIGITOS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type Pedaco =
  | { tipo: 'digito'; chave: string; valor: number }
  | { tipo: 'texto'; chave: string; conteudo: string };

/** Separa o texto em dígitos e trechos; as chaves contam da direita, para a unidade ser sempre a mesma coluna. */
export function separarPedacos(texto: string): Pedaco[] {
  const crus: ({ digito: number } | { conteudo: string })[] = [];
  for (const letra of Array.from(texto)) {
    const digito = letra >= '0' && letra <= '9' ? Number(letra) : null;
    const ultimo = crus[crus.length - 1];
    if (digito !== null) crus.push({ digito });
    else if (ultimo && 'conteudo' in ultimo) ultimo.conteudo += letra;
    else crus.push({ conteudo: letra });
  }
  let digitosADireita = 0;
  let trechosADireita = 0;
  const pedacos: Pedaco[] = [];
  for (let i = crus.length - 1; i >= 0; i--) {
    const cru = crus[i]!;
    if ('digito' in cru) {
      pedacos.unshift({ tipo: 'digito', chave: `d${digitosADireita++}`, valor: cru.digito });
    } else {
      // Espaço comum no fim de um trecho some no layout do Text; o inseparável preserva a largura.
      pedacos.unshift({
        tipo: 'texto',
        chave: `t${trechosADireita++}`,
        conteudo: cru.conteudo.replace(/ /g, ' '),
      });
    }
  }
  return pedacos;
}

export interface NumeroRolanteProps {
  /** Texto já formatado: "486", "+214", "1,2 mil". */
  texto: string;
  estilo?: NomeTipografia;
  cor?: CorDeTexto;
  /** Na primeira vez os dígitos rolam desde o zero ("contagem subindo"). */
  desdeZero?: boolean;
  /** Espera antes da primeira rolagem, em ms. */
  atraso?: number;
  /** Duração da rolagem, em ms. */
  duracao?: number;
}

/** Texto com dígitos rolantes. Esconde os filhos do VoiceOver: o pai carrega o rótulo. */
export function NumeroRolante({
  texto,
  estilo = 'corpo',
  cor = 'texto',
  desdeZero = false,
  atraso = 0,
  duracao = DURACAO.lenta + 380,
}: NumeroRolanteProps) {
  const { tipografia } = useTema();
  const altura = tipografia[estilo].lineHeight;
  return (
    <View
      style={estilos.linha}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {separarPedacos(texto).map((pedaco) =>
        pedaco.tipo === 'digito' ? (
          <Digito
            key={pedaco.chave}
            valor={pedaco.valor}
            altura={altura}
            estilo={estilo}
            cor={cor}
            desdeZero={desdeZero}
            atraso={atraso}
            duracao={duracao}
          />
        ) : (
          <Texto key={pedaco.chave} estilo={estilo} cor={cor} style={{ height: altura }}>
            {pedaco.conteudo}
          </Texto>
        ),
      )}
    </View>
  );
}

interface DigitoProps {
  valor: number;
  altura: number;
  estilo: NomeTipografia;
  cor: CorDeTexto;
  desdeZero: boolean;
  atraso: number;
  duracao: number;
}

function Digito({ valor, altura, estilo, cor, desdeZero, atraso, duracao }: DigitoProps) {
  const { reduzido, reduceMotion } = useMovimento();
  const posicao = useSharedValue(desdeZero && !reduzido ? 0 : valor);
  const primeiraRolagem = useRef(true);

  useEffect(() => {
    const espera = primeiraRolagem.current ? atraso : 0;
    primeiraRolagem.current = false;
    posicao.value = withDelay(
      espera,
      withTiming(valor, {
        duration: duracao,
        easing: CURVA.enfase,
        reduceMotion,
      }),
    );
  }, [valor, atraso, duracao, reduceMotion, posicao]);

  const coluna = useAnimatedStyle(() => ({
    transform: [{ translateY: -posicao.value * altura }],
  }));

  return (
    <View style={{ height: altura, overflow: 'hidden' }}>
      <Animated.View style={coluna}>
        {DIGITOS.map((d) => (
          <Texto
            key={d}
            estilo={estilo}
            cor={cor}
            style={{ height: altura, fontVariant: ['tabular-nums'] }}
          >
            {d}
          </Texto>
        ))}
      </Animated.View>
    </View>
  );
}

const estilos = StyleSheet.create({ linha: { flexDirection: 'row', alignItems: 'flex-start' } });
