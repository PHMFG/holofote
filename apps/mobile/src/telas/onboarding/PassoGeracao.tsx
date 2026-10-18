import type { Mundo } from '@holofote/shared';
import { Sparkles, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useRelacoes } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { Avatar } from '../../ui/Avatar';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { CURVA, DURACAO, useMovimento } from '../../ui/movimento';
import { Texto } from '../../ui/Texto';
import { useAgora } from '../../tempo';
import { useAnimacoes } from '../animacao/animacoes';
import { RotuloGrupo, TopoDoPasso } from './TopoDoPasso';

/**
 * O que a IA gera na criação (docs/PLANO.md). A ordem é a da lista; o servidor não informa o
 * progresso por item, então a tela só "acende" os itens com o tempo (sem check de concluído).
 */
const GERADOS = [
  'a bíblia do universo',
  'o elenco, cada um com sua personalidade',
  'os marcos do primeiro ato',
  'o primeiro evento',
  'o feed do dia 1',
] as const;

export interface PassoGeracaoProps {
  mundo: Mundo | undefined;
  /** Volta ao formulário (só no erro). */
  onEditar: () => void;
}

/** Segundos até a IA "passar" para o próximo item da lista. */
const SEGUNDOS_POR_ITEM = 2.6;

/**
 * Passo 3: geração do mundo pela IA, elenco pronto ou erro com nova tentativa. Cada estado entra
 * com fade e o anterior sai com fade, no mesmo lugar.
 */
export function PassoGeracao({ mundo, onEditar }: PassoGeracaoProps) {
  const animacoes = useAnimacoes();
  const quadro =
    mundo?.estado === 'pronto' ? 'pronto' : mundo?.estado === 'erro' ? 'erro' : 'gerando';
  return (
    <Animated.View
      key={quadro}
      entering={animacoes.entrada()}
      exiting={animacoes.saidaSuave}
      style={estilos.quadro}
    >
      {quadro === 'pronto' && mundo ? (
        <MundoPronto mundo={mundo} />
      ) : quadro === 'erro' ? (
        <>
          <TopoDoPasso
            passo={3}
            titulo="O mundo não saiu"
            texto="A IA não conseguiu terminar desta vez. Nada foi gasto: dá para tentar de novo agora ou mudar o universo."
          />
          <Chip rotulo="Mudar persona ou universo" variante="elevado" onPress={onEditar} />
        </>
      ) : (
        <Gerando universo={mundo?.universo} />
      )}
    </Animated.View>
  );
}

function Gerando({ universo }: { universo: string | undefined }) {
  const [inicio] = useState(() => Date.now());
  const agora = useAgora(1000);
  const segundos = Math.max(0, Math.round((agora - inicio) / 1000));
  const ativo = Math.min(GERADOS.length - 1, Math.floor(segundos / SEGUNDOS_POR_ITEM));
  return (
    <>
      <TopoDoPasso
        passo={3}
        titulo="Gerando seu mundo"
        texto={`A IA está escrevendo ${universo ? `"${universo}"` : 'o seu universo'}. Costuma levar alguns segundos.`}
      />
      <Cartao style={estilos.cartaoGerando}>
        <View
          style={estilos.linha}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel="Gerando o mundo"
        >
          <EsferaEscrevendo />
          <Texto estilo="corpoForte" style={estilos.flex}>
            Gerando
          </Texto>
          <Texto estilo="legenda" cor="textoSuave">
            {segundos} s
          </Texto>
        </View>
        <ListaDoQueSeGera ativo={ativo} />
        <Texto estilo="legenda" cor="textoSuave">
          Os números do jogo vêm do motor de regras, não da IA.
        </Texto>
      </Cartao>
    </>
  );
}

/**
 * Esfera do Holofote respirando, com um anel que se abre e some a cada ciclo: "a IA está
 * escrevendo". Tudo na thread de UI; com movimento reduzido fica parada.
 */
function EsferaEscrevendo() {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const respiro = useSharedValue(0);
  const onda = useSharedValue(0);

  useEffect(() => {
    if (reduzido) return;
    respiro.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    onda.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }), -1);
    return () => {
      cancelAnimation(respiro);
      cancelAnimation(onda);
    };
  }, [reduzido, respiro, onda]);

  const esfera = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * respiro.value }] }));
  const anel = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - onda.value),
    transform: [{ scale: 1 + 0.9 * onda.value }],
  }));

  return (
    <View style={estilos.palcoDaEsfera}>
      <Animated.View
        pointerEvents="none"
        style={[estilos.anelDaEsfera, { borderColor: cores.destaque }, anel]}
      />
      <Animated.View style={esfera}>
        <Esfera tom="escuro" tamanho={ESFERA}>
          <Icone icone={Sparkles} tamanho={16} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
      </Animated.View>
    </View>
  );
}

/**
 * A lista do que a IA gera: os itens vão acendendo um depois do outro conforme o tempo passa e o
 * item da vez ganha um ponto pulsando. É só ritmo visual (o servidor não manda o progresso).
 * O VoiceOver lê a frase inteira uma vez, sem os itens um a um.
 */
