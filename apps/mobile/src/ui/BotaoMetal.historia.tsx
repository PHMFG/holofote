import { View } from 'react-native';
import { BotaoMetal } from './BotaoMetal';
import type { Historia } from './historias/tipos';

export const historia: Historia = {
  titulo: 'BotaoMetal',
  figma: '12:79',
  Exemplo: () => (
    <View style={{ gap: 28, paddingBottom: 16 }}>
      <BotaoMetal rotulo="Entrar em cena" onPress={() => {}} />
      <BotaoMetal rotulo="Publicar · 1 energia" disabled />
    </View>
  ),
};
