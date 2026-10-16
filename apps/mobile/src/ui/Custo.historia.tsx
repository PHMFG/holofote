import { View } from 'react-native';
import { Custo } from './Custo';
import type { Historia } from './historias/tipos';

export const historia: Historia = {
  titulo: 'Custo',
  figma: '53:1543',
  Exemplo: () => (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Custo energia={1} />
      <Custo energia={2} />
    </View>
  ),
};
