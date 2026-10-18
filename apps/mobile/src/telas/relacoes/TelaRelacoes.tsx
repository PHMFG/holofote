import { router } from 'expo-router';
import { ChevronRight, MessageSquare } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useAbrirConversa, useRelacoes } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { Avatar } from '../../ui/Avatar';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cabecalho } from '../../ui/Cabecalho';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Rotulo } from '../../ui/Rotulo';
import { Segmentado, type OpcaoSegmentado } from '../../ui/Segmentado';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { DURACAO, MOLA, useMovimento } from '../../ui/movimento';
import { Troca } from '../perfil/efeitos';
import { primeiroNome } from '../../formatar';
import { separarDia } from '../personagem/memorias';
import { Grafo } from './Grafo';
import {
  LIMITE_PROXIMO,
  estiloDoLaco,
  filtrarNos,
  type FiltroRelacoes,
  type NoDoMapa,
} from './layout';

// Rótulos do Figma (57:1722).
const FILTROS: readonly OpcaoSegmentado<FiltroRelacoes>[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'elenco', rotulo: 'Elenco' },
  { valor: 'rivais', rotulo: 'Rivais' },
];

const VAZIO: Record<FiltroRelacoes, string> = {
  todos: 'Ninguém cruzou seu caminho ainda.',
  elenco: 'O elenco principal ainda não chegou.',
  rivais: 'Nenhum rival por enquanto.',
};

/** 21 · Mapa de relações (Figma 57:1685 claro, 58:2784 escuro). */
export function TelaRelacoes() {
  const relacoes = useRelacoes();
  const [filtro, setFiltro] = useState<FiltroRelacoes>('todos');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const cabecalho = <Cabecalho titulo="Relações" />;
  if (!relacoes.data) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        <EstadoTela
          tipo={relacoes.isError ? 'erro' : 'carregando'}
          frase={relacoes.isError ? 'Não deu para carregar o mapa.' : 'Desenhando o mapa…'}
          acao={
            relacoes.isError
              ? { rotulo: 'Tentar de novo', onPress: () => void relacoes.refetch() }
              : undefined
          }
        />
      </Tela>
    );
  }

  const nos = filtrarNos(relacoes.data.nos, filtro);
  const selecionado = nos.find((n) => n.personagem.id === selecionadoId);

  return (
    <Tela cabecalho={cabecalho} gap={12}>
      <Aparecer indice={0}>
        <Segmentado opcoes={FILTROS} valor={filtro} onMudar={setFiltro} rotulo="Filtrar relações" />
      </Aparecer>
      <Aparecer indice={1} modo="fade">
        <Grafo
          jogador={relacoes.data.jogador}
          nos={nos}
          selecionadoId={selecionado?.personagem.id ?? null}
          onSelecionar={setSelecionadoId}
          vazio={VAZIO[filtro]}
        />
      </Aparecer>
      <Aparecer indice={3}>
        <Legenda />
      </Aparecer>
      {selecionado ? (
        <CartaoSelecionado key={selecionado.personagem.id} no={selecionado} />
      ) : (
        nos.length > 0 && (
          <Troca chave="dica">
            <Cartao>
              <Texto cor="textoSuave" style={estilos.centro}>
                Toque num nome para ver a relação e o que a pessoa lembra de você.
              </Texto>
            </Cartao>
          </Troca>
        )
      )}
    </Tela>
  );
}

const ITENS_LEGENDA: { rotulo: string; afinidade: number }[] = [
  { rotulo: 'Aliança', afinidade: 88 },
  { rotulo: 'Neutra', afinidade: 50 },
  { rotulo: 'Rival', afinidade: 10 },
];

/** Legenda das linhas (Figma 57:1772). */
function Legenda() {
  const { cores } = useTema();
  return (
    <View
      style={estilos.legenda}
      accessible
      accessibilityLabel="Legenda: linha em destaque é aliança, linha cinza é neutra, linha tracejada é rival"
    >
      {ITENS_LEGENDA.map(({ rotulo, afinidade }) => {
        const laco = estiloDoLaco(afinidade);
        return (
          <View key={rotulo} style={estilos.itemLegenda}>
            <Svg width={18} height={4}>
              <Line
                x1={1}
                y1={2}
                x2={17}
                y2={2}
                stroke={cores[laco.cor]}
                strokeWidth={Math.min(3, laco.largura)}
                strokeDasharray={laco.tracejado ? '3 3' : undefined}
                strokeLinecap="round"
              />
            </Svg>
            <Texto estilo="legenda" cor="textoSuave">
              {rotulo}
            </Texto>
          </View>
        );
      })}
    </View>
  );
}

