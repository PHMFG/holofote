import { router, useLocalSearchParams } from 'expo-router';
import { Check, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import {
  NOVIDADES,
  lerNovidadesVistas,
  marcarNovidadesVistas,
  novidadesNaoVistas,
} from '../../novidades';
import { Aparecer } from '../../ui/Aparecer';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Folha } from '../../ui/Folha';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';

/**
 * Notas de atualização: o que mudou no app. Depois de uma atualização abre sozinha com as entradas que o
 * jogador ainda não viu; pelo perfil (`?todas=1`) mostra o histórico inteiro. Abrir já conta
 * como visto.
 */
export function TelaNovidades() {
  const { todas } = useLocalSearchParams<{ todas?: string }>();
  const { height } = useWindowDimensions();
  // Lido uma vez, antes de marcar como visto nesta abertura.
  const [entradas] = useState(() => {
    const novas = novidadesNaoVistas(lerNovidadesVistas());
    return todas || novas.length === 0 ? NOVIDADES : novas;
  });

  useEffect(() => {
    marcarNovidadesVistas();
  }, []);

  return (
    <Folha>
      <View style={estilos.topo}>
        <Esfera tom="escuro" tamanho={56}>
          <Icone icone={Sparkles} tamanho={22} cor={corSobreEsfera('escuro')} />
        </Esfera>
        <Texto estilo="titulo" accessibilityRole="header">
          {todas ? 'Notas de atualização' : 'Novidades desta versão'}
        </Texto>
      </View>

      <ScrollView
        style={[estilos.rolagem, { maxHeight: height * 0.5 }]}
        contentContainerStyle={estilos.lista}
      >
        {entradas.map((novidade, i) => (
          <Aparecer key={novidade.id} indice={i}>
            <View style={estilos.entrada}>
              <Texto estilo="legenda" cor="textoSuave">
                {novidade.data}
              </Texto>
              {novidade.itens.map((item) => (
                <View key={item} style={estilos.item}>
                  <Icone icone={Check} tamanho={14} traco={2.5} cor="destaqueTinta" />
                  <Texto style={estilos.textoItem}>{item}</Texto>
                </View>
              ))}
            </View>
          </Aparecer>
        ))}
      </ScrollView>

      <BotaoMetal rotulo="Continuar" onPress={() => router.back()} style={estilos.botao} />
    </Folha>
  );
}

const estilos = StyleSheet.create({
  topo: { alignItems: 'center', gap: 10, paddingBottom: 8 },
  // A Folha centraliza os filhos: a lista e o botão ocupam a largura toda.
  rolagem: { alignSelf: 'stretch', flexGrow: 0 },
  lista: { gap: 18, paddingVertical: 8 },
  entrada: { gap: 10 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  textoItem: { flex: 1 },
  botao: { marginTop: 12, alignSelf: 'stretch' },
});
