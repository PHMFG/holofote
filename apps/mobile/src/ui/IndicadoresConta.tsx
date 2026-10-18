import { router } from 'expo-router';
import { Gem, Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useConta, useEnergia } from '../api/consultas';
import { Camada } from './Camada';
import { Icone } from './Icone';
import { usePulso } from './movimento';
import { NumeroAnimado } from './NumeroAnimado';
import { Tocavel } from './Tocavel';

/**
 * Pílulas de energia (atual/máx) e gemas do topo do feed (02). Energia abre a folha 19. Os números
 * rolam quando mudam e a pílula da energia pulsa de leve.
 */
export function IndicadoresConta() {
  const energia = useEnergia();
  const conta = useConta();
  const atual = energia.data?.atual ?? conta.data?.energia.atual;
  const max = energia.data?.max ?? conta.data?.energia.max;
  const gemas = conta.data?.gemas;
  const pulsoEnergia = usePulso(atual);

  return (
    <View style={estilos.linha}>
      <Tocavel
        onPress={() => router.push('/sem-energia')}
        accessibilityRole="button"
        accessibilityLabel={atual !== undefined ? `Energia ${atual} de ${max}` : 'Energia'}
      >
        <Animated.View style={pulsoEnergia}>
          <Camada cor="superficie2" sombra="afundado" raio={999} style={estilos.pilula}>
            <Icone icone={Zap} tamanho={15} cor="destaqueTinta" traco={2} />
            <NumeroAnimado
              estilo="corpoForte"
              texto={atual !== undefined ? `${atual}/${max}` : '–'}
            />
          </Camada>
        </Animated.View>
      </Tocavel>
      <Camada
        cor="superficie2"
        sombra="afundado"
        raio={999}
        style={estilos.pilula}
        accessible
        accessibilityLabel={gemas !== undefined ? `${gemas} gemas` : 'Gemas'}
      >
        <Icone icone={Gem} tamanho={15} cor="texto" traco={2} />
        <NumeroAnimado estilo="corpoForte" texto={String(gemas ?? '–')} />
      </Camada>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 8 },
  pilula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