/** Cartão do personagem tocado (Figma 57:1782): relação, memórias, perfil e mensagem. */
function CartaoSelecionado({ no }: { no: NoDoMapa }) {
  const abrirConversa = useAbrirConversa();
  const { reduzido, reduceMotion } = useMovimento();
  const { personagem, relacao, lembra } = no;
  const nome = primeiroNome(personagem.nome);

  const mandarMensagem = () =>
    abrirConversa.mutate(personagem.id, {
      onSuccess: (conversa) => router.push(`/dm/${conversa.id}`),
      onError: tratarErroDeAcao,
    });

  // O cartão sobe de baixo com mola ao tocar num nó; trocar de nó refaz a subida.
  const entrada = reduzido
    ? FadeIn.duration(DURACAO.rapida).reduceMotion(reduceMotion)
    : FadeInDown.springify()
        .damping(MOLA.suave.damping)
        .stiffness(MOLA.suave.stiffness)
        .withInitialValues({ opacity: 0, transform: [{ translateY: 36 }] })
        .reduceMotion(reduceMotion);

  return (
    <Animated.View
      entering={entrada}
      exiting={FadeOut.duration(DURACAO.instante).reduceMotion(reduceMotion)}
    >
      <Cartao style={estilos.selecionado} accessibilityLiveRegion="polite">
        <View style={estilos.cabecalhoSelecionado}>
          <Tocavel
            onPress={() => router.push(`/personagem/${personagem.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Ver perfil de ${personagem.nome}, ${relacao.rotulo}, ${relacao.afinidade}%`}
            style={({ pressed }) => [estilos.perfil, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar iniciais={personagem.iniciais} tom={personagem.tomAvatar} />
            <View style={estilos.textos}>
              <Texto estilo="corpoForte" numberOfLines={1}>
                {personagem.nome}
              </Texto>
              <Texto
                estilo="legenda"
                cor={relacao.afinidade >= LIMITE_PROXIMO ? 'destaqueTinta' : 'textoSuave'}
                numberOfLines={1}
              >
                {relacao.rotulo} · {relacao.afinidade}%
              </Texto>
            </View>
            <Icone icone={ChevronRight} tamanho={16} cor="textoSuave" />
          </Tocavel>
          <BotaoSuave
            icone={MessageSquare}
            rotulo={`Mandar mensagem para ${nome}`}
            disabled={abrirConversa.isPending}
            onPress={mandarMensagem}
          />
        </View>
        <Camada cor="superficie2" sombra="afundado" raio={16} style={estilos.memoria}>
          <Texto estilo="mini" cor="textoSuave" accessibilityRole="header">
            O que {nome} lembra de você
          </Texto>
          {lembra.length === 0 ? (
            <Texto estilo="legenda" cor="textoSuave">
              Ainda não lembra de nada sobre você.
            </Texto>
          ) : (
            lembra.map((fato, i) => {
              const { dia, texto } = separarDia(fato);
              return (
                <View
                  key={`${i}-${fato}`}
                  style={estilos.fato}
                  accessible
                  accessibilityLabel={dia ? `${dia}: ${texto}` : texto}
                >
                  {dia && <Rotulo texto={dia} variante="data" />}
                  <Texto estilo="legenda" style={estilos.textoFato}>
                    {texto}
                  </Texto>
                </View>
              );
            })
          )}
        </Camada>
      </Cartao>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  centro: { textAlign: 'center' },
  legenda: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 4 },
  itemLegenda: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  selecionado: { gap: 12 },
  cabecalhoSelecionado: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perfil: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  textos: { flex: 1, gap: 1 },
  memoria: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  fato: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textoFato: { flex: 1 },
});
