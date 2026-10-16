import { useState } from 'react';
import { View } from 'react-native';
import type { Historia } from './historias/tipos';
import { Post } from './Post';

function Exemplo() {
  const [curtido, setCurtido] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <Post
        nome="Nome"
        handle="@handle"
        tempo="2h"
        texto="Texto do post"
        iniciais="LP"
        verificado
        respostas={12}
        reposts={4}
        curtidas={128}
      />
      <Post
        nome="Vic Ferraz"
        handle="@vicferraz"
        tempo="12 min"
        texto="tem gente copiando meu figurino de novo. coincidência? acho que não"
        iniciais="VF"
        tomAvatar="medio"
        verificado
        respostas={48}
        reposts={21}
        curtidas={curtido ? 7_101 : 7_100}
        curtido={curtido}
        onCurtir={() => setCurtido((c) => !c)}
      />
    </View>
  );
}

export const historia: Historia = { titulo: 'Post', figma: '12:49', Exemplo };
