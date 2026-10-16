import type { PersonagemResumo, Relacao } from '@holofote/shared';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { primeiroNome } from '../../formatar';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { EstadoTela } from '../../ui/EstadoTela';
import { RotuloSecao } from '../../ui/Rotulo';
import { Texto } from '../../ui/Texto';

export interface NovaConversaProps {
  elenco: readonly { personagem: PersonagemResumo; relacao: Relacao }[];
  onEscolher: (personagem: PersonagemResumo) => void;
  /** O elenco ainda está chegando da API. */
  carregando?: boolean;
  /** A API falhou ao trazer o elenco; `onTentarDeNovo` pede de novo. */
  erro?: boolean;
  onTentarDeNovo?: () => void;
  /** Há texto na busca: só então "ninguém com esse nome" faz sentido. */
  comBusca?: boolean;
}

/** Fileira do elenco para começar uma conversa (o botão de lápis do topo abre e fecha). */
export function NovaConversa({
  elenco,
  onEscolher,
  carregando,
  erro,
  onTentarDeNovo,
  comBusca,
}: NovaConversaProps) {
  const { cores, medidas } = useTema();
  return (
    <View style={estilos.grupo}>
      <RotuloSecao texto="Começar conversa" />
      {carregando ? (
        <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Carregando o elenco" />
      ) : erro ? (
        <EstadoTela
          tipo="erro"
          frase="Não deu para carregar o elenco."
          acao={onTentarDeNovo && { rotulo: 'Tentar de novo', onPress: onTentarDeNovo }}
        />
      ) : elenco.length === 0 ? (
        <Texto estilo="legenda" cor="textoSuave" style={estilos.vazio}>
          {comBusca
            ? 'Ninguém do elenco com esse nome.'
            : 'O elenco ainda não chegou ao seu mundo.'}
        </Texto>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          // Largura toda para a sombra das esferas não ser cortada na margem.
          style={{ marginHorizontal: -medidas.margemLateral }}
          contentContainerStyle={[estilos.fileira, { paddingHorizontal: medidas.margemLateral }]}
        >
          {elenco.map(({ personagem, relacao }) => (
            <Pressable
              key={personagem.id}
              onPress={() => onEscolher(personagem)}
              accessibilityRole="button"
              accessibilityLabel={`Conversar com ${personagem.nome}, ${relacao.rotulo}, afinidade ${relacao.afinidade}%`}
              style={({ pressed }) => [estilos.pessoa, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Avatar iniciais={personagem.iniciais} tom={personagem.tomAvatar} tamanho={44} />
              <Texto estilo="legenda" numberOfLines={1} style={estilos.nome}>
                {primeiroNome(personagem.nome)}
              </Texto>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 10 },
  fileira: { gap: 14, paddingTop: 2, paddingBottom: 8 },
  pessoa: { alignItems: 'center', gap: 6, width: 60 },
  nome: { textAlign: 'center' },
  vazio: { paddingHorizontal: 4 },
});
