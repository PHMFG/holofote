import { View } from 'react-native';
import { BarraPassos, BarraProgresso } from './BarraProgresso';
import type { Historia } from './historias/tipos';
import { Texto } from './Texto';

export const historia: Historia = {
  titulo: 'BarraProgresso',
  figma: '20:303',
  Exemplo: () => (
    <View style={{ gap: 12 }}>
      <BarraPassos total={3} atual={2} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Texto>Primeiro show lotado</Texto>
        <Texto estilo="legenda" cor="textoSuave">
          2 de 4
        </Texto>
      </View>
      <BarraProgresso valor={0.5} rotulo="Marco: Primeiro show lotado" />
      <BarraProgresso valor={0.72} altura={6} rotulo="Carisma" />
      <BarraProgresso valor={0.4} altura={4} variante="chapada" rotulo="Tempo para decidir" />
    </View>
  ),
};
