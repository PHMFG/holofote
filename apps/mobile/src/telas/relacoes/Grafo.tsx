import type { PersonagemResumo } from '@holofote/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeOut,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Camada } from '../../ui/Camada';
import { Texto } from '../../ui/Texto';
import { Aparecer } from '../../ui/Aparecer';
import { DURACAO, MOLA, useMovimento } from '../../ui/movimento';
import { Pop } from '../perfil/efeitos';
import { primeiroNome } from '../../formatar';
import {
  LIMITE_PROXIMO,
  alturaDoMapa,
  dimensoesDosNos,
  estiloDoLaco,
  posicionarNos,
  type EstiloLaco,
  type NoDoMapa,
  type Ponto,
} from './layout';

const LinhaAnimada = Animated.createAnimatedComponent(Line);

const JOGADOR = 60;
const CAIXA_JOGADOR = 96;
/**
 * Caixa de cada nó, bem mais larga que o rótulo: o rótulo se ajusta ao texto (sem reticências) e o
 * layout já reservou o lugar dele. A caixa é só transparente; o toque fica no avatar e no rótulo.
 */
const CAIXA_DO_NO = 160;

export interface GrafoProps {
  jogador: PersonagemResumo;
  nos: readonly NoDoMapa[];
  selecionadoId: string | null;
  onSelecionar: (personagemId: string) => void;
  /** Frase no lugar dos nós quando o filtro não tem ninguém. */
  vazio: string;
}

/** Grafo de 21 · Mapa de relações (Figma 57:1729): o jogador no centro, o elenco em volta. */
export function Grafo({ jogador, nos, selecionadoId, onSelecionar, vazio }: GrafoProps) {
  const { cores, medidas } = useTema();
  const { reduzido, reduceMotion } = useMovimento();
  const janela = useWindowDimensions();
  // Antes do primeiro onLayout, a largura da tela menos as margens.
  const [largura, setLargura] = useState(janela.width - medidas.margemLateral * 2);
  const altura = alturaDoMapa(nos.length);
  // O primeiro nome inteiro sempre que couber. Mapa denso (10 ou mais): avatar menor e rótulo só
  // com o nome; o percentual vai ao selecionar. No folgado, o percentual sai se não couber.
  const { avatar } = dimensoesDosNos(nos.length);
  const {
    centro,
    nos: pontos,
    comPercentual,
  } = useMemo(
    () =>
      posicionarNos(
        nos.map((n) => n.relacao.afinidade),
        largura,
        altura,
        nos.map((n) => primeiroNome(n.personagem.nome)),
      ),
    [nos, largura, altura],
  );

  // O grafo nasce do centro: cada nó parte do jogador (ou de onde estava antes do filtro) e vai
  // para o lugar novo com mola, e a linha de cada um acompanha. Um progresso só dirige tudo, com
  // um pequeno atraso por nó, e o desenho acontece na thread de UI.
  // Só o desenho conta: selecionar um nó refaz `nos` e `pontos`, mas não move ninguém.
  const assinatura = nos
    .map((n, i) => `${n.personagem.id}:${pontos[i]!.x.toFixed(1)},${pontos[i]!.y.toFixed(1)}`)
    .join(';');
  const alvosAgora = new Map(nos.map((n, i) => [n.personagem.id, pontos[i]!] as const));
  const [desenho, setDesenho] = useState({
    assinatura,
    alvos: alvosAgora,
    origens: new Map<string, Ponto>(),
  });
  // Desenho novo (filtro, largura): o que era alvo vira a origem e os nós andam dali até o novo lugar.
  if (desenho.assinatura !== assinatura) {
    setDesenho({ assinatura, alvos: alvosAgora, origens: desenho.alvos });
  }
  const origens = desenho.origens;
  const progresso = useSharedValue(reduzido ? 1 : 0);
  const primeiroDesenho = useRef(true);
  useEffect(() => {
    if (reduzido) {
      progresso.value = 1;
      return;
    }
    const inicial = primeiroDesenho.current;
    primeiroDesenho.current = false;
    progresso.value = 0;
    progresso.value = withDelay(
      inicial ? 120 : 0,
      withSpring(1, inicial ? MOLA.suave : MOLA.firme),
    );
  }, [assinatura, reduzido, progresso]);
  useEffect(() => () => cancelAnimation(progresso), [progresso]);

  const algumSelecionado = selecionadoId !== null;

  return (
    <Camada
      cor="superficie"
      sombra="elevacao"
      raio={medidas.cartaoRaio}
      style={{ height: altura }}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
        <Svg width={largura} height={altura}>
          {nos.map((no, i) => {
            const alvo = pontos[i]!;
            return (
              <LinhaDoNo
                key={no.personagem.id}
                indice={i}
                origem={origens.get(no.personagem.id) ?? centro}
                alvo={alvo}
                centro={centro}
                laco={estiloDoLaco(no.relacao.afinidade)}
                progresso={progresso}
                selecionado={no.personagem.id === selecionadoId}
                algumSelecionado={algumSelecionado}
                stroke={cores[estiloDoLaco(no.relacao.afinidade).cor]}
              />
            );
          })}
        </Svg>
      </View>

      <View
        pointerEvents="none"
        style={[
          estilos.no,
          { width: CAIXA_JOGADOR, left: centro.x - CAIXA_JOGADOR / 2, top: centro.y - JOGADOR / 2 },
        ]}
        accessible
        accessibilityLabel={`Você, ${jogador.nome}`}
      >
        <Pop de={0.6} mola={MOLA.viva} style={estilos.centrado}>
          <Avatar iniciais={jogador.iniciais} tom="escuro" tamanho={JOGADOR} />
          <Camada cor="superficie" raio={999} style={estilos.halo}>
            <Camada cor="superficie" raio={999} style={estilos.rotulo}>
              <Texto estilo="legenda">Você</Texto>
            </Camada>
          </Camada>
        </Pop>
      </View>

      {nos.map((no, i) => (
        <NoDoGrafo
          key={no.personagem.id}
          no={no}
          indice={i}
          entrando={!origens.has(no.personagem.id)}
          origem={origens.get(no.personagem.id) ?? centro}
          alvo={pontos[i]!}
          avatar={avatar}
          comPercentual={comPercentual}
          progresso={progresso}
          selecionado={no.personagem.id === selecionadoId}
          onSelecionar={onSelecionar}
          reduceMotion={reduceMotion}
        />
      ))}

      {nos.length === 0 && (
        <Aparecer modo="fade" style={[estilos.vazio, { top: centro.y + JOGADOR / 2 + 40 }]}>
          <Texto cor="textoSuave" style={estilos.textoVazio}>
            {vazio}
          </Texto>
        </Aparecer>
      )}
    </Camada>
  );
}

