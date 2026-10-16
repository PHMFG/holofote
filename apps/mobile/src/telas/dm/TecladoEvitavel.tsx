import type { ReactNode } from 'react';
import { KeyboardAvoidingView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Distância entre o compositor e o teclado aberto. */
const FOLGA = 8;

/**
 * Sobe a tela com o teclado (04 · DM, 13 · Respostas). O rodapé da Tela já reserva a área do
 * indicador de início; com o teclado aberto essa área fica embaixo dele, então o deslocamento
 * negativo tira essa sobra e deixa o compositor a 8 pt do teclado.
 */
export function TecladoEvitavel({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={-(Math.max(insets.bottom, 16) - FOLGA)}
      style={estilos.tela}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({ tela: { flex: 1 } });
