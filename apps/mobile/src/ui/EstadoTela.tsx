import { StyleSheet, View } from 'react-native';
import { Aparecer } from './Aparecer';
import { Cartao } from './Cartao';
import { Chip } from './Chip';
import { Esqueleto } from './Esqueleto';
import { Texto } from './Texto';

export interface EstadoTelaProps {
  tipo: 'carregando' | 'vazio' | 'erro';
  /** Uma frase (plano: estados vazios, carregando e erro usam o mesmo cartão). */
  frase: string;
  acao?: { rotulo: string; onPress: () => void };
}

/**
 * Cartão único para carregando, vazio e erro, com uma frase e uma ação. Carregando mostra linhas
 * de esqueleto com brilho em vez de um spinner; vazio e erro entram com fade e leve subida (e
 * quando o tipo muda, de carregando para erro, por exemplo, o cartão entra de novo).
 */
export function EstadoTela({ tipo, frase, acao }: EstadoTelaProps) {
  return (
    <View style={estilos.centro}>
      <Aparecer key={tipo} modo={tipo === 'carregando' ? 'fade' : 'subir'}>
        <Cartao style={estilos.cartao} accessibilityLiveRegion="polite">
          {tipo === 'carregando' && (
            <View
              accessible
              accessibilityLabel="Carregando"
              accessibilityRole="progressbar"
              style={estilos.esqueleto}
            >
              <Esqueleto altura={12} />
              <Esqueleto altura={12} largura="82%" />
              <Esqueleto altura={12} largura="56%" />
            </View>
          )}
          <Texto cor="textoSuave" style={estilos.frase}>
            {frase}
          </Texto>
          {acao && <Chip rotulo={acao.rotulo} variante="elevado" onPress={acao.onPress} />}
        </Cartao>
      </Aparecer>
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, justifyContent: 'center' },
  cartao: { alignItems: 'center', gap: 12 },
  esqueleto: { alignSelf: 'stretch', alignItems: 'flex-start', gap: 8 },
  frase: { textAlign: 'center' },
});
