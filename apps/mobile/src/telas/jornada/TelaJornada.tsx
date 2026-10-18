import type { Jornada, Marco } from '@holofote/shared';
import { router } from 'expo-router';
import { Book, Calendar, ChevronRight, Gift, Newspaper, PenLine, Zap } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { useConta, useEnergia, useJornada, useMundo } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { CURVA, atrasoDaCascata, useMovimento } from '../../ui/movimento';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import {
  detalheDoEvento,
  itensDaRecompensa,
  marcoAtual,
  marcoParaResgatar,
  ordenarMarcos,
  progressoDoMarco,
  proporcao,
  textoRequisito,
  tituloDoEvento,
} from './jornada';
import {
  BarraAnimada,
  BrilhoRespirando,
  Halo,
  ItemFluido,
  Pop,
  Reluzir,
  usePulso,
} from '../perfil/efeitos';
import { NumeroContando } from '../perfil/NumeroContando';
import { TrilhaMarcos } from './TrilhaMarcos';

const abrirMarco = (marco: Marco) => router.push(`/marco/${marco.id}`);

/** 06 · Jornada (Figma 20:273 claro, 30:1221 escuro). */
export function TelaJornada() {
  const jornada = useJornada();

  if (!jornada.data) {
    return (
      <Tela comAbas rolavel={false}>
        <EstadoTela
          tipo={jornada.isError ? 'erro' : 'carregando'}
          frase={jornada.isError ? 'Não deu para carregar a jornada.' : 'Carregando a jornada…'}
          acao={
            jornada.isError
              ? { rotulo: 'Tentar de novo', onPress: () => void jornada.refetch() }
              : undefined
          }
        />
      </Tela>
    );
  }
  // Ato novo = tela nova: a trilha se desenha de novo, as barras enchem e tudo entra em cascata.
  return <Conteudo key={jornada.data.ato} jornada={jornada.data} />;
}

function Conteudo({ jornada }: { jornada: Jornada }) {
  const mundo = useMundo();
  const marcos = ordenarMarcos(jornada.marcos);
  const atual = marcoAtual(marcos);
  const pendente = marcoParaResgatar(marcos);
  const total = marcos.length;
  const progressoAto = Math.round(jornada.progressoAto * 100);

  return (
    <Tela
      comAbas
      gap={12}
      cabecalho={
        <Aparecer modo="fade">
          <View style={estilos.topo}>
            <View style={estilos.nivel}>
              <Pop de={0.7} deslocamento={-6} atraso={60}>
                <Texto estilo="titulo" accessibilityRole="header">
                  Ato {jornada.ato}
                </Texto>
              </Pop>
              {total > 0 && (
                <>
                  <View style={estilos.barraTopo}>
                    <BarraAnimada
                      valor={progressoDoMarco(atual)}
                      rotulo={atual ? `Progresso do marco ${atual.ordem}` : 'Marcos do ato'}
                      atraso={300}
                    />
                  </View>
                  <Texto
                    estilo="legenda"
                    cor="textoSuave"
                    numberOfLines={1}
                    style={estilos.encolhe}
                  >
                    {atual ? `Marco ${atual.ordem} de ${total}` : `${total} de ${total} marcos`}
                  </Texto>
                </>
              )}
            </View>
            <BotaoSuave
              icone={Book}
              rotulo="Registro de atividades"
              variante="elevado"
              onPress={() => router.push('/registro')}
            />
          </View>
        </Aparecer>
      }
    >
      {pendente && (
        <ItemFluido indice={0}>
          <CartaoLiberado marco={pendente} />
        </ItemFluido>
      )}

      <Aparecer indice={1}>
        <Cartao style={estilos.cartao}>
          <Texto estilo="mini" cor="textoSuave">
            Objetivo principal
          </Texto>
          <Texto estilo="titulo">{jornada.objetivo || 'Seu objetivo está sendo escrito.'}</Texto>
          <View style={estilos.progressoAto}>
            <View style={estilos.encolhe}>
              <BarraAnimada valor={jornada.progressoAto} rotulo="Objetivo do ato" atraso={400} />
            </View>
            <NumeroContando estilo="corpoForte" texto={`${progressoAto}%`} atraso={400} />
          </View>
        </Cartao>
      </Aparecer>

      <Aparecer indice={2} style={estilos.secao}>
        <Texto estilo="secao" accessibilityRole="header" style={estilos.tituloSecao}>
          Marcos
        </Texto>
        {total > 0 ? (
          <TrilhaMarcos marcos={marcos} onAbrir={abrirMarco} />
        ) : (
          <Texto cor="textoSuave" style={estilos.tituloSecao}>
            Os marcos deste ato ainda estão sendo escritos.
          </Texto>
        )}
      </Aparecer>

      {atual ? (
        <ItemFluido indice={3}>
          <CartaoMarco marco={atual} />
        </ItemFluido>
      ) : jornada.proximoAto ? (
        <ItemFluido indice={3}>
          <CartaoProximoAto ato={jornada.proximoAto.ato} />
        </ItemFluido>
      ) : (
        total > 0 && (
          <ItemFluido indice={3}>
            <Cartao style={estilos.cartao}>
              <Texto estilo="mini" cor="destaqueTinta">
                Ato concluído
              </Texto>
              <Texto cor="textoSuave">Todos os marcos deste ato foram liberados.</Texto>
            </Cartao>
          </ItemFluido>
        )
      )}

      <Aparecer indice={4} style={[estilos.linhaEntre, estilos.tituloSecao]}>
        <Texto estilo="secao" accessibilityRole="header">
          Agenda
        </Texto>
        <Chip
          rotulo="Resumo do dia"
          icone={Newspaper}
          sobreFundo
          onPress={() => router.push('/resumo-do-dia')}
        />
      </Aparecer>
      {jornada.proximoEvento ? (
        <Aparecer indice={5}>
          <CartaoEvento evento={jornada.proximoEvento} diaDoMundo={mundo.data?.dia} />
        </Aparecer>
      ) : (
        <Aparecer indice={5}>
          <Texto cor="textoSuave" style={estilos.tituloSecao}>
            Nenhum evento agendado por enquanto.
          </Texto>
        </Aparecer>
      )}

      <Aparecer indice={6}>
        <CartaoEnergia />
      </Aparecer>
    </Tela>
  );
}

