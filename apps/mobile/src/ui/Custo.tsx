import { Zap } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import { Camada } from './Camada';
import { Icone } from './Icone';
import { Texto } from './Texto';

/** Pílula afundada com o raio e o custo em energia de uma ação. */
export function Custo({ energia }: { energia: number }) {
  return (
    <Camada
      cor="superficie2"
      sombra="afundado"
      raio={999}
      accessible
      accessibilityLabel={`Custa ${energia} de energia`}
      style={estilos.pilula}
    >
      <Icone icone={Zap} tamanho={13} cor="texto" traco={2} />
      <Texto estilo="legenda">{energia}</Texto>
    </Camada>
  );
}

const estilos = StyleSheet.create({
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
