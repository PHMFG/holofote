import type { ItemRegistro, TipoAcao } from '@holofote/shared';
import { Undo2, Zap } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type TextLayoutEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { Chip } from '../../ui/Chip';
import { Rotulo } from '../../ui/Rotulo';
import { Texto } from '../../ui/Texto';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { horaMinuto } from '../../tempo';
import { CURVA, DURACAO, MOLA, useMovimento } from '../../ui/movimento';
import { Pop, Troca } from '../perfil/efeitos';
import { formatarDeltas, type DeltaFormatado } from './formatar';

/** Tipo da ação como aparece no cabeçalho do cartão (Figma 27:433, em Mini maiúsculo). */
export const NOME_DO_TIPO: Record<TipoAcao, string> = {
  post: 'Post',
  resposta: 'Comentário',
  dm: 'Mensagem direta',
  historia: 'Comentário em história',
  campanha: 'Campanha',
  discurso: 'Discurso',
  desfazer: 'Desfazer',
};

export interface ItemDoRegistroProps {
  item: ItemRegistro;
  nomePorId: ReadonlyMap<string, string>;
  /** Ponto cheio de destaque no item mais recente da linha do tempo. */
  maisRecente: boolean;
  /** Último item do grupo: sem a linha abaixo do ponto. */
  ultimo: boolean;
  /** Posição na lista: o ponto e o fio da linha do tempo se desenham em cascata. */
  indice?: number;
  desfazendo: boolean;
  onDesfazer: (item: ItemRegistro) => void;
}

/** Uma atividade da linha do tempo de 09 · Registro (Figma 27:427). */
export function ItemDoRegistro({
  item,
  nomePorId,
  maisRecente,
  ultimo,
  indice = 0,
  desfazendo,
  onDesfazer,
}: ItemDoRegistroProps) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const hora = horaMinuto(item.criadoEm);
  const atrasoDoItem = Math.min(indice, 8) * 40;
  // Desfazer: o cartão esmaece e o resumo é riscado com um traço que corre pelo texto.
  const apagado = useSharedValue(item.desfeito ? 1 : 0);
  useEffect(() => {
    apagado.value = withTiming(item.desfeito ? 1 : 0, {
      duration: reduzido ? 0 : DURACAO.lenta,
      easing: CURVA.saida,
    });
  }, [item.desfeito, reduzido, apagado]);
  const estiloConteudo = useAnimatedStyle(() => ({ opacity: 1 - 0.25 * apagado.value }));
  const fio = useSharedValue(reduzido || ultimo ? 1 : 0);
  useEffect(() => {
    if (reduzido) {
      fio.value = 1;
      return;
    }
    fio.value = withDelay(
      atrasoDoItem + 180,
      withTiming(1, { duration: DURACAO.media, easing: CURVA.saida }),
    );
    return () => cancelAnimation(fio);
  }, [reduzido, atrasoDoItem, fio]);
  const estiloFio = useAnimatedStyle(() => ({ transform: [{ scaleY: fio.value }] }));
  const deltas = formatarDeltas(item.deltas, nomePorId);
  const rotulo = [
    `${NOME_DO_TIPO[item.tipo]}, ${hora}`,
    item.resumo,
    deltas.map((d) => d.rotulo).join(', '),
    item.desfeito ? 'desfeito' : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={estilos.linha}>
      <View style={estilos.trilho}>
        <Pop de={0.2} atraso={atrasoDoItem + 80} mola={MOLA.viva}>
          <View
            style={[
              estilos.ponto,
              maisRecente
                ? { backgroundColor: cores.destaque }
                : { borderWidth: 2, borderColor: cores.textoFraco, backgroundColor: cores.fundo },
            ]}
          />
        </Pop>
        {!ultimo && (
          <Animated.View
            style={[estilos.fio, estilos.origemTopo, { backgroundColor: cores.linha }, estiloFio]}
          />
        )}
      </View>
      <View style={[estilos.espaco, !ultimo && estilos.espacoAbaixo]}>
        <Camada cor="superficie" sombra="elevacao" raio={22} style={estilos.cartao}>
          <Animated.View
            accessible
            accessibilityLabel={rotulo}
            style={[estilos.conteudo, estiloConteudo]}
          >
            <View style={estilos.topo}>
              <Texto estilo="mini" cor="textoSuave" style={estilos.tipo} numberOfLines={1}>
                {NOME_DO_TIPO[item.tipo]}
              </Texto>
              <Texto estilo="legenda" cor="textoSuave">
                {hora}
              </Texto>
            </View>
            <ResumoRiscavel texto={item.resumo} desfeito={item.desfeito} />
            {deltas.length > 0 && (
              <View style={estilos.deltas}>
                {deltas.map((d) => (
                  <ChipDelta key={d.chave} delta={d} riscado={item.desfeito} />
                ))}
              </View>
            )}
          </Animated.View>
          {item.desfeito ? (
            <Troca chave="desfeito" style={estilos.rodape}>
              <Rotulo texto="Desfeito" />
            </Troca>
          ) : (
            item.desfazivel && (
              <Troca chave="desfazivel" style={estilos.rodape}>
                <Chip
                  rotulo={desfazendo ? 'Desfazendo…' : `Desfazer · ${CUSTO_DESFAZER}`}
                  rotuloAcessivel={
                    desfazendo ? undefined : `Desfazer, custa ${CUSTO_DESFAZER} de energia`
                  }
                  variante="afundado"
                  icone={Undo2}
                  iconeDepois={desfazendo ? undefined : Zap}
                  onPress={desfazendo ? undefined : () => onDesfazer(item)}
                />
              </Troca>
            )
          )}
        </Camada>
      </View>
    </View>
  );
}

