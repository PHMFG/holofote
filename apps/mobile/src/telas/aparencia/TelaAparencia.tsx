import { NOMES_DESTAQUE, destaques, type NomeDestaque } from '@holofote/tokens';
import { Check, Monitor, Moon, Sun } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useMundo, useSalvarAparencia } from '../../api/consultas';
import { useAparencia, type PreferenciaTema } from '../../estado/aparencia';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { Avatar } from '../../ui/Avatar';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { Cabecalho } from '../../ui/Cabecalho';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Icone } from '../../ui/Icone';
import { Interruptor } from '../../ui/Interruptor';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { RotuloSecao } from '../../ui/Rotulo';
import { Segmentado } from '../../ui/Segmentado';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { DURACAO, ESCALA_TOQUE, MOLA, useMovimento } from '../../ui/movimento';
import { BarraAnimada, Pop, Troca } from '../perfil/efeitos';
import { useAjustes, useReduzirMovimentoDoSistema } from './ajustes';

export const NOME_DESTAQUE: Record<NomeDestaque, string> = {
  laranja: 'Laranja',
  cobalto: 'Cobalto',
  violeta: 'Violeta',
  rosa: 'Rosa',
  menta: 'Menta',
  lima: 'Lima',
};

const NOME_TEMA: Record<PreferenciaTema, string> = {
  claro: 'claro',
  escuro: 'escuro',
  sistema: 'do sistema',
};

/**
 * 10 · Aparência (Figma 28:429 claro, 31:1172 escuro): tema e cor de destaque mudam na hora
 * (estado local em MMKV) e são salvos na conta; a prévia mostra onde o destaque aparece.
 */
export function TelaAparencia() {
  const { tema, destaque, definirTema, definirDestaque } = useAparencia();
  const salvar = useSalvarAparencia();
  const [naoSalvou, setNaoSalvou] = useState(false);

  // A mudança vale na hora; a conta guarda para o próximo aparelho. Sem rede, fica só aqui.
  const salvarNaConta = () => {
    const atual = useAparencia.getState();
    salvar.mutate(
      { tema: atual.tema, destaque: atual.destaque },
      { onSuccess: () => setNaoSalvou(false), onError: () => setNaoSalvou(true) },
    );
  };

  return (
    <Tela cabecalho={<Cabecalho titulo="Aparência" />} gap={14}>
      <Grupo titulo="Prévia" indice={0}>
        {/* Cada troca de tema ou de cor faz a prévia anterior se dissolver na nova. */}
        <Troca chave={`${tema}-${destaque}`}>
          <Previa destaque={destaque} tema={tema} />
        </Troca>
      </Grupo>

      <Grupo titulo="Tema" indice={1}>
        <Segmentado<PreferenciaTema>
          rotulo="Tema"
          valor={tema}
          onMudar={(novo) => {
            definirTema(novo);
            salvarNaConta();
          }}
          opcoes={[
            { valor: 'claro', rotulo: 'Claro', icone: Sun },
            { valor: 'escuro', rotulo: 'Escuro', icone: Moon },
            { valor: 'sistema', rotulo: 'Sistema', icone: Monitor },
          ]}
        />
      </Grupo>

      <Grupo titulo="Cor de destaque" indice={2}>
        <Cartao style={estilos.cores}>
          <View
            style={estilos.amostras}
            accessibilityRole="radiogroup"
            accessibilityLabel="Cor de destaque"
          >
            {NOMES_DESTAQUE.map((nome) => (
              <Amostra
                key={nome}
                nome={nome}
                escolhida={nome === destaque}
                onPress={() => {
                  definirDestaque(nome);
                  salvarNaConta();
                }}
              />
            ))}
          </View>
          <Texto estilo="legenda" cor="textoSuave">
            Vale para barras, links, novidades e o brilho do botão principal. A interface continua
            em cinza.
          </Texto>
          {naoSalvou && (
            <Texto estilo="legenda" cor="destaqueTinta" accessibilityRole="alert">
              Salvo só neste aparelho por enquanto. A conta atualiza na próxima mudança.
            </Texto>
          )}
        </Cartao>
      </Grupo>

      <Grupo titulo="Ajustes" indice={3}>
        <Ajustes />
      </Grupo>
    </Tela>
  );
}

function Grupo({
  titulo,
  indice,
  children,
}: {
  titulo: string;
  indice: number;
  children: ReactNode;
}) {
  return (
    <Aparecer indice={indice} style={estilos.grupo}>
      <RotuloSecao texto={titulo} />
      {children}
    </Aparecer>
  );
}

/**
 * Prévia do Figma (28:452) com um botão principal pequeno: destaque-suave no chip, barra em
 * destaque-gráfico, ponto e link em destaque e o brilho do botão metálico. É só ilustração:
 * o VoiceOver lê um resumo e o toque não passa para os elementos.
 */
