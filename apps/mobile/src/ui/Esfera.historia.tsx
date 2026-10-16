import { Check, Zap } from 'lucide-react-native';
import { View } from 'react-native';
import { Esfera, corSobreEsfera } from './Esfera';
import type { Historia } from './historias/tipos';
import { Icone } from './Icone';

export const historia: Historia = {
  titulo: 'Esfera',
  figma: '20:356',
  Exemplo: () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Esfera tom="escuro" tamanho={60}>
        <Icone icone={Zap} tamanho={27} cor={corSobreEsfera('escuro')} traco={3.6} />
      </Esfera>
      <Esfera tom="escuro" tamanho={40}>
        <Icone icone={Zap} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
      </Esfera>
      <Esfera tom="claro" tamanho={40}>
        <Icone icone={Check} tamanho={18} cor={corSobreEsfera('claro')} traco={2} />
      </Esfera>
      <Esfera tom="medio" tamanho={32} />
    </View>
  ),
};