/** Quanto do caminho (origem até o alvo) o nó já andou; passa de 1 no estouro da mola. */
function andamento(progresso: number, indice: number) {
  'worklet';
  // Cada nó larga um pouco depois do anterior (leque saindo do centro).
  const espera = Math.min(indice, 10) * 0.035;
  return Math.max(0, (progresso - espera) / (1 - espera));
}

/** Linha do jogador até o nó: acompanha o nó saindo do centro e destaca a do selecionado. */
function LinhaDoNo({
  indice,
  origem,
  alvo,
  centro,
  laco,
  progresso,
  selecionado,
  algumSelecionado,
  stroke,
}: {
  indice: number;
  origem: Ponto;
  alvo: Ponto;
  centro: Ponto;
  laco: EstiloLaco;
  progresso: SharedValue<number>;
  selecionado: boolean;
  algumSelecionado: boolean;
  stroke: string;
}) {
  const foco = useSharedValue(selecionado ? 1 : 0);
  const apagada = useSharedValue(algumSelecionado && !selecionado ? 1 : 0);
  useEffect(() => {
    foco.value = withTiming(selecionado ? 1 : 0, { duration: DURACAO.rapida });
    apagada.value = withTiming(algumSelecionado && !selecionado ? 1 : 0, {
      duration: DURACAO.rapida,
    });
  }, [selecionado, algumSelecionado, foco, apagada]);
  const propsDaLinha = useAnimatedProps(() => {
    const t = andamento(progresso.value, indice);
    return {
      x2: origem.x + (alvo.x - origem.x) * t,
      y2: origem.y + (alvo.y - origem.y) * t,
      strokeWidth: laco.largura + 1.5 * foco.value,
      strokeOpacity: 1 - 0.55 * apagada.value,
    };
  });
  return (
    <LinhaAnimada
      x1={centro.x}
      y1={centro.y}
      x2={alvo.x}
      y2={alvo.y}
      stroke={stroke}
      strokeWidth={laco.largura}
      strokeDasharray={laco.tracejado ? '4 4' : undefined}
      strokeLinecap="round"
      animatedProps={propsDaLinha}
    />
  );
}

