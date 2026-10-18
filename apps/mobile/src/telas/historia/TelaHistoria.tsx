import type { PersonagemResumo } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Ellipsis, MessageSquare, X } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tratarErroDeAcao } from '../../acoes/erros';
import { ErroDaApi } from '../../api/cliente';
import { useConversas, useMundo, useResponderHistoria, useVotar } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Camada } from '../../ui/Camada';
import { Chip } from '../../ui/Chip';
import { CURVA, DURACAO, useMovimento } from '../../ui/movimento';
import { Compositor } from '../../ui/Compositor';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { voltarOuInicio } from '../../navegacao';
import { haQuanto, useAgora } from '../../tempo';
import { primeiroNome } from '../../formatar';
import { useReduzirMovimento } from '../aparencia/ajustes';
import { useAnimacoes } from '../animacao/animacoes';
import { CamadaAnimada } from '../animacao/Animados';
import { EnqueteHistoria } from './EnqueteHistoria';
import { dividirTexto } from './formatar';
import { useArrastarParaFechar } from './useArrastarParaFechar';
import { useHistoria, useSequenciaDeHistorias } from './useHistoria';

/**
 * Última história aberta e a hora em que a tela fechou. Trocar de história (`router.replace`)
 * remonta a tela: a diferença de posição, lida logo ao montar, diz de que lado o palco entra.
 */
let ultimaVista: { posicao: number; quando: number } | null = null;
const JANELA_DA_TROCA_MS = 1500;

/** -1 veio de uma história anterior, 1 de uma seguinte, 0 abriu do feed. */
function direcaoDaTroca(posicao: number): -1 | 0 | 1 {
  if (!ultimaVista || Date.now() - ultimaVista.quando > JANELA_DA_TROCA_MS) return 0;
  return Math.sign(posicao - ultimaVista.posicao) as -1 | 0 | 1;
}

/**
 * 15 · História (Figma 54:1460 claro, 58:2027 escuro), em modal de tela cheia: segmentos de
 * progresso, autor, o texto em adesivo, a enquete e a resposta que vira mensagem direta.
 * Fecha pelo X, arrastando para baixo (o conteúdo acompanha o dedo) ou com o gesto de escape do
 * VoiceOver. Ao trocar de história, o palco desliza do lado de onde o jogador vem.
 */