function ListaDoQueSeGera({ ativo }: { ativo: number }) {
  const { reduzido, reduceMotion } = useMovimento();
  const progresso = useSharedValue(ativo + 1);
  const itemDaVez = useSharedValue(ativo);
  const pulso = useSharedValue(0);

  useEffect(() => {
    itemDaVez.value = ativo;
    progresso.value = withTiming(ativo + 1, {
      duration: DURACAO.lenta,
      easing: CURVA.saida,
      reduceMotion,
    });
  }, [ativo, reduceMotion, progresso, itemDaVez]);

  useEffect(() => {
    if (reduzido) return;
    pulso.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
      -1,
    );
    return () => cancelAnimation(pulso);
  }, [reduzido, pulso]);

  return (
    <View
      style={estilos.lista}
      accessible
      accessibilityLabel={`A IA escreve agora ${GERADOS.join(', ')}.`}
      accessibilityElementsHidden={false}
    >
      {GERADOS.map((texto, indice) => (
        <ItemDaLista
          key={texto}
          texto={texto}
          indice={indice}
          progresso={progresso}
          itemDaVez={itemDaVez}
          pulso={pulso}
        />
      ))}
    </View>
  );
}

function ItemDaLista({
  texto,
  indice,
  progresso,
  itemDaVez,
  pulso,
}: {
  texto: string;
  indice: number;
  progresso: SharedValue<number>;
  itemDaVez: SharedValue<number>;
  pulso: SharedValue<number>;
}) {
  const { cores } = useTema();
  // 0 enquanto a IA não chegou neste item, 1 depois que ela passou por ele.
  const estiloDoItem = useAnimatedStyle(() => {
    const aceso = Math.min(1, Math.max(0, progresso.value - indice));
    return { opacity: 0.4 + 0.6 * aceso, transform: [{ translateX: (1 - aceso) * 6 }] };
  });
  const estiloDoPonto = useAnimatedStyle(() => {
    const aceso = Math.min(1, Math.max(0, progresso.value - indice));
    return { transform: [{ scale: 0.6 + 0.4 * aceso }] };
  });
  const estiloDoHalo = useAnimatedStyle(() => ({
    opacity: itemDaVez.value === indice ? 0.7 * (1 - pulso.value) : 0,
    transform: [{ scale: 1 + 1.6 * pulso.value }],
  }));

  return (
    <Animated.View
      style={[estilos.itemDaLista, estiloDoItem]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={estilos.pontoDaLista}>
        <Animated.View
          style={[estilos.halo, { borderColor: cores.destaque }, estiloDoHalo]}
          pointerEvents="none"
        />
        <Animated.View
          style={[estilos.pontoCheio, { backgroundColor: cores.destaque }, estiloDoPonto]}
        />
      </View>
      <Texto style={estilos.flex}>{texto}</Texto>
    </Animated.View>
  );
}

function MundoPronto({ mundo }: { mundo: Mundo }) {
  return (
    <>
      <TopoDoPasso
        passo={3}
        titulo="Seu mundo está pronto"
        texto={`${mundo.universo} · ${mundo.tomCaos}% caótico. Conheça quem divide o palco com você.`}
      />
      <Aparecer indice={1} style={estilos.grupo}>
        <RotuloGrupo texto="Elenco gerado pela IA" />
        <ElencoGerado />
      </Aparecer>
    </>
  );
}

/** Elenco do mundo novo (Figma 14:82): nome, arroba e o rótulo da relação com o jogador. */
function ElencoGerado() {
  const relacoes = useRelacoes();
  const { cores } = useTema();

  if (relacoes.isPending) {
    return (
      <Cartao>
        <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Carregando o elenco" />
      </Cartao>
    );
  }
  if (relacoes.isError) {
    return (
      <Cartao style={estilos.erroElenco}>
        <Texto cor="textoSuave">Não deu para carregar o elenco agora.</Texto>
        <Chip rotulo="Tentar de novo" variante="elevado" onPress={() => void relacoes.refetch()} />
      </Cartao>
    );
  }

  const nos = relacoes.data.nos;
  const elenco = nos.filter((no) => no.personagem.papel === 'elenco');
  const figurantes = nos.length - elenco.length;
  if (nos.length === 0) {
    return (
      <Cartao>
        <Texto cor="textoSuave">O elenco aparece no feed assim que você entrar.</Texto>
      </Cartao>
    );
  }
  return (
    <Cartao lista>
      {/* O elenco gerado entra um a um, em cascata, e os figurantes fecham a lista. */}
      {elenco.map(({ personagem, relacao }, i) => (
        <Aparecer key={personagem.id} indice={i + 2}>
          <LinhaDeLista
            inicio={
              <Avatar
                iniciais={personagem.iniciais}
                tom={personagem.tomAvatar}
                nome={personagem.nome}
              />
            }
            titulo={personagem.nome}
            subtitulo={`${personagem.handle} · ${relacao.rotulo.toLowerCase()}`}
            separador={i < elenco.length - 1 || figurantes > 0}
          />
        </Aparecer>
      ))}
      {figurantes > 0 && (
        <Aparecer indice={elenco.length + 2}>
          <View style={estilos.figurantes} accessible>
            <Icone icone={Users} tamanho={16} />
            <Texto estilo="legenda" cor="textoSuave">
              + {figurantes} {figurantes === 1 ? 'figurante' : 'figurantes'}
            </Texto>
          </View>
        </Aparecer>
      )}
    </Cartao>
  );
}

const ESFERA = 36;

const estilos = StyleSheet.create({
  quadro: { gap: 16 },
  grupo: { gap: 10 },
  palcoDaEsfera: {
    width: ESFERA,
    height: ESFERA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anelDaEsfera: {
    position: 'absolute',
    width: ESFERA,
    height: ESFERA,
    borderRadius: ESFERA / 2,
    borderWidth: 2,
  },
  lista: { gap: 8, paddingVertical: 2 },
  itemDaLista: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pontoDaLista: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  pontoCheio: { width: 8, height: 8, borderRadius: 4 },
  halo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  cartaoGerando: { gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  erroElenco: { gap: 12, alignItems: 'flex-start' },
  figurantes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 10,
  },
});
