import { ArrowUp, Flame, Heart, Plus, Radio, Undo2, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { Chip } from './Chip';
import type { Historia } from './historias/tipos';

const UNIVERSOS = ['Pop Brasil', 'Reality show', 'Faculdade de magia'];

function Exemplo() {
  const [universo, setUniverso] = useState('Pop Brasil');
  const linha = { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as const;
  return (
    <View style={{ gap: 12 }}>
      <View style={linha}>
        {UNIVERSOS.map((u) => (
          <Chip
            key={u}
            rotulo={u}
            tamanho="grande"
            selecionado={u === universo}
            onPress={() => setUniverso(u)}
          />
        ))}
        <Chip
          rotulo="Criar do zero"
          tamanho="grande"
          variante="tracejado"
          icone={Plus}
          onPress={() => {}}
        />
      </View>
      <View style={linha}>
        <Chip rotulo="Responder" icone={Flame} sobreFundo onPress={() => {}} />
        <Chip
          rotulo="Desfazer"
          variante="afundado"
          icone={Undo2}
          iconeDepois={Zap}
          onPress={() => {}}
        />
        <Chip rotulo="3 novas respostas" variante="destaque" icone={ArrowUp} onPress={() => {}} />
      </View>
      <View style={linha}>
        <Chip rotulo="AO VIVO" variante="destaque" icone={Radio} />
        <Chip rotulo="+12 fama" variante="suave" tamanho="pequeno" />
        <Chip rotulo="Editar persona" variante="elevado" tamanho="grande" onPress={() => {}} />
        <Chip rotulo="128" variante="destaque" icone={Heart} />
      </View>
    </View>
  );
}

export const historia: Historia = { titulo: 'Chip', figma: '14:44', Exemplo };
