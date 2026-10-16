import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../tema/ProvedorTema';

/** Altura reservada embaixo nas abas para a pílula flutuante não cobrir conteúdo. */
export const ESPACO_BARRA_DE_ABAS = 100;

export interface TelaProps {
  children: ReactNode;
  /** Fica fixo no topo (fora da rolagem). */
  cabecalho?: ReactNode;
  /** Fica fixo embaixo, acima do indicador de início (ex.: BotaoMetal, campo de mensagem). */
  rodape?: ReactNode;
  /** Tela dentro das abas: reserva espaço para a barra flutuante. */
  comAbas?: boolean;
  rolavel?: boolean;
  gap?: number;
}

/** Estrutura padrão de tela: fundo Cromo, margem lateral 16 e áreas seguras do 16e. */
export function Tela({
  children,
  cabecalho,
  rodape,
  comAbas,
  rolavel = true,
  gap = 16,
}: TelaProps) {
  const { cores, medidas } = useTema();
  const insets = useSafeAreaInsets();
  const topo = insets.top + 8;
  const base = comAbas ? ESPACO_BARRA_DE_ABAS + insets.bottom : rodape ? 16 : insets.bottom + 24;
  const margem = { paddingHorizontal: medidas.margemLateral };

  return (
    <View style={[estilos.tela, { backgroundColor: cores.fundo }]}>
      {cabecalho && (
        <View style={[margem, { paddingTop: topo, paddingBottom: 8 }]}>{cabecalho}</View>
      )}
      {rolavel ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            margem,
            { paddingTop: cabecalho ? 8 : topo, paddingBottom: base, gap },
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            estilos.tela,
            margem,
            { paddingTop: cabecalho ? 8 : topo, paddingBottom: base, gap },
          ]}
        >
          {children}
        </View>
      )}
      {rodape && (
        <View style={[margem, { paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16) }]}>
          {rodape}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({ tela: { flex: 1 } });
