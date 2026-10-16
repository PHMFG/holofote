import { StyleSheet, View } from 'react-native';
import { BarraPassos } from '../../ui/BarraProgresso';
import { Texto } from '../../ui/Texto';

export const TOTAL_PASSOS = 3;

/** Cabeçalho dos passos de 01 · Criar mundo (Figma 14:20): passos, título e uma frase. */
export function TopoDoPasso({
  passo,
  titulo,
  texto,
}: {
  passo: number;
  titulo: string;
  texto: string;
}) {
  return (
    <View style={estilos.topo}>
      <BarraPassos total={TOTAL_PASSOS} atual={passo} />
      <Texto estilo="display" accessibilityRole="header">
        {titulo}
      </Texto>
      <Texto cor="textoSuave">{texto}</Texto>
    </View>
  );
}

/** Rótulo de grupo em Mini, sem recuo, como "SUA PERSONA" e "UNIVERSO" no Figma. */
export function RotuloGrupo({ texto }: { texto: string }) {
  return (
    <Texto estilo="mini" cor="textoSuave" accessibilityRole="header">
      {texto}
    </Texto>
  );
}

const estilos = StyleSheet.create({ topo: { gap: 10 } });
