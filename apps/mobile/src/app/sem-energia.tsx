import { ESCURECER } from '@holofote/tokens';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { TelaSemEnergia } from '../telas/energia/TelaSemEnergia';

/**
 * 19 · Sem energia (Figma 56:1534 claro, 58:2440 escuro): folha rente à borda de baixo, com o
 * escurecer do Figma atrás. É um modal transparente no layout raiz em vez do formSheet nativo,
 * que no iOS 26 flutua com margem e deixa uma faixa sem fundo embaixo da folha.
 */
export default function SemEnergia() {
  return (
    <View style={estilos.tela}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: ESCURECER }]}
        onPress={() => router.back()}
        // "Agora não" dentro da folha já fecha para quem usa o VoiceOver.
        accessible={false}
      />
      <TelaSemEnergia />
    </View>
  );
}

const estilos = StyleSheet.create({ tela: { flex: 1, justifyContent: 'flex-end' } });
