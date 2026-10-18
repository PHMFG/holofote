import type { Consequencia, Conta, EventoAgendado, Post } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Gem, Lock, Radio, Trophy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { tratarErroDeAcao } from '../../acoes/erros';
import { ErroDaApi } from '../../api/cliente';
import { useConsequencia, useConta, useDiscurso, useEvento } from '../../api/consultas';
import { useTempoReal } from '../../api/tempoReal';
import { efeitosDosDeltas, formatarNumero } from '../../formatar';
import { voltarOuInicio } from '../../navegacao';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { Avatar } from '../../ui/Avatar';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { Cabecalho } from '../../ui/Cabecalho';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Rotulo, RotuloSecao } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { CURVA, DURACAO, MOLA, useMovimento } from '../../ui/movimento';
import {
  BarraLivre,
  BrilhoRespirando,
  Confete,
  Halo,
  ItemFluido,
  LINEAR,
  Pop,
  Troca,
  usePulso,
} from '../perfil/efeitos';
import { NumeroContando } from '../perfil/NumeroContando';
import type { OpcaoDiscurso } from './formatar';
import { DISCURSO } from './icones';
import { relogio, useSegundosRestantes } from './relogio';

/** Tempo de escolha do ao vivo (docs/PLANO.md, eventos agendados). */
const PRAZO_SEGUNDOS = 30;
/** Marcos em que o VoiceOver anuncia o tempo; não anuncia a cada segundo. */
const AVISOS = [20, 10, 5];
/** Nos últimos segundos o cronômetro vira urgência visual (sem anúncio a cada segundo). */
const SEGUNDOS_DE_URGENCIA = 10;
/** Suspense entre subir ao palco e abrir o envelope com o vencedor. */
const SUSPENSE_MS = 900;

interface Resultado {
  evento: EventoAgendado;
  consequencia: Consequencia;
  /**
   * Conta antes do discurso. A consequência não traz as gemas do prêmio; a diferença sai quando
   * a conta for relida (o useDiscurso invalida a conta).
   */
  contaAntes: Conta | undefined;
}

/**
 * 17 · Evento ao vivo (Figma 55:1554 claro, 58:2263 escuro), modal em tela cheia: 30 segundos
 * a partir de `prazoAoVivo` para escolher o discurso. O motor sorteia o vencedor e devolve os
 * números na hora; a reação do mundo, escrita pela IA, chega depois pelo tempo real.
 */
