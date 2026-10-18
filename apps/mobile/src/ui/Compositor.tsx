import { MAX_ESCALA_FONTE } from '@holofote/tokens';
import { SendHorizontal, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTema } from '../tema/ProvedorTema';
import { Avatar } from './Avatar';
import { Camada } from './Camada';
import { Custo } from './Custo';
import { Esfera, corSobreEsfera } from './Esfera';
import { Icone } from './Icone';
import { CURVA, DURACAO, MOLA, useMovimento } from './movimento';
import { Texto } from './Texto';
import { Tocavel } from './Tocavel';

export interface CompositorProps {
  /** Iniciais do jogador (avatar escuro). */
  iniciais: string;
  placeholder: string;
  /** Energia que o envio custa (mostrada no Custo). */
  custo: number;
  /**
   * Com uma Promise, o texto só some quando ela resolve: em erro (sem energia, moderação, rede)
   * o jogador não perde o que escreveu.
   */
  onEnviar: (texto: string) => void | Promise<unknown>;
  enviando?: boolean;
  /** Linha acima, ex.: "Respondendo a @vicferraz", com X para cancelar. */
  contexto?: { texto: string; onCancelar: () => void };
  limite?: number;
}

/**
 * Barra de escrever do pé da tela (13 · Respostas, 04 · DM, 15 · História). O botão de enviar
 * fica encolhido e esmaecido sem texto e cresce com um pop quando há o que enviar; a linha de
 * contexto ("Respondendo a...") entra com fade e leve subida. Com movimento reduzido, nada cresce.
 */
export function Compositor({
  iniciais,
  placeholder,
  custo,
  onEnviar,
  enviando,
  contexto,
  limite = 280,
}: CompositorProps) {
  const { cores, tipografia } = useTema();
  const [texto, setTexto] = useState('');
  const vazio = texto.trim().length === 0;
  const { reduzido, reduceMotion } = useMovimento();
  const pronto = useSharedValue(vazio ? 0 : 1);
  useEffect(() => {
    const alvo = vazio ? 0 : 1;
    pronto.value = reduzido
      ? alvo
      : alvo === 1
        ? withSpring(1, MOLA.viva)
        : withTiming(0, { duration: DURACAO.rapida, easing: CURVA.saida });
  }, [vazio, reduzido, pronto]);
  const botao = useAnimatedStyle(() => ({
    transform: [{ scale: reduzido ? 1 : 0.84 + 0.16 * pronto.value }],
  }));

  const enviar = () => {
    if (vazio || enviando) return;
    const resultado = onEnviar(texto.trim());
    if (resultado instanceof Promise) {
      resultado.then(
        () => setTexto(''),
        () => {},
      );
    } else {
      setTexto('');
    }
  };

  return (
    <View style={estilos.grupo}>
      {contexto && (
        <Animated.View
          entering={FadeInDown.duration(DURACAO.rapida)
            .easing(CURVA.saida)
            .reduceMotion(reduceMotion)}
          exiting={FadeOut.duration(DURACAO.instante).reduceMotion(reduceMotion)}
          style={estilos.contexto}
        >
          <Texto estilo="legenda" cor="textoSuave" style={estilos.flex}>
            {contexto.texto}
          </Texto>
          <Tocavel
            onPress={contexto.onCancelar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancelar resposta"
          >
            <Icone icone={X} tamanho={16} />
          </Tocavel>
        </Animated.View>
      )}
      <Camada cor="superficie" sombra="elevacao" raio={28} style={estilos.pilula}>
        <Avatar iniciais={iniciais} tom="escuro" tamanho={28} nome="Você" />
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          multiline
          maxLength={limite}
          maxFontSizeMultiplier={MAX_ESCALA_FONTE}
          placeholderTextColor={cores.textoSuave}
          selectionColor={cores.destaque}
          // No iOS, o campo multilinha soma um recuo de cima e o lineHeight empurra o texto para
          // baixo: sem os dois, o texto fica centrado com o avatar, o custo e o botão.
          style={[
            tipografia.corpo,
            estilos.flex,
            estilos.campo,
            { color: cores.texto, lineHeight: undefined },
          ]}
        />
        <Custo energia={custo} style={estilos.custo} />
        <Animated.View style={botao}>
          <Esfera
            tom="escuro"
            tamanho={44}
            onPress={enviar}
            desabilitada={vazio || enviando}
            accessibilityLabel={`Enviar, custa ${custo} de energia`}
          >
            <Icone icone={SendHorizontal} tamanho={20} cor={corSobreEsfera('escuro')} traco={2} />
          </Esfera>
        </Animated.View>
      </Camada>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 8 },
  contexto: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  pilula: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, paddingLeft: 8 },
  flex: { flex: 1 },
  custo: { alignSelf: 'center' },
  campo: { paddingTop: 0, paddingBottom: 0, maxHeight: 120, textAlignVertical: 'center' },
});
