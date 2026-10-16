import { NOME_APP } from '@holofote/shared';
import { PlatformColor, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONTES } from '../fontes';

// Tela provisória da F0: prova que o app abre e que a Plus Jakarta Sans está
// embutida nos quatro pesos. Cores do sistema até os tokens Cromo chegarem na F1.
const AMOSTRAS = [
  { nome: 'Regular', fonte: FONTES.regular },
  { nome: 'Medium', fonte: FONTES.medio },
  { nome: 'SemiBold', fonte: FONTES.semibold },
  { nome: 'Bold', fonte: FONTES.negrito },
];

export default function Inicio() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[estilos.tela, { paddingTop: insets.top + 24, paddingBottom: insets.bottom }]}>
      <Text accessibilityRole="header" style={estilos.titulo}>
        {NOME_APP}
      </Text>
      <Text style={estilos.legenda}>Fase F0 · fundação</Text>
      <View style={estilos.amostras}>
        {AMOSTRAS.map(({ nome, fonte }) => (
          <Text key={nome} style={[estilos.amostra, { fontFamily: fonte }]}>
            Plus Jakarta Sans {nome}
          </Text>
        ))}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: PlatformColor('systemBackground'),
  },
  titulo: {
    fontFamily: FONTES.negrito,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    color: PlatformColor('label'),
  },
  legenda: {
    fontFamily: FONTES.medio,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    color: PlatformColor('secondaryLabel'),
  },
  amostras: {
    marginTop: 32,
    gap: 12,
  },
  amostra: {
    fontSize: 17,
    lineHeight: 22,
    color: PlatformColor('label'),
  },
});