export function TelaAoVivo({ id }: { id: string }) {
  const evento = useEvento(id);
  const conta = useConta();
  const discurso = useDiscurso(id);
  const [escolha, setEscolha] = useState<OpcaoDiscurso | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [revelado, setRevelado] = useState(false);
  const [plateia, setPlateia] = useState<Post[]>([]);
  const { reduzido, reduceMotion } = useMovimento();
  const revelarEm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(revelarEm.current), []);

  const e = evento.data;
  const aoVivo = e?.estado === 'ao_vivo' && !resultado;
  const restante = useSegundosRestantes(aoVivo ? (e?.prazoAoVivo ?? null) : null, PRAZO_SEGUNDOS);
  const acabou = restante === 0;
  // Esgotado o tempo, só o seguro continua valendo; uma escolha ousada pendente é desfeita.
  const escolhaValida = acabou && escolha !== 'seguro' ? null : escolha;

  useAvisosDoCronometro(aoVivo ? restante : null);

  // O vencedor só sai do envelope depois do suspense. A vibração e o anúncio do resultado vão
  // junto com a revelação, não com a resposta do servidor.
  const venceuOJogador = resultado?.evento.vencedor?.papel === 'jogador';
  const nomeDoVencedor = resultado?.evento.vencedor?.nome;
  useEffect(() => {
    if (!revelado) return;
    void Haptics.notificationAsync(
      venceuOJogador
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    AccessibilityInfo.announceForAccessibility(
      venceuOJogador ? 'Você venceu.' : `${nomeDoVencedor ?? 'Outra pessoa'} venceu.`,
    );
  }, [revelado, venceuOJogador, nomeDoVencedor]);

  // Depois do discurso, o que chega ao feed é a plateia reagindo.
  useTempoReal((ev) => {
    if (!resultado || ev.tipo !== 'post') return;
    setPlateia((atual) =>
      atual.some((p) => p.id === ev.post.id) ? atual : [ev.post, ...atual].slice(0, 5),
    );
  });

  const cabecalho = (
    <Cabecalho
      navegacao="fechar"
      titulo={e?.titulo ?? 'Ao vivo'}
      direita={e?.estado === 'ao_vivo' || resultado ? <ChipAoVivo /> : undefined}
    />
  );

  if (!e) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {evento.isError ? (
          <EstadoTela
            tipo="erro"
            frase={
              evento.error instanceof ErroDaApi && evento.error.codigo === 'nao_encontrado'
                ? 'Este evento não existe mais.'
                : 'Não deu para entrar ao vivo.'
            }
            acao={{ rotulo: 'Tentar de novo', onPress: () => void evento.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Entrando ao vivo…" />
        )}
      </Tela>
    );
  }

  if (!resultado && (e.estado === 'anunciado' || e.estado === 'campanha')) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        <EstadoTela
          tipo="vazio"
          frase="O evento ainda não começou. A campanha continua aberta."
          acao={{ rotulo: 'Voltar', onPress: voltarOuInicio }}
        />
      </Tela>
    );
  }

  const subir = () => {
    if (!escolhaValida) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const contaAntes = conta.data;
    discurso.mutate(escolhaValida, {
      onSuccess: (r) => {
        setResultado({ ...r, contaAntes });
        clearTimeout(revelarEm.current);
        if (reduzido) setRevelado(true);
        else revelarEm.current = setTimeout(() => setRevelado(true), SUSPENSE_MS);
      },
      onError: tratarErroDeAcao,
    });
  };

  const exibido = resultado?.evento ?? e;
  const verFeed = () => router.dismissTo('/');

  return (
    <Tela
      cabecalho={cabecalho}
      gap={14}
      rodape={
        resultado || e.estado === 'encerrado' ? (
          <BotaoMetal rotulo="Ver o feed" disabled={!!resultado && !revelado} onPress={verFeed} />
        ) : (
          <BotaoMetal
            rotulo="Subir ao palco"
            disabled={!escolhaValida || discurso.isPending}
            onPress={subir}
          />
        )
      }
    >
      <Palco
        evento={exibido}
        consequencia={resultado?.consequencia}
        suspense={!!resultado && !revelado}
      />

      {resultado ? (
        revelado && (
          <ResultadoDoDiscurso
            resultado={resultado}
            contaAgora={conta.data !== resultado.contaAntes ? conta.data : undefined}
            plateia={plateia}
          />
        )
      ) : e.estado === 'encerrado' ? (
        <Aparecer indice={1}>
          <Texto cor="textoSuave" style={estilos.centro}>
            Este evento já acabou.
          </Texto>
        </Aparecer>
      ) : (
        <Animated.View
          exiting={FadeOut.duration(DURACAO.rapida).reduceMotion(reduceMotion)}
          style={estilos.escolha}
        >
          <Aparecer indice={1}>
            <Cronometro restante={restante} />
          </Aparecer>
          {acabou && (
            <Animated.View entering={FadeInDown.duration(DURACAO.media).reduceMotion(reduceMotion)}>
              <Texto estilo="legenda" cor="destaqueTinta" accessibilityRole="alert">
                O tempo acabou, mas o discurso seguro continua disponível.
              </Texto>
            </Animated.View>
          )}
          {e.discurso.map((opcao, i) => {
            const visual = DISCURSO[opcao.id];
            const esgotado = acabou && opcao.id !== 'seguro';
            const liberada = opcao.liberada && !esgotado;
            const motivo = esgotado ? 'O tempo acabou.' : opcao.motivo;
            return (
              <Aparecer key={opcao.id} indice={i + 2}>
                <OpcaoDeDiscurso
                  titulo={opcao.titulo}
                  detalhe={liberada ? visual.descricao : (motivo ?? 'Ainda bloqueado.')}
                  icone={visual}
                  liberada={liberada}
                  selecionada={escolhaValida === opcao.id}
                  realce={acabou && opcao.id === 'seguro'}
                  onPress={
                    liberada && !discurso.isPending
                      ? () => {
                          void Haptics.selectionAsync();
                          setEscolha(opcao.id);
                        }
                      : undefined
                  }
                />
              </Aparecer>
            );
          })}
        </Animated.View>
      )}
    </Tela>
  );
}

