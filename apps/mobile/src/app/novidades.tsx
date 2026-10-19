import { ESCURECER } from '@holofote/tokens';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { TelaNovidades } from '../telas/novidades/TelaNovidades';

/** Novidades do app: folha de baixo com o escurecer atrás, como 19 · Sem energia. */
export default function Novidades() {
  return (
    <View style={estilos.tela}>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: ESCURECER }]}
        onPress={() => router.back()}
        // "Continuar" dentro da folha já fecha para quem usa o VoiceOver.
        accessible={false}
      />
      <TelaNovidades />
    </View>
  );
}

const estilos = StyleSheet.create({ tela: { flex: 1, justifyContent: 'flex-end' } });
