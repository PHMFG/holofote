import { Monitor, Moon, Sun } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import type { Historia } from './historias/tipos';
import { Segmentado } from './Segmentado';

function Exemplo() {
  const [tema, setTema] = useState<'claro' | 'escuro' | 'sistema'>('claro');
  const [ordem, setOrdem] = useState<'relevantes' | 'recentes'>('relevantes');
  return (
    <View style={{ gap: 12 }}>
      <Segmentado
        rotulo="Tema de exemplo"
        valor={tema}
        onMudar={setTema}
        opcoes={[
          { valor: 'claro', rotulo: 'Claro', icone: Sun },
          { valor: 'escuro', rotulo: 'Escuro', icone: Moon },
          { valor: 'sistema', rotulo: 'Sistema', icone: Monitor },
        ]}
      />
      <Segmentado
        rotulo="Ordem das respostas"
        valor={ordem}
        onMudar={setOrdem}
        opcoes={[
          { valor: 'relevantes', rotulo: 'Mais relevantes' },
          { valor: 'recentes', rotulo: 'Mais recentes' },
        ]}
      />
    </View>
  );
}

export const historia: Historia = { titulo: 'Segmentado', figma: '28:472', Exemplo };