/** Anuncia o tempo restante nos marcos de 20, 10 e 5 segundos e quando acaba. */
function useAvisosDoCronometro(restante: number | null) {
  const anunciados = useRef(new Set<number>());
  useEffect(() => {
    if (restante === null || anunciados.current.has(restante)) return;
    if (restante === 0) {
      anunciados.current.add(0);
      AccessibilityInfo.announceForAccessibility(
        'O tempo acabou. O discurso seguro continua disponível.',
      );
      return;
    }
    if (AVISOS.includes(restante)) {
      anunciados.current.add(restante);
      AccessibilityInfo.announceForAccessibility(`Faltam ${restante} segundos para escolher.`);
    }
  }, [restante]);
}

/** Chip AO VIVO pulsando: o evento está acontecendo agora. */
function ChipAoVivo() {
  const pulso = usePulso(true, { ate: 1.07, duracao: 700, opacidade: 0.82 });
  return (
    <Animated.View style={pulso}>
      <Chip rotulo="AO VIVO" variante="destaque" icone={Radio} />
    </Animated.View>
  );
}

/**
 * Barra chapada de 4 e "decida em 0:24" (55:1596 e 55:1600). A barra esvazia de forma contínua
 * (linear, na thread de UI) em vez de dar um salto por segundo. Nos últimos 10 segundos ela
 * pulsa e o tempo dá uma batida a cada segundo, sem o VoiceOver anunciar cada um.
 */
function Cronometro({ restante }: { restante: number | null }) {
  const { reduzido } = useMovimento();
  const progresso = useSharedValue(1);
  const batida = useSharedValue(0);
  const urgente = restante !== null && restante > 0 && restante <= SEGUNDOS_DE_URGENCIA;
  const pulsoDaBarra = usePulso(urgente, { ate: 1, opacidade: 0.5, duracao: 450 });

  // Esvazia da fração atual até zero no tempo que falta; se o prazo se mexer (relido, relógio
  // ajustado), recomeça de onde o relógio manda. Movimento reduzido: um degrau por segundo.
  useEffect(() => {
    if (restante === null) {
      progresso.value = 1;
      return;
    }
    const alvo = restante / PRAZO_SEGUNDOS;
    if (reduzido || restante <= 0) {
      cancelAnimation(progresso);
      progresso.value = alvo;
      return;
    }
    const desvio = Math.abs(progresso.value * PRAZO_SEGUNDOS - restante);
    if (desvio > 1.5 || progresso.value === 1) {
      progresso.value = alvo;
      progresso.value = withTiming(0, { duration: restante * 1000, easing: LINEAR });
    }
  }, [restante, reduzido, progresso]);

  useEffect(() => {
    if (!urgente || reduzido) return;
    batida.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 280, easing: CURVA.saida }),
    );
  }, [restante, urgente, reduzido, batida]);
  const estiloDaBatida = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.16 * batida.value }],
  }));

  const meta =
    restante === null
      ? undefined
      : restante > 0
        ? `decida em ${relogio(restante)}`
        : 'tempo esgotado';
  return (
    <View style={estilos.cronometro}>
      <View style={estilos.cabecaCronometro}>
        <Texto estilo="mini" cor="textoSuave" accessibilityRole="header" style={estilos.encolhe}>
          Escolha seu discurso
        </Texto>
        {meta && (
          <Animated.View style={[estilos.metaCronometro, estiloDaBatida]}>
            <Texto estilo="legenda" cor="destaqueTinta">
              {meta}
            </Texto>
          </Animated.View>
        )}
      </View>
      <BarraLivre
        progresso={progresso}
        altura={4}
        preenchimento="destaque"
        trilho={urgente ? 'destaqueSuave' : 'superficie2'}
        estiloPreenchimento={pulsoDaBarra}
        rotulo={
          restante === null
            ? 'Tempo para escolher'
            : restante > 0
              ? `Tempo para escolher, ${restante} segundos`
              : 'Tempo esgotado'
        }
        valorAcessivel={restante === null ? 100 : (restante / PRAZO_SEGUNDOS) * 100}
      />
    </View>
  );
}