/**
 * Resumo da ação. O riscado é um traço por linha de texto, desenhado por cima: quando a ação é
 * desfeita com a tela aberta o traço corre pelo texto, linha a linha; ao abrir já desfeita (ou
 * com movimento reduzido) ele já está inteiro. Antes de o texto ser medido, vale o riscado do
 * próprio texto, para não haver um quadro sem riscado.
 */
function ResumoRiscavel({ texto, desfeito }: { texto: string; desfeito: boolean }) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const [linhas, setLinhas] = useState<TextLayoutEvent['nativeEvent']['lines']>([]);
  const traco = useSharedValue(desfeito ? 1 : 0);
  useEffect(() => {
    traco.value = withTiming(desfeito ? 1 : 0, {
      duration: reduzido ? 0 : DURACAO.lenta,
      easing: CURVA.entradaSaida,
    });
  }, [desfeito, reduzido, traco]);
  return (
    <View>
      <Texto
        cor={desfeito ? 'textoSuave' : 'texto'}
        style={desfeito && linhas.length === 0 && estilos.riscado}
        onTextLayout={(e) => setLinhas(e.nativeEvent.lines)}
      >
        {texto}
      </Texto>
      {linhas.map((linha, i) => (
        <TracoDeLinha
          key={i}
          linha={linha}
          indice={i}
          total={linhas.length}
          progresso={traco}
          cor={cores.textoSuave}
        />
      ))}
    </View>
  );
}

function TracoDeLinha({
  linha,
  indice,
  total,
  progresso,
  cor,
}: {
  linha: { x: number; y: number; width: number; height: number };
  indice: number;
  total: number;
  progresso: SharedValue<number>;
  cor: string;
}) {
  // O traço passa uma linha de cada vez, de cima para baixo.
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.min(1, Math.max(0, progresso.value * total - indice)) }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        estilos.traco,
        estilos.origemEsquerda,
        {
          left: linha.x,
          top: linha.y + linha.height / 2,
          width: linha.width,
          backgroundColor: cor,
        },
        estilo,
      ]}
    />
  );
}

/**
 * Efeito do motor: positivo em destaque suave, negativo neutro. Ao desfazer, o chip dá uma
 * volta, esmaece e o fundo vai para o neutro, mostrando que o efeito foi revertido.
 */
function ChipDelta({ delta, riscado }: { delta: DeltaFormatado; riscado: boolean }) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const p = useSharedValue(riscado ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(riscado ? 1 : 0, {
      duration: reduzido ? 0 : DURACAO.lenta,
      easing: CURVA.enfase,
    });
  }, [riscado, reduzido, p]);
  const fundo = delta.positivo ? cores.destaqueSuave : cores.superficie2;
  const neutro = cores.superficie2;
  const estilo = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [fundo, neutro]),
    opacity: 1 - 0.35 * p.value,
    transform: reduzido ? [] : [{ perspective: 300 }, { rotateX: `${p.value * 360}deg` }],
  }));
  return (
    <Animated.View style={[estilos.chipDelta, estilo]}>
      <Texto
        estilo="legenda"
        cor={delta.positivo && !riscado ? 'destaqueTinta' : 'textoSuave'}
        style={riscado && estilos.riscado}
      >
        {delta.texto}
      </Texto>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12 },
  trilho: { width: 16, alignItems: 'center', paddingTop: 22 },
  ponto: { width: 12, height: 12, borderRadius: 6 },
  fio: { width: 2, flex: 1 },
  origemTopo: { transformOrigin: 'top' },
  origemEsquerda: { transformOrigin: 'left center' },
  traco: { position: 'absolute', height: 1.5, borderRadius: 1 },
  espaco: { flex: 1 },
  espacoAbaixo: { paddingBottom: 12 },
  cartao: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  conteudo: { gap: 8 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipo: { flex: 1 },
  riscado: { textDecorationLine: 'line-through' },
  deltas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipDelta: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  rodape: { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
});