/**
 * Marco liberado esperando o resgate (Figma 20:310 em diante): um brilho do destaque respira
 * ao redor do cartão e uma faixa de luz passa pelo botão, chamando para resgatar.
 */
function CartaoLiberado({ marco }: { marco: Marco }) {
  const { medidas } = useTema();
  return (
    <BrilhoRespirando raio={medidas.cartaoRaio}>
      <Cartao style={estilos.cartao}>
        <Texto estilo="mini" cor="destaqueTinta">
          Marco liberado
        </Texto>
        <Texto estilo="secao">{marco.titulo}</Texto>
        <Texto estilo="legenda" cor="textoSuave">
          Suas recompensas estão esperando por você.
        </Texto>
        <View style={estilos.acao}>
          <Reluzir raio={medidas.botaoMetalAltura / 2}>
            <BotaoMetal rotulo="Resgatar" onPress={() => abrirMarco(marco)} />
          </Reluzir>
        </View>
      </Cartao>
    </BrilhoRespirando>
  );
}

/** Próximo marco com os requisitos e a recompensa (Figma 20:328). */
function CartaoMarco({ marco }: { marco: Marco }) {
  const recompensa = itensDaRecompensa(marco.recompensa);
  return (
    <Cartao style={estilos.cartao}>
      <View style={estilos.cabecalhoMarco}>
        <Texto estilo="mini" cor="destaqueTinta">
          Próximo marco
        </Texto>
        <Texto estilo="secao">{marco.titulo}</Texto>
        {marco.descricao ? (
          <Texto estilo="legenda" cor="textoSuave">
            {marco.descricao}
          </Texto>
        ) : null}
      </View>
      {marco.requisitos.map((r, i) => (
        <Aparecer key={r.chave} indice={i} atraso={200} style={estilos.requisito}>
          <View
            style={estilos.linhaEntre}
            accessible
            accessibilityLabel={`${r.rotulo}, ${textoRequisito(r)}`}
          >
            <Texto style={estilos.encolhe}>{r.rotulo}</Texto>
            <NumeroContando
              estilo="legenda"
              cor="textoSuave"
              texto={textoRequisito(r)}
              atraso={atrasoDaCascata(i) + 400}
            />
          </View>
          <BarraAnimada
            valor={proporcao(r)}
            altura={6}
            rotulo={r.rotulo}
            atraso={atrasoDaCascata(i) + 450}
          />
        </Aparecer>
      ))}
      {recompensa.length > 0 && (
        <Aparecer indice={marco.requisitos.length} atraso={200}>
          <View
            style={estilos.recompensa}
            accessible
            accessibilityLabel={`Recompensa: ${recompensa.join(', ')}`}
          >
            <Pop de={0.3} atraso={600}>
              <Icone icone={Gift} tamanho={14} cor="textoSuave" traco={2} />
            </Pop>
            <Texto estilo="legenda" cor="textoSuave" style={estilos.encolhe}>
              Recompensa: {recompensa.join(' · ')}
            </Texto>
          </View>
        </Aparecer>
      )}
    </Cartao>
  );
}

