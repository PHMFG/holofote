import type { Marco } from '@holofote/shared';
import { Check, Crown } from 'lucide-react-native';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';

const TAMANHO = 38;

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
  const { cores } = useTema();
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
              <No marco={marco} ultimo={marco.ordem === ultimaOrdem} />
            </Tocavel>
            {proximo && (
              <View
                style={[
                  estilos.conector,
                  {
                    backgroundColor:
                      proximo.estado === 'futuro' ? cores.linha : cores.destaqueGrafico,
                  },
                ]}
              />
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

function No({ marco, ultimo }: { marco: Marco; ultimo: boolean }) {
  if (marco.estado === 'concluido') {
    return (
      <Esfera tom="escuro" tamanho={TAMANHO}>
        <Icone icone={Check} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
      </Esfera>
    );
  }
  const atual = marco.estado === 'atual';
  return (
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
  );
}

const estilos = StyleSheet.create({
  trilha: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  no: { width: TAMANHO, height: TAMANHO, alignItems: 'center', justifyContent: 'center' },
  conector: { flex: 1, height: 3, borderRadius: 2 },
});