function Previa({ destaque, tema }: { destaque: NomeDestaque; tema: PreferenciaTema }) {
  const { cores } = useTema();
  const mundo = useMundo();
  const jogador = mundo.data?.jogador;
  return (
    <Cartao
      style={estilos.previa}
      accessible
      accessibilityLabel={`Prévia do destaque ${NOME_DESTAQUE[destaque]} no tema ${NOME_TEMA[tema]}: barra de progresso, chip, link e botão principal.`}
    >
      <View pointerEvents="none" style={estilos.previaConteudo}>
        <View style={estilos.linha}>
          <Avatar iniciais={jogador?.iniciais ?? 'EU'} tom="escuro" nome={jogador?.nome} />
          <View style={estilos.flex}>
            <Texto estilo="corpoForte" numberOfLines={1}>
              {jogador?.nome ?? 'Você'}
            </Texto>
            <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
              Texto de exemplo
            </Texto>
          </View>
          <Chip rotulo="Chip de exemplo" variante="suave" tamanho="pequeno" />
        </View>
        <BarraAnimada valor={0.62} rotulo="Barra de exemplo" atraso={150} />
        <View style={estilos.linha}>
          <View style={[estilos.ponto, { backgroundColor: cores.destaque }]} />
          <Texto estilo="legenda" cor="textoSuave" style={estilos.flex}>
            Item de exemplo
          </Texto>
          <Texto estilo="legenda" cor="destaqueTinta">
            Ver detalhes
          </Texto>
        </View>
        <BotaoMetal rotulo="Botão principal" style={estilos.botao} />
      </View>
    </Cartao>
  );
}

/**
 * Bolinha de cor no anel (28:500): a escolhida ganha o anel em texto e o check. Escolher dá um
 * pop (a bolinha afunda e volta com mola), o anel se fecha em volta dela e o check salta; o
 * toque afunda a bolinha enquanto o dedo está em cima.
 */
function Amostra(p: { nome: NomeDestaque; escolhida: boolean; onPress: () => void }) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const anelVisivel = useSharedValue(p.escolhida ? 1 : 0);
  const pop = useSharedValue(0);
  const toque = useSharedValue(0);
  const primeira = useRef(true);
  useEffect(() => {
    if (reduzido) {
      anelVisivel.value = withTiming(p.escolhida ? 1 : 0, { duration: DURACAO.rapida });
      return;
    }
    anelVisivel.value = withSpring(p.escolhida ? 1 : 0, MOLA.viva);
    if (p.escolhida && !primeira.current) {
      pop.value = withSequence(withTiming(-0.16, { duration: 90 }), withSpring(0, MOLA.viva));
    }
    primeira.current = false;
  }, [p.escolhida, reduzido, anelVisivel, pop]);
  const estiloAnel = useAnimatedStyle(() => ({
    opacity: Math.min(1, anelVisivel.value),
    transform: [{ scale: 1.2 - 0.2 * Math.min(1.2, anelVisivel.value) }],
  }));
  const estiloBola = useAnimatedStyle(() => ({
    transform: reduzido ? [] : [{ scale: 1 + pop.value - (1 - ESCALA_TOQUE) * toque.value }],
  }));
  return (
    <Pressable
      onPress={p.onPress}
      onPressIn={() => {
        toque.value = withTiming(1, { duration: DURACAO.instante });
      }}
      onPressOut={() => {
        toque.value = withSpring(0, MOLA.firme);
      }}
      accessibilityRole="radio"
      accessibilityLabel={NOME_DESTAQUE[p.nome]}
      accessibilityState={{ checked: p.escolhida }}
      hitSlop={4}
      style={estilos.amostra}
    >
      <View style={[estilos.anel, { borderColor: 'transparent' }]}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            estilos.anelDaEscolha,
            { borderColor: cores.texto },
            estiloAnel,
          ]}
        />
        <Animated.View style={estiloBola}>
          <Camada
            sombra="esferaClara"
            raio={20}
            style={[estilos.cor, { backgroundColor: destaques[p.nome].base }]}
          >
            {p.escolhida && (
              <Pop de={0.2} mola={MOLA.viva}>
                <Icone icone={Check} tamanho={18} cor="destaqueSobre" traco={2.4} />
              </Pop>
            )}
          </Camada>
        </Animated.View>
      </View>
      <Texto estilo="legenda" cor={p.escolhida ? 'texto' : 'textoSuave'} numberOfLines={1}>
        {NOME_DESTAQUE[p.nome]}
      </Texto>
    </Pressable>
  );
}

/**
 * Ajustes (28:536). Só "Reduzir animações" tem efeito neste aparelho. "Brilho no botão
 * principal" dependeria de uma opção no BotaoMetal e "Ícone do app na cor de destaque", de
 * ícones alternativos no build nativo; ficam de fora até existirem.
 */
function Ajustes() {
  const reduzir = useAjustes((s) => s.reduzirAnimacoes);
  const definir = useAjustes((s) => s.definirReduzirAnimacoes);
  const doSistema = useReduzirMovimentoDoSistema();
  return (
    <Cartao lista>
      <LinhaDeLista
        titulo="Reduzir animações"
        subtitulo={
          doSistema
            ? 'O iPhone já pede menos movimento.'
            : 'Menos movimento nos gestos e transições.'
        }
        separador={false}
        fim={<Interruptor valor={reduzir} onMudar={definir} rotulo="Reduzir animações" />}
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  grupo: { gap: 8 },
  previa: { gap: 12 },
  previaConteudo: { gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  botao: { alignSelf: 'center', width: 220 },
  cores: { gap: 14 },
  amostras: { flexDirection: 'row', justifyContent: 'space-between' },
  amostra: { alignItems: 'center', gap: 6 },
  anel: { borderWidth: 2, borderRadius: 999, padding: 3 },
  anelDaEscolha: { borderWidth: 2, borderRadius: 999 },
  cor: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