/** Ato terminado e resgatado: a IA escreve o próximo; o evento `mundo` traz a jornada nova. */
function CartaoProximoAto({ ato }: { ato: number }) {
  return (
    <Cartao style={estilos.cartaoAto} accessibilityLiveRegion="polite">
      <EsperaDoAto />
      <Texto estilo="secao" style={estilos.centralizado}>
        O próximo ato está sendo escrito
      </Texto>
      <Texto estilo="legenda" cor="textoSuave" style={estilos.centralizado}>
        {`O Ato ${ato} chega em instantes. Você receberá um aviso quando ele começar.`}
      </Texto>
    </Cartao>
  );
}

/**
 * Espera do próximo ato: a pena escreve numa esfera que respira, com ondas se abrindo por trás.
 * Movimento reduzido: a esfera parada com a pena.
 */
function EsperaDoAto() {
  const { reduzido } = useMovimento();
  const respiro = usePulso(true, { ate: 1.08, duracao: 1500 });
  const escrita = useSharedValue(0);
  useEffect(() => {
    if (reduzido) {
      escrita.value = 0;
      return;
    }
    escrita.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: CURVA.entradaSaida }),
        withTiming(-1, { duration: 1100, easing: CURVA.entradaSaida }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(escrita);
  }, [reduzido, escrita]);
  const pena = useAnimatedStyle(() => ({
    transform: [
      { translateX: escrita.value * 3 },
      { translateY: -Math.abs(escrita.value) * 1.5 },
      { rotate: `${escrita.value * 8}deg` },
    ],
  }));
  return (
    <View
      style={estilos.espera}
      accessible
      accessibilityLabel="Carregando"
      importantForAccessibility="yes"
    >
      <Halo atraso={0} escala={1.9} duracao={2400} />
      <Halo atraso={1200} escala={1.9} duracao={2400} />
      <Animated.View style={respiro}>
        <Esfera tom="escuro" tamanho={44}>
          <Animated.View style={pena}>
            <Icone icone={PenLine} tamanho={20} cor={corSobreEsfera('escuro')} traco={2} />
          </Animated.View>
        </Esfera>
      </Animated.View>
    </View>
  );
}

function CartaoEvento({
  evento,
  diaDoMundo,
}: {
  evento: NonNullable<Jornada['proximoEvento']>;
  diaDoMundo: number | undefined;
}) {
  const titulo = tituloDoEvento(evento, diaDoMundo);
  const detalhe = detalheDoEvento(evento);
  return (
    <Tocavel
      onPress={() => router.push(`/evento/${evento.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${detalhe}`}
    >
      <Cartao style={estilos.linhaCartao}>
        <Esfera tom="escuro" tamanho={44}>
          <Icone icone={Calendar} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <View style={estilos.textos}>
          <Texto estilo="corpoForte" numberOfLines={1}>
            {titulo}
          </Texto>
          <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
            {detalhe}
          </Texto>
        </View>
        <Icone icone={ChevronRight} tamanho={16} cor="textoSuave" />
      </Cartao>
    </Tocavel>
  );
}

/** Resumo da energia (Figma 20:354); abre a folha 19 com as formas de recarregar. */
function CartaoEnergia() {
  const energia = useEnergia();
  const conta = useConta();
  const estado = energia.data ?? conta.data?.energia;
  if (!estado) return null;
  const titulo = `Energia ${estado.atual} de ${estado.max}`;
  const detalhe = `Postar e responder custam 1; desfazer custa ${CUSTO_DESFAZER}. Recarrega 1 a cada ${estado.regras.recargaMin} min.`;
  return (
    <Tocavel
      onPress={() => router.push('/sem-energia')}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${detalhe}`}
    >
      <Cartao style={estilos.linhaCartao}>
        <Esfera tom="escuro" tamanho={40}>
          <Icone icone={Zap} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <View style={estilos.textos}>
          <Texto estilo="corpoForte">{titulo}</Texto>
          <Texto estilo="legenda" cor="textoSuave">
            {detalhe}
          </Texto>
        </View>
        <Icone icone={ChevronRight} tamanho={16} cor="textoSuave" />
      </Cartao>
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nivel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  barraTopo: { width: 96 },
  encolhe: { flex: 1 },
  cartao: { gap: 8 },
  cartaoAto: { alignItems: 'center', gap: 8 },
  espera: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  centralizado: { textAlign: 'center' },
  acao: { paddingTop: 4 },
  progressoAto: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  secao: { gap: 10, paddingTop: 4 },
  tituloSecao: { paddingHorizontal: 4 },
  cabecalhoMarco: { gap: 3 },
  requisito: { gap: 6 },
  linhaEntre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recompensa: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  linhaCartao: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textos: { flex: 1, gap: 1 },
});
