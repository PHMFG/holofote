import { router } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BotaoSuave } from './BotaoSuave';
import { Texto } from './Texto';

export interface CabecalhoProps {
  titulo?: string;
  /** "voltar" na pilha, "fechar" em modais, ou nada. */
  navegacao?: 'voltar' | 'fechar' | 'nenhuma';
  /** Ações à direita (BotaoSuave, Chip, Custo). */
  direita?: ReactNode;
  /** "elevado" sobre capas e imagens (08 · Perfil de personagem). */
  variante?: 'suave' | 'elevado';
}

/** Cabeçalho das telas de pilha e modais: botão suave, título e ações à direita. */
export function Cabecalho({ titulo, navegacao = 'voltar', direita, variante }: CabecalhoProps) {
  return (
    <View style={estilos.linha}>
      {navegacao !== 'nenhuma' && (
        <BotaoSuave
          icone={navegacao === 'voltar' ? ArrowLeft : X}
          rotulo={navegacao === 'voltar' ? 'Voltar' : 'Fechar'}
          variante={variante}
          onPress={() => router.back()}
        />
      )}
      {titulo ? (
        <Texto estilo="secao" accessibilityRole="header" numberOfLines={1} style={estilos.titulo}>
          {titulo}
        </Texto>
      ) : (
        <View style={estilos.titulo} />
      )}
      {direita}
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  titulo: { flex: 1 },
});
