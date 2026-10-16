import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';

// No Figma (05 · 19:234, 08 · 26:355) a capa tem 148 com a barra de status de 50; o avatar de 94
// (anel de 5 no fundo) começa em 100 e sobrepõe 48 da capa.
const ALTURA_SEM_STATUS = 98;
const SOBREPOSICAO = 48;

export interface CapaProps {
  /** Linha de cima: botões elevados, indicadores, cabeçalho. */
  acoes: ReactNode;
  /** Avatar grande sobre a borda de baixo da capa. */
  avatar: ReactNode;
  /** Ao lado do avatar, à direita (ex.: um chip). */
  aoLadoDoAvatar?: ReactNode;
}

/**
 * Capa dos perfis (05 e 08): gradiente Cromo/Capa de borda a borda, por baixo da barra de
 * status. Vai como primeiro filho de uma Tela sem cabeçalho; desfaz o recuo do topo e as margens.
 */
export function Capa({ acoes, avatar, aoLadoDoAvatar }: CapaProps) {
  const insets = useSafeAreaInsets();
  const { medidas } = useTema();
  const topo = insets.top + 8;
  return (
    <View style={{ marginTop: -topo, marginHorizontal: -medidas.margemLateral }}>
      <Camada
        gradiente="capa"
        style={{
          height: insets.top + ALTURA_SEM_STATUS,
          paddingTop: topo,
          paddingHorizontal: medidas.margemLateral,
        }}
      >
        {acoes}
      </Camada>
      <View style={[estilos.linhaAvatar, { paddingHorizontal: medidas.margemLateral }]}>
        <Camada cor="fundo" raio={999} style={estilos.anel}>
          {avatar}
        </Camada>
        {aoLadoDoAvatar}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  linhaAvatar: {
    marginTop: -SOBREPOSICAO,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  anel: { padding: 5 },
});
