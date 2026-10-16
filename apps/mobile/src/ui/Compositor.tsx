import { MAX_ESCALA_FONTE } from '@holofote/tokens';
import { SendHorizontal, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Avatar } from './Avatar';
import { Camada } from './Camada';
import { Custo } from './Custo';
import { Esfera, corSobreEsfera } from './Esfera';
import { Icone } from './Icone';
import { Texto } from './Texto';

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

/** Barra de escrever do pé da tela (13 · Respostas, 04 · DM, 15 · História). */
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
        <View style={estilos.contexto}>
          <Texto estilo="legenda" cor="textoSuave" style={estilos.flex}>
            {contexto.texto}
          </Texto>
          <Pressable
            onPress={contexto.onCancelar}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Cancelar resposta"
          >
            <Icone icone={X} tamanho={16} />
          </Pressable>
        </View>
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
          style={[tipografia.corpo, estilos.flex, { color: cores.texto }]}
        />
        <Custo energia={custo} />
        <Pressable
          onPress={enviar}
          disabled={vazio || enviando}
          accessibilityRole="button"
          accessibilityLabel={`Enviar, custa ${custo} de energia`}
          accessibilityState={{ disabled: vazio || !!enviando }}
          style={{ opacity: vazio || enviando ? 0.5 : 1 }}
        >
          <Esfera tom="escuro" tamanho={44}>
            <Icone icone={SendHorizontal} tamanho={20} cor={corSobreEsfera('escuro')} traco={2} />
          </Esfera>
        </Pressable>
      </Camada>
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 8 },
  contexto: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  pilula: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, paddingLeft: 8 },
  flex: { flex: 1 },
});
