import type { Enquete } from '@holofote/shared';
import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { Icone } from '../../ui/Icone';
import { CURVA, DURACAO, MOLA, useMovimento } from '../../ui/movimento';
import { Texto } from '../../ui/Texto';
import { useAnimacoes } from '../animacao/animacoes';
import { CamadaAnimada } from '../animacao/Animados';
import { NumeroRolante } from '../animacao/NumeroRolante';
import { useEscalaDeToque } from '../animacao/toque';
import { TrocaSuave } from '../animacao/TrocaSuave';
import { parcelasDaEnquete, type OpcaoComParcela } from './formatar';

/** Espera entre uma opção e a seguinte quando o resultado aparece. */
const PASSO_MS = 90;
const INICIO_MS = 140;

export interface EnqueteHistoriaProps {
  enquete: Enquete;
  onVotar: (opcaoId: string) => void;
  votando: boolean;
}

/**
 * Enquete da história (Figma 54:1505). Antes do voto, as opções são botões; depois, cada uma
 * mostra a porcentagem e o seu voto ganha o check e a barra em destaque. Votar não gasta energia.
 * Ao votar, os botões saem, as barras enchem uma depois da outra com a porcentagem subindo e o
 * voto escolhido dá um pop.
 */
export function EnqueteHistoria({ enquete, onVotar, votando }: EnqueteHistoriaProps) {
  const { medidas } = useTema();
  const animacoes = useAnimacoes();
  const votou = enquete.meuVoto !== null;
  const parcelas = parcelasDaEnquete(enquete);

  return (
    <CamadaAnimada
      cor="superficie"
      sombra="elevacao"
      raio={medidas.cartaoRaio}
      layout={animacoes.layout}
      style={estilos.cartao}
    >
      <Texto estilo="mini" cor="textoSuave" accessibilityRole="header">
        Enquete · {enquete.pergunta}
      </Texto>
      {votou
        ? parcelas.map((opcao, i) => (
            <Resultado
              key={opcao.id}
              opcao={opcao}
              minha={opcao.id === enquete.meuVoto}
              indice={i}
            />
          ))
        : enquete.opcoes.map((opcao) => (
            <OpcaoParaVotar
              key={opcao.id}
              texto={opcao.texto}
              desabilitada={votando}
              onPress={() => onVotar(opcao.id)}
            />
          ))}
      <TrocaSuave chave={votou ? 'votou' : 'livre'}>
        <Texto estilo="legenda" cor="textoSuave">
          {votou ? 'Você votou · 0 energia' : 'Votar é grátis · 0 energia'}
        </Texto>
      </TrocaSuave>
    </CamadaAnimada>
  );
}

function Resultado({
  opcao,
  minha,
  indice,
}: {
  opcao: OpcaoComParcela;
  minha: boolean;
  indice: number;
}) {
  const animacoes = useAnimacoes();
  const { reduzido, reduceMotion } = useMovimento();
  const atraso = INICIO_MS + indice * PASSO_MS;
  const escala = useSharedValue(1);

  // O voto escolhido dá um pop quando a barra termina de encher.
  useEffect(() => {
    if (!minha || reduzido) return;
    escala.value = withDelay(
      atraso + 520,
      withSequence(
        withTiming(1.05, { duration: DURACAO.instante, easing: CURVA.saida, reduceMotion }),
        withSpring(1, { ...MOLA.viva, reduceMotion }),
      ),
    );
  }, [minha, reduzido, reduceMotion, atraso, escala]);
  const estiloDoPop = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }));

  return (
    <Animated.View entering={animacoes.deSubida(atraso - INICIO_MS)}>
      <Animated.View
        style={[estilos.resultado, estiloDoPop]}
        accessible
        accessibilityLabel={`${opcao.texto}, ${opcao.porcentagem}%${minha ? ', seu voto' : ''}`}
      >
        <View style={estilos.linha}>
          {minha && (
            <Animated.View entering={animacoes.pop(atraso + 380)}>
              <Icone icone={Check} tamanho={14} cor="destaqueTinta" traco={2} />
            </Animated.View>
          )}
          <Texto
            estilo="corpoForte"
            cor={minha ? 'texto' : 'textoSuave'}
            numberOfLines={1}
            style={estilos.flex}
          >
            {opcao.texto}
          </Texto>
          <NumeroRolante
            texto={`${opcao.porcentagem}%`}
            estilo="corpoForte"
            cor={minha ? 'destaqueTinta' : 'textoSuave'}
            desdeZero
            atraso={atraso}
          />
        </View>
        <BarraDaEnquete
          valor={opcao.parcela}
          rotulo={`Votos em ${opcao.texto}`}
          destaque={minha}
          atraso={atraso}
        />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Barra de comparação (mesmo desenho da BarraChance de 16 · Evento: trilho chapado, destaque só
 * no voto do jogador) que enche com a entrada da enquete em vez de já nascer cheia.
 */
function BarraDaEnquete({
  valor,
  rotulo,
  destaque,
  atraso,
}: {
  valor: number;
  rotulo: string;
  destaque: boolean;
  atraso: number;
}) {
  const { cores } = useTema();
  const { reduceMotion } = useMovimento();
  const proporcao = Math.min(1, Math.max(0, valor));
  const largura = useSharedValue(0);

  useEffect(() => {
    largura.value = withDelay(
      atraso,
      withTiming(proporcao, { duration: DURACAO.lenta + 240, easing: CURVA.enfase, reduceMotion }),
    );
  }, [proporcao, atraso, reduceMotion, largura]);

  const preenchimento = useAnimatedStyle(() => ({ width: `${largura.value * 100}%` }));

  return (
    <Camada
      cor="superficie2"
      raio={4}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(proporcao * 100) }}
      style={estilos.trilho}
    >
      <Animated.View
        style={[
          estilos.preenchimento,
          { backgroundColor: destaque ? cores.destaque : cores.textoFraco },
          preenchimento,
        ]}
      />
    </Camada>
  );
}

function OpcaoParaVotar(p: { texto: string; desabilitada: boolean; onPress: () => void }) {
  const animacoes = useAnimacoes();
  const toque = useEscalaDeToque();
  return (
    <Animated.View exiting={animacoes.saida} layout={animacoes.layout}>
      <Animated.View style={toque.estilo}>
        <Pressable
          onPress={p.onPress}
          onPressIn={toque.aoPressionar}
          onPressOut={toque.aoSoltar}
          disabled={p.desabilitada}
          accessibilityRole="button"
          accessibilityLabel={`Votar em ${p.texto}, grátis`}
          accessibilityState={{ disabled: p.desabilitada }}
          style={({ pressed }) => ({ opacity: pressed || p.desabilitada ? 0.7 : 1 })}
        >
          <Camada cor="fundo" borda={{ cor: 'linha', largura: 1 }} raio={999} style={estilos.opcao}>
            <Texto estilo="corpoForte" numberOfLines={2}>
              {p.texto}
            </Texto>
          </Camada>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  cartao: { width: '100%', maxWidth: 300, padding: 18, gap: 12 },
  resultado: { gap: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  opcao: { paddingHorizontal: 16, paddingVertical: 10 },
  trilho: { height: 8, overflow: 'hidden' },
  preenchimento: { height: 8, borderRadius: 4 },
});
