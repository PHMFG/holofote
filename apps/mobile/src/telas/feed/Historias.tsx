import type { HistoriaResumo } from '@holofote/shared';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { primeiroNome } from '../../formatar';

const AVATAR = 56;

export interface HistoriasProps {
  historias: HistoriaResumo[];
  /** Iniciais do jogador para o primeiro item ("Você"). */
  iniciaisJogador: string;
}

/**
 * Fileira de histórias do feed (Figma 16:57). O primeiro item é "Você", sem anel de destaque,
 * com o + que abre o compositor; os outros ganham anel de destaque enquanto não foram vistos.
 */
export function Historias({ historias, iniciaisJogador }: HistoriasProps) {
  const { medidas } = useTema();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A fileira vai de ponta a ponta: desfaz a margem da tela e devolve no conteúdo.
      style={{ marginHorizontal: -medidas.margemLateral }}
      contentContainerStyle={[estilos.fileira, { paddingHorizontal: medidas.margemLateral }]}
    >
      <Item
        rotulo="Você"
        rotuloAcessivel="Você, escrever um post"
        onPress={() => router.push('/novo-post')}
        anel="linha"
        selo
      >
        <Avatar iniciais={iniciaisJogador} tom="escuro" tamanho={AVATAR} nome="Você" />
      </Item>
      {historias.map((h) => (
        <Item
          key={h.id}
          rotulo={primeiroNome(h.autor.nome)}
          rotuloAcessivel={`História de ${h.autor.nome}${h.vista ? '' : ', nova'}`}
          onPress={() => router.push(`/historia/${h.id}`)}
          anel={h.vista ? 'linha' : 'destaque'}
        >
          <Avatar
            iniciais={h.autor.iniciais}
            tom={h.autor.tomAvatar}
            tamanho={AVATAR}
            nome={h.autor.nome}
          />
        </Item>
      ))}
    </ScrollView>
  );
}

function Item(p: {
  rotulo: string;
  rotuloAcessivel: string;
  onPress: () => void;
  anel: 'linha' | 'destaque';
  selo?: boolean;
  children: ReactNode;
}) {
  const { cores } = useTema();
  const destaque = p.anel === 'destaque';
  return (
    <Tocavel
      onPress={p.onPress}
      accessibilityRole="button"
      accessibilityLabel={p.rotuloAcessivel}
      style={estilos.item}
    >
      <View
        style={[
          estilos.anel,
          destaque
            ? { borderWidth: 2, borderColor: cores.destaque }
            : // 1,5 de borda + 0,5 de folga: o anel tem o mesmo tamanho nos dois estados.
              { borderWidth: 1.5, borderColor: cores.linha, padding: 3.5 },
        ]}
      >
        {p.children}
        {p.selo && (
          <Esfera tom="escuro" tamanho={22} style={estilos.selo}>
            <Icone icone={Plus} tamanho={12} cor={corSobreEsfera('escuro')} traco={2} />
          </Esfera>
        )}
      </View>
      <Texto estilo="legenda" cor="textoSuave" numberOfLines={1} style={estilos.rotulo}>
        {p.rotulo}
      </Texto>
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  fileira: { gap: 12, paddingTop: 8, paddingBottom: 16 },
  item: { alignItems: 'center', gap: 7, width: 66 },
  anel: { borderRadius: 999, padding: 3 },
  selo: { position: 'absolute', left: 42.5, top: 42.5 },
  rotulo: { maxWidth: 66 },
});
