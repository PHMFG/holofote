import { ESCURECER } from '@holofote/tokens';
import { Clock, Crown, Gem, Tv, Zap } from 'lucide-react-native';
import { View } from 'react-native';
import { Esfera, corSobreEsfera } from './Esfera';
import { Folha, OpcaoFolha } from './Folha';
import type { Historia } from './historias/tipos';
import { Icone } from './Icone';
import { Texto } from './Texto';

export const historia: Historia = {
  titulo: 'Folha',
  figma: '56:1626',
  Exemplo: () => (
    // Escurecer de exemplo; na tela real ele cobre tudo atrás da folha.
    <View
      style={{ backgroundColor: ESCURECER, paddingTop: 40, borderRadius: 24, overflow: 'hidden' }}
    >
      <Folha>
        <Esfera tom="escuro" tamanho={60}>
          <Icone icone={Zap} tamanho={27} cor={corSobreEsfera('escuro')} traco={3.6} />
        </Esfera>
        <Texto estilo="titulo" style={{ textAlign: 'center' }}>
          Sua energia acabou
        </Texto>
        <Texto cor="textoSuave" style={{ textAlign: 'center' }}>
          Cada ação com IA gasta energia. Escolha como continuar.
        </Texto>
        <View style={{ alignSelf: 'stretch', gap: 8 }}>
          <OpcaoFolha
            icone={Clock}
            titulo="Esperar recarga"
            subtitulo="+1 a cada 20 min"
            valor="próxima em 14 min"
          />
          <OpcaoFolha
            icone={Tv}
            titulo="Ver um anúncio"
            subtitulo="+3 de energia"
            valor="2 de 3 hoje"
          />
          <OpcaoFolha icone={Gem} titulo="Usar gemas" subtitulo="Enche a barra" valor="10 gemas" />
          <OpcaoFolha
            icone={Crown}
            titulo="Holofote Plus"
            subtitulo="Energia em dobro e sem anúncios"
            destaque
          />
        </View>
        <Texto estilo="corpoForte" cor="textoSuave">
          Agora não
        </Texto>
      </Folha>
    </View>
  ),
};
