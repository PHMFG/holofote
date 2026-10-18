import type { Conversa } from '@holofote/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Rotulo } from '../../ui/Rotulo';
import { Texto } from '../../ui/Texto';
import { Verificado } from '../../ui/Verificado';
import { useAnimacoes } from '../animacao/animacoes';

export interface LinhaConversaProps {
  conversa: Conversa;
  /** Já formatada: "agora", "21:40" ou "Dia 5". */
  hora?: string;
  separador?: boolean;
  onPress: () => void;
}

/** Prévia: o jogador aparece como "Você:"; conversa aberta sem mensagens ainda fica em branco. */
export function previaDe(conversa: Conversa): string {
  if (!conversa.ultima) return 'Sem mensagens ainda';
  return conversa.ultima.minha ? `Você: ${conversa.ultima.texto}` : conversa.ultima.texto;
}

/** "NOVO" enquanto o personagem que puxou conversa ainda não foi lido. */
export const ehNova = (conversa: Conversa) => conversa.puxouConversa && conversa.naoLidas > 0;

/**
 * Linha de 14 · Mensagens (Figma 54:1373). Segue a LinhaDeLista, mas com o que ela não tem:
 * selo e rótulo depois do nome, hora na linha do nome (em destaque-tinta quando não lida) e a
 * prévia lida em Corpo (não em Legenda).
 */
export function LinhaConversa({ conversa, hora, separador = true, onPress }: LinhaConversaProps) {
  const { cores } = useTema();
  const animacoes = useAnimacoes();
  const { personagem, relacao } = conversa;
  const naoLida = conversa.naoLidas > 0;
  const nova = ehNova(conversa);
  const previa = previaDe(conversa);
  const detalhe = `${relacao.rotulo} · ${relacao.afinidade}%`;
  const rotulo = [
    personagem.nome,
    personagem.verificado ? 'verificado' : undefined,
    nova ? 'puxou conversa' : undefined,
    hora,
    previa,
    `${relacao.rotulo}, afinidade ${relacao.afinidade}%`,
    naoLida ? `${conversa.naoLidas} não ${conversa.naoLidas === 1 ? 'lida' : 'lidas'}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint="Abre a conversa"
      style={({ pressed }) => [
        estilos.linha,
        separador && { borderBottomWidth: 1, borderBottomColor: cores.linha },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Avatar iniciais={personagem.iniciais} tom={personagem.tomAvatar} tamanho={44} />
      <View style={estilos.texto}>
        <View style={estilos.cabecalho}>
          <Texto estilo="corpoForte" numberOfLines={1} style={estilos.nome}>
            {personagem.nome}
          </Texto>
          {personagem.verificado && <Verificado />}
          {nova && <Rotulo texto="Novo" variante="destaque" />}
          <View style={estilos.espaco} />
          {hora && (
            <Texto estilo="legenda" cor={naoLida ? 'destaqueTinta' : 'textoSuave'}>
              {hora}
            </Texto>
          )}
        </View>
        <View style={estilos.previa}>
          <Texto
            estilo={naoLida ? 'corpoForte' : 'corpo'}
            cor={naoLida ? 'texto' : 'textoSuave'}
            numberOfLines={1}
            style={estilos.encolher}
          >
            {previa}
          </Texto>
          {/* Lida a conversa, o ponto encolhe e some em vez de sumir de uma vez. */}
          {naoLida && (
            <Animated.View
              exiting={animacoes.popSaida}
              style={[estilos.ponto, { backgroundColor: cores.destaque }]}
            />
          )}
        </View>
        <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
          {detalhe}
        </Texto>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  texto: { flex: 1, gap: 2 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nome: { flexShrink: 1 },
  espaco: { flex: 1 },
  previa: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  encolher: { flex: 1 },
  ponto: { width: 9, height: 9, borderRadius: 4.5 },
});
