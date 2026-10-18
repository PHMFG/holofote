import type { Post } from '@holofote/shared';
import { router } from 'expo-router';
import { Clock, Heart, MessageCircle, Repeat } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useCurtidas } from '../../curtidas';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Cartao } from '../../ui/Cartao';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { Verificado } from '../../ui/Verificado';
import { rotaDoAutor } from '../feed/PostDoFeed';
import { horaMinuto, tempoRelativo } from '../../tempo';
import { ContadorAcao } from './ContadorAcao';

export interface PostPrincipalProps {
  post: Post;
  agora: number;
  onCurtir: () => void;
}

/** Post aberto no topo da tela 03 (Figma 17:175): avatar 48, texto grande, meta e contadores. */
export function PostPrincipal({ post, agora, onCurtir }: PostPrincipalProps) {
  const curtidas = useCurtidas(post);
  const { tipografia } = useTema();
  const { autor } = post;
  const doJogador = autor.papel === 'jogador';
  const marcados = post.marcados.map((p) => p.nome).join(', ');
  const meta = [
    horaMinuto(post.criadoEm),
    tempoRelativo(post.criadoEm, agora),
    post.tom ? `tom ${post.tom}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Cartao style={estilos.cartao}>
      <Tocavel
        onPress={() => router.push(rotaDoAutor(autor))}
        accessibilityRole="button"
        accessibilityLabel={`${autor.nome}${autor.verificado ? ', verificado' : ''}, ${autor.handle}${doJogador ? ', você' : ''}. Abrir perfil`}
        style={estilos.autor}
      >
        <Avatar iniciais={autor.iniciais} tom={autor.tomAvatar} tamanho={48} nome={autor.nome} />
        <View style={estilos.flex}>
          <View style={estilos.nome}>
            <Texto estilo="corpoForte" numberOfLines={1} style={estilos.encolhe}>
              {autor.nome}
            </Texto>
            {autor.verificado && <Verificado />}
          </View>
          <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
            {doJogador ? `${autor.handle} · você` : autor.handle}
          </Texto>
        </View>
      </Tocavel>

      {/* Corpo em tamanho de título (21/28 no Figma), sem o peso SemiBold do estilo Título. */}
      <Texto
        style={{
          fontSize: tipografia.titulo.fontSize - 1,
          lineHeight: tipografia.titulo.lineHeight,
        }}
      >
        {post.texto}
      </Texto>

      {marcados.length > 0 && (
        <Texto estilo="legenda" cor="textoSuave">
          com {marcados}
        </Texto>
      )}

      <View style={estilos.meta} accessible accessibilityLabel={`Publicado ${meta}`}>
        <Icone icone={Clock} tamanho={14} />
        <Texto estilo="legenda" cor="textoSuave">
          {meta}
        </Texto>
      </View>

      <View style={estilos.acoes}>
        <ContadorAcao
          icone={MessageCircle}
          valor={post.respostas}
          rotulo="respostas"
          onPress={() => router.push(`/post/${post.id}/respostas`)}
        />
        <ContadorAcao icone={Repeat} valor={post.reposts} rotulo="reposts" />
        <ContadorAcao
          icone={Heart}
          valor={curtidas}
          rotulo="curtidas"
          ativo={post.curtidoPorMim}
          onPress={onCurtir}
        />
      </View>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: 12 },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  nome: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  encolhe: { flexShrink: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  acoes: { flexDirection: 'row', gap: 8 },
});
