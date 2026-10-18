import type { Post as PostDados } from '@holofote/shared';
import { router } from 'expo-router';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Post } from '../../ui/Post';
import { Tocavel } from '../../ui/Tocavel';
import { tempoRelativo } from '../../tempo';
import { BrilhoDeCurtida } from '../animacao/BrilhoDeCurtida';

export interface PostDoFeedProps {
  post: PostDados;
  agora: number;
  onCurtir: (post: PostDados) => void;
}

/** Rota do perfil de quem escreveu: o jogador tem a aba Perfil; o elenco, a tela 08. */
export function rotaDoAutor(autor: PostDados['autor']): string {
  return autor.papel === 'jogador' ? '/perfil' : `/personagem/${autor.id}`;
}

/**
 * Post do feed (componente Post do Figma 12:49) ligado às rotas: abrir, respostas, curtir e o
 * perfil de quem escreveu. Repost e salvar ainda não têm rota na API e ficam só como números.
 * Ao curtir, corações sobem a partir do toque (BrilhoDeCurtida).
 */
export const PostDoFeed = memo(function PostDoFeed({ post, agora, onCurtir }: PostDoFeedProps) {
  const { autor } = post;
  const [brilho, setBrilho] = useState(0);
  const aoCurtir = () => {
    // O brilho é só da curtida; descurtir não comemora.
    if (!post.curtidoPorMim) setBrilho((n) => n + 1);
    onCurtir(post);
  };
  return (
    <BrilhoDeCurtida disparo={brilho}>
      <Post
        nome={autor.nome}
        handle={autor.handle}
        tempo={tempoRelativo(post.criadoEm, agora)}
        texto={post.texto}
        iniciais={autor.iniciais}
        tomAvatar={autor.tomAvatar}
        verificado={autor.verificado}
        respostas={post.respostas}
        reposts={post.reposts}
        curtidas={post.curtidas}
        curtido={post.curtidoPorMim}
        onAbrir={() => router.push(`/post/${post.id}`)}
        onResponder={() => router.push(`/post/${post.id}/respostas`)}
        onCurtir={aoCurtir}
      />
      {/* O Post de src/ui não expõe toque no avatar; esta área cobre o avatar (16, 16, 40 x 40). */}
      <Tocavel
        onPress={() => router.push(rotaDoAutor(autor))}
        accessibilityRole="button"
        accessibilityLabel={`Perfil de ${autor.nome}`}
        hitSlop={4}
        style={estilos.avatar}
      >
        <View />
      </Tocavel>
    </BrilhoDeCurtida>
  );
});

const estilos = StyleSheet.create({
  avatar: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 20 },
});
