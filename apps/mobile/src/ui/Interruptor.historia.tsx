import { useState } from 'react';
import { View } from 'react-native';
import type { Historia } from './historias/tipos';
import { Interruptor } from './Interruptor';

function Exemplo() {
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <View style={{ flexDirection: 'row', gap: 16 }}>
      <Interruptor valor={a} onMudar={setA} rotulo="Exemplo ligado" />
      <Interruptor valor={b} onMudar={setB} rotulo="Exemplo desligado" />
      <Interruptor valor={false} onMudar={() => {}} rotulo="Exemplo desabilitado" desabilitado />
    </View>
  );
}

export const historia: Historia = { titulo: 'Interruptor', figma: '28:540', Exemplo };