/**
 * Topo do palco (55:1588): categoria antes do discurso; o vencedor depois. Entre os dois há o
 * suspense: um brilho respira no cartão, ondas se abrem em volta do troféu e o nome ainda está no
 * envelope. A revelação faz o avatar saltar com mola e, se o jogador venceu, as partículas
 * explodem.
 */
function Palco({
  evento,
  consequencia,
  suspense,
}: {
  evento: EventoAgendado;
  consequencia: Consequencia | undefined;
  suspense: boolean;
}) {
  const { medidas } = useTema();
  const vencedor = evento.estado === 'encerrado' && !suspense ? evento.vencedor : null;
  const venceu = vencedor?.papel === 'jogador';
  const seguidores = consequencia?.seguidoresGanhos ?? 0;
  const detalhe = vencedor
    ? `${evento.categoria}${seguidores > 0 ? ` · +${formatarNumero(seguidores)} seguidores` : ''}`
    : suspense
      ? evento.categoria
      : 'O vencedor sai depois do seu discurso';
  const pulsoDoTrofeu = usePulso(suspense, { ate: 1.12, duracao: 380 });
  const chaveDoTexto = vencedor ? `vencedor-${vencedor.nome}` : suspense ? 'suspense' : 'antes';
  return (
    <BrilhoRespirando raio={medidas.cartaoRaio} ativo={suspense}>
      <Cartao>
        <View
          style={estilos.palco}
          accessible
          accessibilityLabel={
            vencedor
              ? `O prêmio vai para ${vencedor.nome}. ${detalhe}`
              : suspense
                ? 'Abrindo o envelope com o vencedor.'
                : `Categoria ${evento.categoria}. ${detalhe}`
          }
          accessibilityLiveRegion={suspense ? 'polite' : undefined}
        >
          <View style={estilos.cenaPalco}>
            <Halo ativo={suspense} escala={1.9} duracao={900} />
            <Halo ativo={suspense} escala={1.9} duracao={900} atraso={450} />
            <Halo ativo={!!vencedor} unico escala={2.4} duracao={900} cor="destaqueSuave" />
            <Troca chave={vencedor ? 'avatar' : 'esfera'}>
              {vencedor ? (
                <Pop de={0.25} mola={MOLA.viva}>
                  <Avatar iniciais={vencedor.iniciais} tom={vencedor.tomAvatar} tamanho={56} />
                </Pop>
              ) : (
                <Animated.View style={pulsoDoTrofeu}>
                  <Esfera tom="escuro" tamanho={56}>
                    <Icone icone={Trophy} tamanho={25} cor={corSobreEsfera('escuro')} traco={2} />
                  </Esfera>
                </Animated.View>
              )}
            </Troca>
            <Confete disparar={venceu} raio={110} />
          </View>
          <Troca chave={chaveDoTexto} style={estilos.textosPalco}>
            <Texto estilo="mini" cor="textoSuave">
              {vencedor || suspense ? 'E o prêmio vai para' : 'Categoria'}
            </Texto>
            <Texto estilo="titulo">
              {vencedor ? vencedor.nome : suspense ? 'Abrindo o envelope…' : evento.categoria}
            </Texto>
            <Texto estilo="legenda" cor="destaqueTinta">
              {detalhe}
            </Texto>
          </Troca>
        </View>
      </Cartao>
    </BrilhoRespirando>
  );
}

