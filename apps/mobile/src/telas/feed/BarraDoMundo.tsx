import type { Mundo } from '@holofote/shared';
import { Sparkles } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Camada } from '../../ui/Camada';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { IndicadoresConta } from '../../ui/IndicadoresConta';
import { Texto } from '../../ui/Texto';
import { NOME_PERIODO } from '../../tempo';

/**
 * Pílula do topo do feed (Figma 16:38): esfera do Holofote, dia e período do mundo, energia e
 * gemas. A estrela do Figma (`icon/estrela`) é desenho próprio; aqui vai o Sparkles do lucide.
 */
export function BarraDoMundo({ mundo }: { mundo: Pick<Mundo, 'dia' | 'periodo'> | undefined }) {
  return (
    <Camada raio={999} borda={{ cor: 'linha', largura: 1.5 }} style={estilos.pilula}>
      <Esfera tom="escuro" tamanho={48}>
        <Icone icone={Sparkles} tamanho={22} cor={corSobreEsfera('escuro')} traco={2} />
      </Esfera>
      <Camada
        gradiente="bloco"
        raio={14}
        style={estilos.dia}
        accessible
        accessibilityRole="header"
        accessibilityLabel={mundo ? `Dia ${mundo.dia}, ${NOME_PERIODO[mundo.periodo]}` : 'Dia'}
      >
        <Texto estilo="secao">{mundo ? `Dia ${mundo.dia}` : 'Dia'}</Texto>
        <Texto estilo="legenda" cor="textoSuave">
          {mundo ? NOME_PERIODO[mundo.periodo] : ' '}
        </Texto>
      </Camada>
      <View style={estilos.espaco} />
      <IndicadoresConta />
    </Camada>
  );
}

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 8,
    paddingVertical: 6,
  },
  dia: { paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden' },
  espaco: { flex: 1 },
});
