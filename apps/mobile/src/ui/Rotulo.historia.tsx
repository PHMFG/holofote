import { View } from 'react-native';
import type { Historia } from './historias/tipos';
import { Rotulo, RotuloSecao } from './Rotulo';

export const historia: Historia = {
  titulo: 'Rotulo',
  figma: '53:1513',
  Exemplo: () => (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Rotulo texto="FÃ" />
        <Rotulo texto="NOVO" variante="destaque" />
        <Rotulo texto="12 de out" variante="data" />
      </View>
      <RotuloSecao texto="Escolha seu discurso" meta="decida em 0:24" />
    </View>
  ),
};