function OpcaoDeDiscurso(p: {
  titulo: string;
  detalhe: string;
  icone: (typeof DISCURSO)[OpcaoDiscurso];
  liberada: boolean;
  selecionada: boolean;
  realce: boolean;
  onPress?: () => void;
}) {
  const { cores, medidas } = useTema();
  const { reduzido } = useMovimento();
  // A seleção anda com mola: o cartão cresce um pouco, o anel de destaque aparece e o check salta.
  const selecao = useSharedValue(p.selecionada ? 1 : 0);
  useEffect(() => {
    selecao.value = reduzido
      ? withTiming(p.selecionada ? 1 : 0, { duration: DURACAO.rapida })
      : withSpring(p.selecionada ? 1 : 0, MOLA.viva);
  }, [p.selecionada, reduzido, selecao]);
  const pulsoDoRealce = usePulso(p.realce, { ate: 1.025, duracao: 700 });
  const estiloCartao = useAnimatedStyle(() => ({
    transform: reduzido ? [] : [{ scale: 1 + 0.02 * selecao.value }],
  }));
  const estiloAnel = useAnimatedStyle(() => ({ opacity: Math.min(1, selecao.value) }));
  const anelDoRealce = p.realce && !p.selecionada;
  return (
    <Animated.View style={pulsoDoRealce}>
      <Animated.View style={estiloCartao}>
        <Tocavel
          onPress={p.onPress}
          accessibilityRole="radio"
          accessibilityLabel={`Discurso ${p.titulo}, ${p.liberada ? p.detalhe : `bloqueado: ${p.detalhe}`}`}
          accessibilityState={{ checked: p.selecionada, disabled: !p.liberada }}
        >
          <Camada
            cor="superficie"
            sombra="elevacao"
            raio={medidas.cartaoRaio}
            borda={{ cor: 'superficie', largura: 2 }}
            style={estilos.opcao}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                estilos.anelDaOpcao,
                { borderColor: cores.destaque, borderRadius: medidas.cartaoRaio },
                anelDoRealce ? { opacity: 1 } : estiloAnel,
              ]}
            />
            <Esfera tom={p.liberada ? p.icone.tom : 'claro'} tamanho={36}>
              <Icone
                icone={p.liberada ? p.icone.icone : Lock}
                tamanho={16}
                cor={p.liberada ? corSobreEsfera(p.icone.tom) : 'textoSuave'}
              />
            </Esfera>
            <View style={estilos.textosOpcao}>
              <View style={estilos.tituloOpcao}>
                <Texto estilo="corpoForte" cor={p.liberada ? 'texto' : 'textoSuave'}>
                  {p.titulo}
                </Texto>
                {p.realce && <Rotulo texto="Disponível" variante="destaque" />}
              </View>
              <Texto estilo="legenda" cor={p.selecionada ? 'destaqueTinta' : 'textoSuave'}>
                {p.detalhe}
              </Texto>
            </View>
            {p.liberada ? (
              <View style={estilos.marca}>
                <View style={[estilos.marcaVazia, { borderWidth: 2, borderColor: cores.linha }]} />
                {p.selecionada && (
                  <Pop de={0.2} mola={MOLA.viva} style={estilos.marcaCheia}>
                    <View style={[estilos.marca, { backgroundColor: cores.destaque }]}>
                      <Icone icone={Check} tamanho={14} cor="destaqueSobre" traco={2} />
                    </View>
                  </Pop>
                )}
              </View>
            ) : (
              <Icone icone={Lock} tamanho={16} cor="textoSuave" />
            )}
          </Camada>
        </Tocavel>
      </Animated.View>
    </Animated.View>
  );
}

