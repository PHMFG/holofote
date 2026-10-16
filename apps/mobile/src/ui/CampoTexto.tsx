import { MAX_ESCALA_FONTE } from '@holofote/tokens';
import type { ComponentRef, Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Texto } from './Texto';

export interface CampoTextoProps extends Omit<TextInputProps, 'style'> {
  /** Rótulo lido pelo VoiceOver e mostrado acima (Mini). */
  rotulo: string;
  /** Mostra "n/limite" embaixo, à direita (ex.: post de 280). */
  limite?: number;
  /** Mensagem de erro embaixo do campo (por que o valor não vale); some quando vazia. */
  erro?: string | null;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Campo de texto afundado no padrão Cromo (formulários: persona, novo post). */
export function CampoTexto({
  rotulo,
  limite,
  erro,
  value,
  multiline,
  ref,
  ...props
}: CampoTextoProps) {
  const { cores, tipografia } = useTema();
  return (
    <View style={estilos.grupo}>
      <Texto estilo="mini" cor="textoSuave">
        {rotulo}
      </Texto>
      <Camada cor="superficie2" sombra="afundado" raio={20} style={estilos.caixa}>
        <TextInput
          ref={ref}
          accessibilityLabel={rotulo}
          value={value}
          multiline={multiline}
          maxLength={limite}
          maxFontSizeMultiplier={MAX_ESCALA_FONTE}
          placeholderTextColor={cores.textoSuave}
          selectionColor={cores.destaque}
          style={[tipografia.corpo, { color: cores.texto }, multiline && estilos.multilinha]}
          {...props}
        />
      </Camada>
      {erro ? (
        <Texto estilo="legenda" cor="destaqueTinta" accessibilityLiveRegion="polite">
          {erro}
        </Texto>
      ) : null}
      {limite !== undefined && (
        <Texto estilo="legenda" cor="textoSuave" style={estilos.contador}>
          {(value ?? '').length}/{limite}
        </Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 8 },
  caixa: { paddingHorizontal: 14, paddingVertical: 12 },
  multilinha: { minHeight: 96, textAlignVertical: 'top' },
  contador: { alignSelf: 'flex-end' },
});
