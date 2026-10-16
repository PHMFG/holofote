import { View } from 'react-native';
import { Cartao } from './Cartao';
import type { Historia } from './historias/tipos';
import { Texto } from './Texto';

export const historia: Historia = {
  titulo: 'Cartao',
  figma: '28:452',
  Exemplo: () => (
    <View style={{ gap: 12 }}>
      <Cartao>
        <Texto estilo="secao">Objetivo do ato</Texto>
        <Texto cor="textoSuave">Dominar o pop nacional</Texto>
      </Cartao>
      <Cartao variante="afundado">
        <Texto estilo="legenda" cor="textoSuave">
          Post original
        </Texto>
        <Texto>single novo sexta. sem feat. sem desculpa.</Texto>
      </Cartao>
      <Cartao variante="contornado">
        <Texto estilo="corpoForte">Esperar recarga</Texto>
      </Cartao>
    </View>
  ),
};