function ResultadoDoDiscurso({
  resultado,
  contaAgora,
  plateia,
}: {
  resultado: Resultado;
  contaAgora: Conta | undefined;
  plateia: Post[];
}) {
  const { cores } = useTema();
  // O cartão da IA e o fim das reações pendentes chegam pelo tempo real na mesma chave.
  const aoVivo = useConsequencia(resultado.consequencia.eventoId);
  const consequencia = aoVivo.data ?? resultado.consequencia;
  const venceu = resultado.evento.vencedor?.papel === 'jogador';

  const nomes = new Map(
    resultado.evento.indicados.map((i) => [i.personagem.id, i.personagem.nome] as const),
  );
  const efeitos = efeitosDosDeltas(consequencia.deltas, nomes, { seguidores: true });
  const deltaGemas = consequencia.deltas.find((d) => d.alvo === 'gemas')?.valor;
  const gemas =
    deltaGemas ??
    (contaAgora && resultado.contaAntes
      ? contaAgora.gemas - resultado.contaAntes.gemas
      : undefined);
  const reagindo = !consequencia.cartao && consequencia.reacoesPendentes > 0;

  return (
    <>
      <Aparecer indice={0}>
        <Cartao style={estilos.resultado} accessibilityLiveRegion="polite">
          <Pop de={0.6} deslocamento={8} mola={MOLA.viva} style={estilos.alinhaInicio}>
            <Texto estilo="secao" accessibilityRole="header">
              {venceu ? 'Você venceu' : 'Não foi dessa vez'}
            </Texto>
          </Pop>
          <Troca chave={gemas !== undefined && gemas > 0 ? 'gemas' : 'sem-gemas'}>
            {gemas !== undefined && gemas > 0 ? (
              <View style={estilos.gemas} accessible accessibilityLabel={`Ganhou ${gemas} gemas`}>
                <Pop de={0.2} atraso={150} mola={MOLA.viva}>
                  <Icone icone={Gem} tamanho={16} cor="destaqueTinta" traco={2} />
                </Pop>
                <NumeroContando
                  estilo="corpoForte"
                  cor="destaqueTinta"
                  texto={`+${gemas} gemas`}
                  atraso={200}
                />
              </View>
            ) : (
              <Texto estilo="legenda" cor="textoSuave">
                {venceu ? 'As gemas estão a caminho da sua conta.' : 'Sem gemas desta vez.'}
              </Texto>
            )}
          </Troca>
          {efeitos.length > 0 && (
            <View style={estilos.efeitos}>
              {efeitos.map((efeito, i) => (
                <Aparecer key={efeito.chave} indice={i} atraso={250}>
                  <Chip
                    rotulo={efeito.texto}
                    variante={efeito.direcao === 'sobe' ? 'suave' : 'afundado'}
                    tamanho="pequeno"
                  />
                </Aparecer>
              ))}
            </View>
          )}
        </Cartao>
      </Aparecer>

      {consequencia.cartao && (
        <Aparecer indice={1} key="cartao-da-ia">
          <Cartao style={estilos.resultado}>
            <Texto estilo="corpoForte">{consequencia.cartao.titulo}</Texto>
            <Texto cor="textoSuave">{consequencia.cartao.texto}</Texto>
          </Cartao>
        </Aparecer>
      )}

      <Aparecer indice={2}>
        <RotuloSecao texto="Plateia" meta="reações em tempo real" corMeta="textoSuave" />
      </Aparecer>
      <Aparecer indice={3}>
        <Cartao variante="afundado" style={estilos.plateia}>
          {plateia.length === 0 ? (
            <Troca chave={reagindo ? 'reagindo' : 'quieta'}>
              <View style={estilos.reagindo} accessibilityLiveRegion="polite">
                {reagindo && (
                  <ActivityIndicator
                    size="small"
                    color={cores.textoSuave}
                    accessibilityLabel="Aguardando as reações"
                  />
                )}
                <Texto estilo="legenda" cor="textoSuave">
                  {reagindo
                    ? 'O mundo está reagindo ao seu discurso…'
                    : 'As reações aparecem no feed.'}
                </Texto>
              </View>
            </Troca>
          ) : (
            plateia.map((post) => (
              <ItemFluido key={post.id} modo="subir">
                <Texto estilo="legenda" cor="textoSuave" numberOfLines={2}>
                  <Texto estilo="legenda">{post.autor.nome}</Texto> {post.texto}
                </Texto>
              </ItemFluido>
            ))
          )}
        </Cartao>
      </Aparecer>
    </>
  );
}

const estilos = StyleSheet.create({
  encolhe: { flex: 1 },
  escolha: { gap: 14 },
  alinhaInicio: { alignSelf: 'flex-start' },
  cronometro: { gap: 8 },
  cabecaCronometro: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  metaCronometro: { transformOrigin: 'right center' },
  cenaPalco: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  anelDaOpcao: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2, borderWidth: 2 },
  marcaVazia: { width: 24, height: 24, borderRadius: 12 },
  marcaCheia: { position: 'absolute', top: 0, left: 0 },
  centro: { textAlign: 'center' },
  palco: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  textosPalco: { flex: 1, gap: 2 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  textosOpcao: { flex: 1, gap: 1 },
  tituloOpcao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marca: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultado: { gap: 8 },
  gemas: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  efeitos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  plateia: { gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
  reagindo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
