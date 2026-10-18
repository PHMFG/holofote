import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { SeparadorComentario } from '../../ui/Comentario';
import { Texto } from '../../ui/Texto';
import { useAnimacoes } from './animacoes';
import { PontosEmOnda } from './PontosEmOnda';

/**
 * "Fulano está digitando" embaixo de um post ou de uma resposta (mesmo desenho do Digitando de
 * src/ui/Comentario), com os pontinhos em onda e entrada e saída suaves.
 */
export function LinhaDigitando({
  nome,
  iniciais,
  separador = false,
}: {
  nome: string;
  iniciais: string;
  /** Linha de 1 px acima, quando há comentários antes (13 · Respostas). */
  separador?: boolean;
}) {
  const { cores } = useTema();
  const animacoes = useAnimacoes();
  return (
    <Animated.View
      entering={animacoes.deSubida()}
      exiting={animacoes.saidaSuave}
      layout={animacoes.layout}
      style={estilos.raiz}
    >
      {separador && <SeparadorComentario />}
      <View style={estilos.linha} accessible accessibilityLabel={`${nome} está digitando`}>
        <Avatar iniciais={iniciais} tamanho={28} />
        <View style={[estilos.bolha, { backgroundColor: cores.superficie2 }]}>
          <PontosEmOnda />
        </View>
        <Texto estilo="legenda" cor="textoSuave">
          {nome} está digitando
        </Texto>
      </View>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  raiz: { gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bolha: {
    width: 50,
    height: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