export function TelaHistoria({ id }: { id: string }) {
  const insets = useSafeAreaInsets();
  const historia = useHistoria(id);
  const sequencia = useSequenciaDeHistorias(id);
  const mundo = useMundo();
  const votar = useVotar(id);
  const responder = useResponderHistoria(id);
  const agora = useAgora();
  const reduzir = useReduzirMovimento();
  const animacoes = useAnimacoes();
  const { estilo: estiloDoArrasto, arrastar } = useArrastarParaFechar(voltarOuInicio, reduzir);
  const [enviada, setEnviada] = useState<{ conversaId: string } | null>(null);
  const [direcao] = useState(() => direcaoDaTroca(sequencia.posicao));

  const posicaoNaFileira = sequencia.posicao;
  useEffect(
    () => () => {
      ultimaVista = { posicao: posicaoNaFileira, quando: Date.now() };
    },
    [posicaoNaFileira],
  );

  const dados = historia.data;
  const expirada =
    (historia.error instanceof ErroDaApi && historia.error.codigo === 'nao_encontrado') ||
    (!!dados?.expiraEm && Date.parse(dados.expiraEm) <= agora);

  const fundo = (conteudo: ReactNode) => (
    <Camada gradiente="capa" style={estilos.flex}>
      <Animated.View
        {...arrastar}
        onAccessibilityEscape={voltarOuInicio}
        style={[estilos.flex, { paddingTop: insets.top }, estiloDoArrasto]}
      >
        {conteudo}
      </Animated.View>
    </Camada>
  );

  if (!dados || expirada) {
    return fundo(
      <>
        <View style={[estilos.cabecalho, estilos.soFechar]}>
          <BotaoSuave icone={X} rotulo="Fechar" onPress={voltarOuInicio} />
        </View>
        <View style={estilos.estado}>
          {expirada ? (
            <EstadoTela
              tipo="vazio"
              frase="Esta história expirou."
              acao={{ rotulo: 'Fechar', onPress: voltarOuInicio }}
            />
          ) : historia.isError ? (
            <EstadoTela
              tipo="erro"
              frase="Não deu para abrir a história."
              acao={{ rotulo: 'Tentar de novo', onPress: () => void historia.refetch() }}
            />
          ) : (
            <EstadoTela tipo="carregando" frase="Abrindo a história…" />
          )}
        </View>
      </>,
    );
  }

  const { autor } = dados;
  const nome = primeiroNome(autor.nome);
  const posicao = sequencia.total > 1 ? ` · ${sequencia.posicao + 1} de ${sequencia.total}` : '';
  const texto = dividirTexto(dados.texto);
  // Do feed, o palco sobe; entre histórias, entra do lado de onde o jogador vem.
  const entradaDoPalco = (atraso: number) =>
    direcao === 0
      ? animacoes.entrada(0, atraso)
      : animacoes.doLado(direcao > 0 ? 'direita' : 'esquerda', atraso);

  const aoVotar = (opcao: string) =>
    votar.mutate(opcao, {
      onSuccess: () => void Haptics.selectionAsync(),
      onError: tratarErroDeAcao,
    });

  // Devolve a Promise: o Compositor só limpa o texto quando ela resolve (em sem_energia,
  // moderação ou rede, o jogador não perde o que escreveu).
  const aoResponder = (resposta: string) =>
    responder.mutateAsync(resposta).then(
      ({ mensagem }) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setEnviada({ conversaId: mensagem.conversaId });
        AccessibilityInfo.announceForAccessibility(
          `Resposta enviada. Ela está nas mensagens com ${nome}.`,
        );
      },
      (erro: unknown) => {
        tratarErroDeAcao(erro);
        throw erro;
      },
    );

  return (
    <KeyboardAvoidingView behavior="padding" style={estilos.flex}>
      {fundo(
        <>
          <Segmentos total={sequencia.total} posicao={sequencia.posicao} />
          <Animated.View entering={animacoes.fade(60)} style={estilos.cabecalho}>
            <Avatar
              iniciais={autor.iniciais}
              tom={autor.tomAvatar}
              tamanho={36}
              nome={autor.nome}
            />
            <View
              style={estilos.autor}
              accessible
              accessibilityRole="header"
              accessibilityLabel={`História de ${autor.nome}, ${haQuanto(dados.criadoEm, agora)}${posicao.replace(' · ', ', ')}`}
            >
              <Texto estilo="corpoForte" numberOfLines={1}>
                {autor.nome}
              </Texto>
              <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
                {haQuanto(dados.criadoEm, agora)}
                {posicao}
              </Texto>
            </View>
            <BotaoSuave
              icone={Ellipsis}
              rotulo={`Ver perfil de ${autor.nome}`}
              onPress={() => router.push(`/personagem/${autor.id}`)}
            />
            <BotaoSuave icone={X} rotulo="Fechar" onPress={voltarOuInicio} />
          </Animated.View>

          <View style={estilos.flex}>
            <ScrollView
              alwaysBounceVertical={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={estilos.palco}
            >
              <Animated.View entering={entradaDoPalco(80)} style={estilos.itemDoPalco}>
                <Adesivo titulo={texto.titulo} resto={texto.resto} />
              </Animated.View>
              {dados.enquete && (
                <Animated.View
                  entering={entradaDoPalco(220)}
                  style={[estilos.itemDoPalco, estilos.enquete]}
                >
                  <EnqueteHistoria
                    enquete={dados.enquete}
                    votando={votar.isPending}
                    onVotar={aoVotar}
                  />
                </Animated.View>
              )}
            </ScrollView>
            {sequencia.anterior && (
              <BordaDeNavegacao
                lado="esquerda"
                onPress={() => router.replace(`/historia/${sequencia.anterior}`)}
              />
            )}
            {sequencia.proxima && (
              <BordaDeNavegacao
                lado="direita"
                onPress={() => router.replace(`/historia/${sequencia.proxima}`)}
              />
            )}
          </View>

          <View style={[estilos.rodape, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {enviada && <AvisoEnviada autor={autor} conversaId={enviada.conversaId} />}
            <Compositor
              iniciais={mundo.data?.jogador.iniciais ?? ''}
              placeholder={`Responder a ${nome}…`}
              custo={1}
              enviando={responder.isPending}
              onEnviar={aoResponder}
            />
          </View>
        </>,
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * Segmentos do topo (54:1478): vistas em texto, a atual em destaque, as próximas só no trilho.
 * A história atual enche o segmento ao abrir, o que dá o sentido de "chegou aqui" a cada troca.
 */
function Segmentos({ total, posicao }: { total: number; posicao: number }) {
  return (
    <View
      style={estilos.segmentos}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`História ${posicao + 1} de ${total}`}
      accessibilityValue={{ min: 1, max: total, now: posicao + 1 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <Segmento key={i} estado={i < posicao ? 'vista' : i === posicao ? 'atual' : 'proxima'} />
      ))}
    </View>
  );
}

function Segmento({ estado }: { estado: 'vista' | 'atual' | 'proxima' }) {
  const { cores } = useTema();
  const { reduzido, reduceMotion } = useMovimento();
  // As vistas já nascem cheias; a atual enche depois de um instante; as próximas ficam vazias.
  const cheio = useSharedValue(estado === 'vista' ? 1 : 0);

  useEffect(() => {
    const alvo = estado === 'proxima' ? 0 : 1;
    cheio.value = withDelay(
      estado === 'atual' && !reduzido ? 160 : 0,
      withTiming(alvo, { duration: DURACAO.lenta, easing: CURVA.saida, reduceMotion }),
    );
  }, [estado, reduzido, reduceMotion, cheio]);

  const preenchimento = useAnimatedStyle(() => ({ width: `${cheio.value * 100}%` }));

  return (
    <View style={[estilos.segmento, { backgroundColor: cores.linha }]}>
      <Animated.View
        style={[
          estilos.preenchido,
          { backgroundColor: estado === 'vista' ? cores.texto : cores.destaque },
          preenchimento,
        ]}
      />
    </View>
  );
}

/** O texto da história num cartão inclinado, como um adesivo (54:1502). */
function Adesivo({ titulo, resto }: { titulo: string; resto: string | null }) {
  const { medidas } = useTema();
  return (
    <Camada
      cor="superficie"
      sombra="elevacao"
      raio={medidas.cartaoRaio}
      accessible
      accessibilityLabel={resto ? `${titulo} ${resto}` : titulo}
      style={estilos.adesivo}
    >
      <Texto estilo="titulo">{titulo}</Texto>
      {resto && <Texto cor="textoSuave">{resto}</Texto>}
    </Camada>
  );
}

/** Toque nas bordas do palco leva à história anterior ou à próxima da fileira do feed. */
function BordaDeNavegacao({
  lado,
  onPress,
}: {
  lado: 'esquerda' | 'direita';
  onPress: () => void;
}) {
  const esquerda = lado === 'esquerda';
  return (
    <Tocavel
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={esquerda ? 'História anterior' : 'Próxima história'}
      style={[estilos.borda, esquerda ? { left: 0 } : { right: 0 }]}
    >
      <Icone icone={esquerda ? ChevronLeft : ChevronRight} tamanho={18} cor="textoSuave" />
    </Tocavel>
  );
}

/** Aviso depois de responder: a resposta virou mensagem direta, com atalho para a conversa. */
function AvisoEnviada({ autor, conversaId }: { autor: PersonagemResumo; conversaId: string }) {
  const animacoes = useAnimacoes();
  const conversas = useConversas();
  const conversa =
    conversas.data?.find((c) => c.id === conversaId) ??
    conversas.data?.find((c) => c.personagem.id === autor.id);
  return (
    <CamadaAnimada
      cor="superficie"
      sombra="elevacao"
      raio={20}
      entering={animacoes.deSubida()}
      exiting={animacoes.saida}
      style={estilos.aviso}
    >
      <Icone icone={MessageSquare} tamanho={18} cor="destaqueTinta" />
      <Texto estilo="legenda" cor="textoSuave" style={estilos.flex}>
        Enviada para as mensagens com {primeiroNome(autor.nome)}.
      </Texto>
      <Chip
        rotulo="Abrir conversa"
        variante="suave"
        tamanho="pequeno"
        onPress={() => router.push(`/dm/${conversa?.id ?? conversaId}`)}
      />
    </CamadaAnimada>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  segmentos: { flexDirection: 'row', gap: 4, paddingTop: 4, paddingHorizontal: 12 },
  segmento: { flex: 1, height: 3, borderRadius: 1.5, overflow: 'hidden' },
  preenchido: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 1.5 },
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  soFechar: { justifyContent: 'flex-end' },
  autor: { flex: 1 },
  itemDoPalco: { alignSelf: 'stretch' },
  enquete: { alignItems: 'center' },
  estado: { flex: 1, paddingHorizontal: 16 },
  palco: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 28,
    paddingVertical: 8,
  },
  adesivo: {
    alignSelf: 'stretch',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 18,
    transform: [{ rotate: '-3deg' }],
  },
  borda: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rodape: { gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
});
