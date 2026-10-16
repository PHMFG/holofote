import { View } from 'react-native';
import { Avatar } from './Avatar';
import type { Historia } from './historias/tipos';

export const historia: Historia = {
  titulo: 'Avatar',
  figma: '12:10',
  Exemplo: () => (
    <View style={{ flexDirection: 'row', gap: 20 }}>
      <Avatar iniciais="LP" tom="escuro" nome="Lua Prado (você)" />
      <Avatar iniciais="LP" tom="claro" nome="Lua Prado" />
      <Avatar iniciais="LP" tom="medio" nome="Lua Prado" />
      <Avatar iniciais="VF" tom="claro" tamanho={48} nome="Vic Ferraz" />
    </View>
  ),
};
