import { NOME_APP } from '@holofote/shared';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../tema/ProvedorTema';
import { Texto } from '../ui/Texto';

// Tela provisória até o fluxo de criar mundo (F5).
export default function Inicio() {
  const insets = useSafeAreaInsets();
  const { medidas } = useTema();

  return (
    <View
      style={[
        estilos.tela,
        { paddingTop: insets.top + 24, paddingHorizontal: medidas.margemLateral },
      ]}
    >
      <Texto estilo="display" accessibilityRole="header">
        {NOME_APP}
      </Texto>
      <Texto estilo="legenda" cor="textoSuave">
        Fase F1 · design system Cromo
      </Texto>
      {__DEV__ && (
        <Link href="/dev/catalogo" style={estilos.link}>
          <Texto estilo="corpoForte" cor="destaqueTinta">
            Abrir catálogo de componentes
          </Texto>
        </Link>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, gap: 4 },
  link: { marginTop: 32 },
});
