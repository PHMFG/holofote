import { ArrowLeft, Ellipsis, Pencil } from 'lucide-react-native';
import { View } from 'react-native';
import { BotaoSuave } from './BotaoSuave';
import type { Historia } from './historias/tipos';

export const historia: Historia = {
  titulo: 'BotaoSuave',
  figma: '28:446',
  Exemplo: () => (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <BotaoSuave icone={ArrowLeft} rotulo="Voltar" onPress={() => {}} />
      <BotaoSuave icone={Ellipsis} rotulo="Mais opções" onPress={() => {}} />
      <BotaoSuave icone={Pencil} rotulo="Editar" variante="elevado" onPress={() => {}} />
    </View>
  ),
};
