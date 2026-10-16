import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Cartao } from './Cartao';
import { Chip } from './Chip';
import { Texto } from './Texto';

export interface EstadoTelaProps {
  tipo: 'carregando' | 'vazio' | 'erro';
  /** Uma frase (plano: estados vazios, carregando e erro usam o mesmo cartão). */
  frase: string;
  acao?: { rotulo: string; onPress: () => void };
}

/** Cartão único para carregando, vazio e erro, com uma frase e uma ação. */
export function EstadoTela({ tipo, frase, acao }: EstadoTelaProps) {
  const { cores } = useTema();
  return (
    <View style={estilos.centro}>
      <Cartao style={estilos.cartao} accessibilityLiveRegion="polite">
        {tipo === 'carregando' && (
          <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Carregando" />
        )}
        <Texto cor="textoSuave" style={estilos.frase}>
          {frase}
        </Texto>
        {acao && <Chip rotulo={acao.rotulo} variante="elevado" onPress={acao.onPress} />}
      </Cartao>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center' },
  cartao: { alignItems: 'center', gap: 12 },
  frase: { textAlign: 'center' },
});