/** Avatar e rótulo de um nó: sai do centro com mola e, tocado, ganha anel, escala e rótulo em destaque. */
function NoDoGrafo({
  no,
  indice,
  entrando,
  origem,
  alvo,
  avatar,
  comPercentual,
  progresso,
  selecionado,
  onSelecionar,
  reduceMotion,
}: {
  no: NoDoMapa;
  indice: number;
  /** Nó novo no mapa (primeiro desenho ou entrou pelo filtro): aparece enquanto sai do centro. */
  entrando: boolean;
  origem: Ponto;
  alvo: Ponto;
  avatar: number;
  comPercentual: boolean;
  progresso: SharedValue<number>;
  selecionado: boolean;
  onSelecionar: (personagemId: string) => void;
  reduceMotion: ReturnType<typeof useMovimento>['reduceMotion'];
}) {
  const { cores } = useTema();
  const { personagem, relacao } = no;
  const foco = useSharedValue(selecionado ? 1 : 0);
  useEffect(() => {
    foco.value = withSpring(selecionado ? 1 : 0, MOLA.viva);
  }, [selecionado, foco]);

  const posicao = useAnimatedStyle(() => {
    const t = andamento(progresso.value, indice);
    return {
      opacity: entrando ? Math.min(1, t * 3) : 1,
      transform: [
        { translateX: origem.x + (alvo.x - origem.x) * t - CAIXA_DO_NO / 2 },
        { translateY: origem.y + (alvo.y - origem.y) * t - avatar / 2 },
      ],
    };
  });
  const estiloAvatar = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.14 * foco.value }],
  }));
  const estiloAnel = useAnimatedStyle(() => ({
    opacity: Math.min(1, foco.value),
    transform: [{ scale: 1.25 - 0.25 * Math.min(1, foco.value) }],
  }));
  const estiloBorda = useAnimatedStyle(() => ({ opacity: Math.min(1, foco.value) }));

  return (
    <Animated.View
      pointerEvents="box-none"
      exiting={FadeOut.duration(DURACAO.rapida).reduceMotion(reduceMotion)}
      style={[estilos.no, estilos.noAbsoluto, { width: CAIXA_DO_NO }, posicao]}
    >
      <Pressable
        onPress={() => onSelecionar(personagem.id)}
        accessibilityRole="button"
        accessibilityLabel={`${personagem.nome}, ${relacao.rotulo}, ${relacao.afinidade}%`}
        accessibilityState={{ selected: selecionado }}
        hitSlop={4}
        style={({ pressed }) => [estilos.toque, { opacity: pressed ? 0.75 : 1 }]}
      >
        <View>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              estilos.anel,
              { borderColor: cores.destaque, borderRadius: 999 },
              estiloAnel,
            ]}
          />
          <Animated.View style={estiloAvatar}>
            <Avatar iniciais={personagem.iniciais} tom={personagem.tomAvatar} tamanho={avatar} />
          </Animated.View>
        </View>
        {/* O halo na cor do cartão cobre a linha que passa perto do rótulo. */}
        <Camada cor="superficie" raio={999} style={estilos.halo}>
          <Camada
            cor="superficie"
            raio={999}
            // Borda sempre presente (da cor do fundo quando não selecionado) para não mudar o tamanho.
            borda={{ cor: 'superficie', largura: 1 }}
            style={estilos.rotulo}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                estilos.bordaDestaque,
                { borderColor: cores.destaque, borderRadius: 999 },
                estiloBorda,
              ]}
            />
            <Texto estilo="legenda" numberOfLines={1}>
              {primeiroNome(personagem.nome)}
            </Texto>
            {comPercentual && (
              <Texto
                estilo="legenda"
                cor={relacao.afinidade >= LIMITE_PROXIMO ? 'destaqueTinta' : 'textoSuave'}
              >
                {relacao.afinidade}%
              </Texto>
            )}
          </Camada>
        </Camada>
      </Pressable>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  no: { position: 'absolute', alignItems: 'center' },
  noAbsoluto: { left: 0, top: 0 },
  anel: { borderWidth: 2, margin: -4 },
  bordaDestaque: { position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderWidth: 1 },
  toque: { alignItems: 'center' },
  halo: { marginTop: 2, padding: 2 },
  centrado: { alignItems: 'center' },
  rotulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vazio: { position: 'absolute', left: 16, right: 16 },
  textoVazio: { textAlign: 'center' },
});
