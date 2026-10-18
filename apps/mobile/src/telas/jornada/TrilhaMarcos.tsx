import type { Marco } from '@holofote/shared';
import { Check, Crown } from 'lucide-react-native';
import { Fragment, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { CURVA, DURACAO, MOLA, useMovimento } from '../../ui/movimento';
import { Halo, Pop, usePulso } from '../perfil/efeitos';

const TAMANHO = 38;
/** A trilha se desenha da esquerda para a direita: cada marco entra, depois o fio até o próximo. */
const PASSO_DA_TRILHA = 170;
const INICIO_DA_TRILHA = 120;

const ESTADO: Record<Marco['estado'], string> = {
  concluido: 'concluído',
  atual: 'em andamento',
  futuro: 'bloqueado',
};

export interface TrilhaMarcosProps {
  /** Já ordenados por `ordem`. */
  marcos: readonly Marco[];
  /** Tocar num marco concluído abre a tela 18 (resgatar ou rever as recompensas). */
  onAbrir: (marco: Marco) => void;
}

/**
 * Trilha dos marcos do ato (Figma 20:310): concluído em esfera preta com check, atual com borda
 * de destaque e o número, futuro afundado; conectores em destaque até o marco atual.
 */
export function TrilhaMarcos({ marcos, onAbrir }: TrilhaMarcosProps) {
  const ultimaOrdem = marcos[marcos.length - 1]?.ordem;

  return (
    <View style={estilos.trilha}>
      {marcos.map((marco, i) => {
        const proximo = marcos[i + 1];
        const rotulo = [
          `Marco ${marco.ordem}: ${marco.titulo}`,
          ESTADO[marco.estado],
          marco.estado === 'concluido' && !marco.resgatado ? 'recompensa para resgatar' : '',
        ]
          .filter(Boolean)
          .join(', ');
        return (
          <Fragment key={marco.id}>
            <Tocavel
              onPress={marco.estado === 'concluido' ? () => onAbrir(marco) : undefined}
              accessibilityRole="button"
              accessibilityLabel={rotulo}
              papelSemToque="image"
              hitSlop={4}
            >
              <No
                marco={marco}
                ultimo={marco.ordem === ultimaOrdem}
                atraso={INICIO_DA_TRILHA + i * PASSO_DA_TRILHA}
              />
            </Tocavel>
            {proximo && (
              <Conector
                cheio={proximo.estado !== 'futuro'}
                atraso={INICIO_DA_TRILHA + i * PASSO_DA_TRILHA + 110}
              />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

/** Fio entre dois marcos: o trilho em linha e, por cima, o destaque enchendo até o marco atual. */
function Conector({ cheio, atraso }: { cheio: boolean; atraso: number }) {
  const { cores } = useTema();
  const { reduzido } = useMovimento();
  const p = useSharedValue(reduzido && cheio ? 1 : 0);
  useEffect(() => {
    if (!cheio || reduzido) {
      p.value = cheio ? 1 : 0;
      return;
    }
    p.value = withDelay(atraso, withTiming(1, { duration: DURACAO.media, easing: CURVA.saida }));
    return () => cancelAnimation(p);
  }, [cheio, reduzido, atraso, p]);
  const preenchimento = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <View style={[estilos.conector, { backgroundColor: cores.linha }]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          estilos.origemEsquerda,
          { backgroundColor: cores.destaqueGrafico, borderRadius: 2 },
          preenchimento,
        ]}
      />
    </View>
  );
}

function No({ marco, ultimo, atraso }: { marco: Marco; ultimo: boolean; atraso: number }) {
  const atual = marco.estado === 'atual';
  // O marco atual respira: o nó pulsa de leve e um anel se expande por trás dele.
  const pulso = usePulso(atual, { ate: 1.07, duracao: 1200 });
  if (marco.estado === 'concluido') {
    return (
      <Pop de={0.4} atraso={atraso} mola={MOLA.viva}>
        <Esfera tom="escuro" tamanho={TAMANHO}>
          <Icone icone={Check} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
      </Pop>
    );
  }
  return (
    <Pop de={0.4} atraso={atraso} mola={MOLA.viva}>
      <View style={estilos.no}>
        {atual && <Halo atraso={atraso + 500} escala={1.65} duracao={1800} />}
        <Animated.View style={pulso}>
          <Camada
            cor={atual ? 'superficie' : 'superficie2'}
            sombra={atual ? 'elevacao' : 'afundado'}
            borda={atual ? { cor: 'destaque', largura: 2 } : undefined}
            raio={TAMANHO / 2}
            style={estilos.no}
          >
            {ultimo ? (
              <Icone icone={Crown} tamanho={16} cor={atual ? 'texto' : 'textoSuave'} />
            ) : (
              <Texto estilo="corpoForte" cor={atual ? 'texto' : 'textoSuave'}>
                {marco.ordem}
              </Texto>
            )}
          </Camada>
        </Animated.View>
      </View>
    </Pop>
  );
}

const estilos = StyleSheet.create({
  trilha: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  no: { width: TAMANHO, height: TAMANHO, alignItems: 'center', justifyContent: 'center' },
  conector: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden' },
  origemEsquerda: { transformOrigin: 'left center' },
});
